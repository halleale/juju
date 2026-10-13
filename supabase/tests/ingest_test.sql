-- Odds pipeline RPCs. Run with scripts/test-db.sh.
\set ON_ERROR_STOP 1

\set events '[{"externalId": "g1", "sport": "NFL", "league": "NFL", "home": "Kansas City Chiefs", "away": "Buffalo Bills", "startTime": "2030-01-01T18:00:00Z", "quotes": [{"type": "spread", "selection": "Kansas City Chiefs", "line": -2.5, "book": "pinnacle", "price": -105}, {"type": "spread", "selection": "Buffalo Bills", "line": 2.5, "book": "pinnacle", "price": -105}, {"type": "moneyline", "selection": "Kansas City Chiefs", "line": null, "book": "pinnacle", "price": -140}, {"type": "total", "selection": "Over", "line": 47.25, "book": "fanduel", "price": -110}]}]'
\set pick '[{"eventExternalId": "g1", "type": "spread", "selection": "Buffalo Bills", "line": 2.5, "modelProb": 0.55, "impliedProb": 0.5122, "bestBook": "fanduel", "bestPrice": -105, "edge": 3.78, "confidence": "High", "signals": [{"pro": true, "title": "t", "detail": "d"}]}]'

-- Users cannot call the write path.
set role authenticated;
do $$ begin
  begin
    perform public.ingest_odds('[]');
    assert false, 'authenticated must not call ingest_odds';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_picks('{}', '[]', '[]');
    assert false, 'authenticated must not call record_picks';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role service_role;
select public.ingest_odds(:'events', '2029-12-30T00:00:00Z') as first \gset
select public.ingest_odds(:'events', '2029-12-30T00:10:00Z') as unchanged \gset
select public.ingest_odds(replace(:'events', '-140', '-150')::jsonb, '2029-12-30T00:20:00Z') as moved \gset
do $$ begin
  assert (select count(*) from public.events where external_id = 'g1') = 1, 'event upserted once';
  assert (select count(*) from public.markets m join public.events e on e.id = m.event_id where e.external_id = 'g1') = 4, 'four markets';
  assert (select line from public.markets where selection = 'Over') = 47.25, 'quarter lines kept';
end $$;
select (:first = 4 and :unchanged = 0 and :moved = 1) as snapshots_ok \gset
\if :snapshots_ok
\else
  \echo 'snapshots: expected 4, 0, 1'
  select 1/0;
\endif

-- Open a pick, re-run without duplicating it, then pull it when the edge goes away.
select public.record_picks('{g1}', :'pick', :'pick') ->> 'created' as created \gset
select public.record_picks('{g1}', :'pick', :'pick') ->> 'created' as again \gset
select (:created = 1 and :again = 0) as create_ok \gset
\if :create_ok
\else
  \echo 'record_picks should create once'
  select 1/0;
\endif
do $$ begin
  assert (select confidence from public.picks p join public.markets m on m.id = p.market_id where m.selection = 'Buffalo Bills') = 'High', 'pick stored';
end $$;
select public.record_picks('{other}', '[]', '[]') ->> 'pulled' as untouched \gset
select public.record_picks('{g1}', '[]', '[]') ->> 'pulled' as pulled \gset
select (:untouched = 0 and :pulled = 1) as pull_ok \gset
\if :pull_ok
\else
  \echo 'record_picks should only pull picks on the given events'
  select 1/0;
\endif
-- With the old pick pulled, a returning edge opens a new one.
select (public.record_picks('{g1}', :'pick', :'pick') ->> 'created')::int = 1 as reopened \gset
\if :reopened
\else
  \echo 'expected a new pick after the old one was pulled'
  select 1/0;
\endif
reset role;

\echo 'All pipeline checks passed.'

-- Poll schedule status.
set role service_role;
insert into public.ingest_log (sport, polled_at, ok) values ('NFL', '2029-12-30T00:00:00Z', true), ('NFL', '2029-12-30T01:00:00Z', false);
do $$ begin
  assert (select last_polled_at from public.ingest_status('{NFL}')) = '2029-12-30T01:00:00Z', 'last poll, failed or not';
  assert (select next_kickoff from public.ingest_status('{NFL}')) = (select start_time from public.events where external_id = 'evt1'), 'next kickoff is the earliest upcoming game';
  assert (select last_polled_at is null and next_kickoff is null from public.ingest_status('{NHL}')), 'unknown sport';
end $$;
reset role;
set role authenticated;
do $$ begin
  begin
    perform count(*) from public.ingest_log;
    assert false, 'users must not read ingest_log';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ingest_status('{NFL}');
    assert false, 'users must not call ingest_status';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'Poll schedule checks passed.'

-- Live feed. g1 currently has an active Bills +2.5 pick (reopened above).
set role service_role;
-- Next poll: Pinnacle's moneyline moves again and FanDuel stops quoting the total.
select public.ingest_odds(replace(replace(:'events', '-140', '-155'), '"Over", "line": 47.25, "book": "fanduel"', '"Over", "line": 47.25, "book": "pinnacle"')::jsonb, '2029-12-30T00:30:00Z') as polled \gset
do $$ begin
  assert (select count(*) from public.current_odds c join public.markets m on m.id = c.market_id where m.selection = 'Over' and c.book = 'fanduel') = 0, 'a book that stopped quoting drops out of current_odds';
  assert (select price from public.current_odds c join public.markets m on m.id = c.market_id where m.type = 'moneyline' and c.book = 'pinnacle') = -155, 'current price updated';
  assert (select count(*) from public.odds_snapshots s join public.markets m on m.id = s.market_id where m.type = 'moneyline') = 3, 'history keeps every change';
end $$;
-- The pick's live numbers follow the market; its opening numbers stay put.
\set keep '[{"eventExternalId": "g1", "type": "spread", "selection": "Buffalo Bills", "line": 2.5, "modelProb": 0.53, "impliedProb": 0.5122, "bestBook": "pinnacle", "bestPrice": -105, "edge": 1.78, "confidence": "Medium", "signals": []}]'
select public.record_picks('{g1}', '[]', :'keep') as kept \gset
do $$ begin
  assert (select current_prob = 0.53 and current_edge = 1.78 and model_prob = 0.55 and edge = 3.78 and confidence = 'Medium'
          from public.picks p join public.markets m on m.id = p.market_id where p.status = 'active' and m.selection = 'Buffalo Bills'), 'live numbers updated, opening numbers kept';
end $$;
reset role;

set role authenticated;
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b"}';
do $$
declare
  f jsonb := public.feed_picks();
  pick jsonb := (select x from jsonb_array_elements(f -> 'picks') x where x ->> 'selection' = 'Buffalo Bills');
begin
  assert jsonb_array_length(f -> 'picks') = 2, 'both active picks in the feed';
  assert (f -> 'picks' -> 0 ->> 'current_edge')::numeric >= (f -> 'picks' -> 1 ->> 'current_edge')::numeric, 'sorted by edge';
  assert pick ->> 'selection' = 'Buffalo Bills' and (pick ->> 'line')::numeric = 2.5 and pick ->> 'type' = 'spread', 'pick market';
  assert (pick ->> 'current_prob')::numeric = 0.53 and (pick ->> 'open_price')::integer = -105, 'live and opening numbers';
  assert jsonb_array_length(pick -> 'books') = 1 and pick -> 'books' -> 0 ->> 'book' = 'pinnacle', 'current books';
  assert (f ->> 'markets_scanned')::integer >= 4, 'markets scanned';
  assert (select count(*) from public.pick_history(((pick ->> 'id')::bigint))) = 1, 'history for the pick';
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.feed_picks();
    assert false, 'anon must not read the feed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'Live feed checks passed.'
