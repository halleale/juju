-- Poll history for the odds ingest. Drives the kickoff-based schedule and shows credit
-- usage. Service role only: RLS on with no policies.

create table public.ingest_log (
  id bigint generated always as identity primary key,
  sport text not null,
  polled_at timestamptz not null default now(),
  ok boolean not null,
  events integer,
  snapshots integer,
  picks_created integer,
  picks_pulled integer,
  -- Credits this poll cost, and what the provider says is left.
  credits integer,
  credits_remaining integer,
  error text
);

create index ingest_log_sport_time_idx on public.ingest_log (sport, polled_at desc);

alter table public.ingest_log enable row level security;
revoke all on public.ingest_log from anon, authenticated;

-- Last poll and next known kickoff for each sport.
create function public.ingest_status(p_sports text[])
returns table (sport text, last_polled_at timestamptz, next_kickoff timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    s.sport,
    (select max(l.polled_at) from public.ingest_log l where l.sport = s.sport),
    (select min(e.start_time) from public.events e where e.sport = s.sport and e.start_time > now() and e.status = 'scheduled')
  from unnest(p_sports) as s (sport);
$$;

revoke execute on function public.ingest_status(text[]) from public, anon, authenticated;
grant execute on function public.ingest_status(text[]) to service_role;
