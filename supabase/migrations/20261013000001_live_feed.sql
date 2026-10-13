-- Live feed: current prices per book, a live probability on active picks, and read
-- functions for the feed and price history.

-- The prices from the latest poll of each event. Replaced per event on every ingest, so
-- a book that stops quoting a market drops out instead of showing a stale price.
create table public.current_odds (
  market_id bigint not null references public.markets (id) on delete cascade,
  book text not null,
  price integer not null check (price <= -100 or price >= 100),
  updated_at timestamptz not null,
  primary key (market_id, book)
);

alter table public.current_odds enable row level security;
create policy "Signed-in users read current odds" on public.current_odds for select to authenticated using (true);
grant select on public.current_odds to authenticated;

-- model_prob / edge / best_price stay as they were when the pick opened (for CLV).
-- current_* follow the market while the pick is active.
alter table public.picks
  add column current_prob numeric(5, 4) check (current_prob > 0 and current_prob < 1),
  add column current_edge numeric(5, 2),
  add column updated_at timestamptz;
update public.picks set current_prob = model_prob, current_edge = edge, updated_at = created_at;
alter table public.picks
  alter column current_prob set not null,
  alter column current_edge set not null,
  alter column updated_at set not null,
  alter column updated_at set default now();

create or replace function public.ingest_odds(p_events jsonb, p_captured_at timestamptz default now())
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ids text[];
  n integer;
begin
  select coalesce(array_agg(e ->> 'externalId'), '{}') into v_ids from jsonb_array_elements(p_events) e;

  insert into public.events (external_id, sport, league, home, away, start_time)
  select e ->> 'externalId', e ->> 'sport', e ->> 'league', e ->> 'home', e ->> 'away', (e ->> 'startTime')::timestamptz
  from jsonb_array_elements(p_events) e
  on conflict (external_id) do update
    set start_time = excluded.start_time, home = excluded.home, away = excluded.away;

  insert into public.markets (event_id, type, selection, line)
  select distinct ev.id, q ->> 'type', q ->> 'selection', (q ->> 'line')::numeric
  from jsonb_array_elements(p_events) e
  join public.events ev on ev.external_id = e ->> 'externalId'
  cross join jsonb_array_elements(e -> 'quotes') q
  on conflict (event_id, type, selection, line) do nothing;

  delete from public.current_odds c
  using public.markets m, public.events ev
  where c.market_id = m.id and m.event_id = ev.id and ev.external_id = any (v_ids);

  insert into public.current_odds (market_id, book, price, updated_at)
  select distinct on (m.id, x ->> 'book') m.id, x ->> 'book', (x ->> 'price')::integer, p_captured_at
  from jsonb_array_elements(p_events) e
  join public.events ev on ev.external_id = e ->> 'externalId'
  cross join jsonb_array_elements(e -> 'quotes') x
  join public.markets m
    on m.event_id = ev.id and m.type = x ->> 'type' and m.selection = x ->> 'selection'
    and m.line is not distinct from (x ->> 'line')::numeric;

  insert into public.odds_snapshots (market_id, book, price, captured_at)
  select c.market_id, c.book, c.price, p_captured_at
  from public.current_odds c
  join public.markets m on m.id = c.market_id
  join public.events ev on ev.id = m.event_id
  where ev.external_id = any (v_ids)
    and c.price is distinct from (
      select s.price from public.odds_snapshots s
      where s.market_id = c.market_id and s.book = c.book
      order by s.captured_at desc
      limit 1
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- As before, plus: active picks still in p_keep get their live probability and edge.
create or replace function public.record_picks(p_event_ids text[], p_create jsonb, p_keep jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_created integer;
  v_pulled integer;
begin
  insert into public.picks (market_id, model_prob, implied_prob, best_price, best_book, edge, confidence, signals, current_prob, current_edge)
  select
    m.id,
    least(greatest(round((x ->> 'modelProb')::numeric, 4), 0.0001), 0.9999),
    least(greatest(round((x ->> 'impliedProb')::numeric, 4), 0.0001), 0.9999),
    (x ->> 'bestPrice')::integer,
    x ->> 'bestBook',
    round((x ->> 'edge')::numeric, 2),
    x ->> 'confidence',
    coalesce(x -> 'signals', '[]'),
    least(greatest(round((x ->> 'modelProb')::numeric, 4), 0.0001), 0.9999),
    round((x ->> 'edge')::numeric, 2)
  from jsonb_array_elements(p_create) x
  join public.events ev on ev.external_id = x ->> 'eventExternalId'
  join public.markets m
    on m.event_id = ev.id and m.type = x ->> 'type' and m.selection = x ->> 'selection'
    and m.line is not distinct from (x ->> 'line')::numeric
  on conflict (market_id) where status = 'active' do nothing;
  get diagnostics v_created = row_count;

  update public.picks p
  set current_prob = least(greatest(round((k ->> 'modelProb')::numeric, 4), 0.0001), 0.9999),
      current_edge = round((k ->> 'edge')::numeric, 2),
      confidence = k ->> 'confidence',
      signals = coalesce(k -> 'signals', p.signals),
      updated_at = now()
  from jsonb_array_elements(p_keep) k, public.markets m, public.events ev
  where p.market_id = m.id and m.event_id = ev.id and p.status = 'active'
    and k ->> 'eventExternalId' = ev.external_id and k ->> 'type' = m.type
    and k ->> 'selection' = m.selection and (k ->> 'line')::numeric is not distinct from m.line;

  update public.picks p
  set status = 'pulled', updated_at = now()
  from public.markets m
  join public.events ev on ev.id = m.event_id
  where p.market_id = m.id
    and p.status = 'active'
    and ev.external_id = any (p_event_ids)
    and not exists (
      select 1 from jsonb_array_elements(p_keep) k
      where k ->> 'eventExternalId' = ev.external_id and k ->> 'type' = m.type
        and k ->> 'selection' = m.selection and (k ->> 'line')::numeric is not distinct from m.line
    );
  get diagnostics v_pulled = row_count;

  return jsonb_build_object('created', v_created, 'pulled', v_pulled);
end;
$$;

-- Active picks on games that have not started, with each book's current price, plus how
-- many markets are being watched. Matching to the user's interests happens in the app.
create function public.feed_picks()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'markets_scanned', (
      select count(distinct c.market_id) from public.current_odds c
      join public.markets m on m.id = c.market_id
      join public.events ev on ev.id = m.event_id
      where ev.start_time > now()
    ),
    'picks', coalesce((
      select jsonb_agg(row_to_json(f) order by f.current_edge desc)
      from (
        select
          p.id, ev.sport, ev.home, ev.away, ev.start_time, m.type, m.selection, m.line,
          p.current_prob, p.current_edge, p.confidence, p.why, p.signals,
          p.best_price as open_price, p.created_at,
          coalesce((select jsonb_agg(jsonb_build_object('book', c.book, 'price', c.price)) from public.current_odds c where c.market_id = m.id), '[]') as books
        from public.picks p
        join public.markets m on m.id = p.market_id
        join public.events ev on ev.id = m.event_id
        where p.status = 'active' and ev.start_time > now()
      ) f
    ), '[]')
  );
$$;

-- Every stored price for a pick's market, oldest first, for the movement chart.
create function public.pick_history(p_pick_id bigint)
returns table (book text, price integer, captured_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select s.book, s.price, s.captured_at
  from public.picks p
  join public.odds_snapshots s on s.market_id = p.market_id
  where p.id = p_pick_id
  order by s.captured_at;
$$;

revoke execute on function public.feed_picks() from public, anon;
revoke execute on function public.pick_history(bigint) from public, anon;
grant execute on function public.feed_picks() to authenticated;
grant execute on function public.pick_history(bigint) to authenticated;
