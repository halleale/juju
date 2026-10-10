-- Write path for the odds pipeline (supabase/functions/ingest-odds). Only the service
-- role can call these.

-- Soccer lines come in quarters (e.g. -0.25), so keep two decimals.
alter table public.markets alter column line type numeric(6, 2);

-- Latest price per market and book, used to skip unchanged prices.
create index odds_snapshots_market_book_time_idx on public.odds_snapshots (market_id, book, captured_at desc);

-- At most one active pick per market; re-runs never duplicate it.
create unique index picks_one_active_per_market_idx on public.picks (market_id) where status = 'active';

-- p_events: [{externalId, sport, league, home, away, startTime, quotes: [{type, selection, line, book, price}]}]
-- Upserts events and markets, and stores a snapshot only when a book's price changed
-- since its last snapshot. Returns the number of snapshots written.
create function public.ingest_odds(p_events jsonb, p_captured_at timestamptz default now())
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
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

  with q as (
    select distinct on (m.id, x ->> 'book') m.id as market_id, x ->> 'book' as book, (x ->> 'price')::integer as price
    from jsonb_array_elements(p_events) e
    join public.events ev on ev.external_id = e ->> 'externalId'
    cross join jsonb_array_elements(e -> 'quotes') x
    join public.markets m
      on m.event_id = ev.id and m.type = x ->> 'type' and m.selection = x ->> 'selection'
      and m.line is not distinct from (x ->> 'line')::numeric
  )
  insert into public.odds_snapshots (market_id, book, price, captured_at)
  select q.market_id, q.book, q.price, p_captured_at
  from q
  where q.price is distinct from (
    select s.price from public.odds_snapshots s
    where s.market_id = q.market_id and s.book = q.book
    order by s.captured_at desc
    limit 1
  );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- p_create / p_keep: [{eventExternalId, type, selection, line, modelProb, impliedProb,
--   bestBook, bestPrice, edge, confidence, signals}]
-- Opens a pick for each p_create market that has no active pick, then pulls active picks
-- on p_event_ids whose market is not in p_keep. Returns {created, pulled}.
create function public.record_picks(p_event_ids text[], p_create jsonb, p_keep jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_created integer;
  v_pulled integer;
begin
  insert into public.picks (market_id, model_prob, implied_prob, best_price, best_book, edge, confidence, signals)
  select
    m.id,
    least(greatest(round((x ->> 'modelProb')::numeric, 4), 0.0001), 0.9999),
    least(greatest(round((x ->> 'impliedProb')::numeric, 4), 0.0001), 0.9999),
    (x ->> 'bestPrice')::integer,
    x ->> 'bestBook',
    round((x ->> 'edge')::numeric, 2),
    x ->> 'confidence',
    coalesce(x -> 'signals', '[]')
  from jsonb_array_elements(p_create) x
  join public.events ev on ev.external_id = x ->> 'eventExternalId'
  join public.markets m
    on m.event_id = ev.id and m.type = x ->> 'type' and m.selection = x ->> 'selection'
    and m.line is not distinct from (x ->> 'line')::numeric
  on conflict (market_id) where status = 'active' do nothing;
  get diagnostics v_created = row_count;

  update public.picks p
  set status = 'pulled'
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

revoke execute on function public.ingest_odds(jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.record_picks(text[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_odds(jsonb, timestamptz) to service_role;
grant execute on function public.record_picks(text[], jsonb, jsonb) to service_role;
