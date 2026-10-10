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
