-- Odds pipeline tables. Written only by the service role (ingest, score, grade jobs);
-- signed-in users can read them.

create table public.events (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  sport text not null,
  league text not null,
  home text not null,
  away text not null,
  start_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'final', 'postponed', 'canceled')),
  home_score smallint,
  away_score smallint
);

create index events_start_time_idx on public.events (start_time);

create table public.markets (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events (id) on delete cascade,
  type text not null check (type in ('spread', 'total', 'moneyline', 'prop')),
  selection text not null,
  line numeric(6, 1),
  unique nulls not distinct (event_id, type, selection, line)
);

create table public.odds_snapshots (
  id bigint generated always as identity primary key,
  market_id bigint not null references public.markets (id) on delete cascade,
  book text not null,
  -- American odds.
  price integer not null check (price <= -100 or price >= 100),
  captured_at timestamptz not null default now()
);

create index odds_snapshots_market_time_idx on public.odds_snapshots (market_id, captured_at desc);

create table public.picks (
  id bigint generated always as identity primary key,
  market_id bigint not null references public.markets (id) on delete cascade,
  model_prob numeric(5, 4) not null check (model_prob > 0 and model_prob < 1),
  implied_prob numeric(5, 4) not null check (implied_prob > 0 and implied_prob < 1),
  best_price integer not null check (best_price <= -100 or best_price >= 100),
  best_book text not null,
  -- Percentage points.
  edge numeric(5, 2) not null,
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  why text,
  signals jsonb not null default '[]',
  status text not null default 'active' check (status in ('active', 'pulled', 'settled')),
  created_at timestamptz not null default now(),
  result text check (result in ('win', 'loss', 'push')),
  units numeric(6, 2),
  closing_price integer check (closing_price is null or closing_price <= -100 or closing_price >= 100)
);

create index picks_status_created_idx on public.picks (status, created_at desc);

create table public.user_picks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pick_id bigint not null references public.picks (id) on delete cascade,
  tracked boolean not null default false,
  line_alert boolean not null default false,
  alerted_at timestamptz,
  primary key (user_id, pick_id)
);

create table public.alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pick_id bigint references public.picks (id) on delete set null,
  kind text not null check (kind in ('new_edge', 'line_move', 'pulled')),
  title text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create index alerts_user_sent_idx on public.alerts (user_id, sent_at desc);

alter table public.events enable row level security;
alter table public.markets enable row level security;
alter table public.odds_snapshots enable row level security;
alter table public.picks enable row level security;
alter table public.user_picks enable row level security;
alter table public.alerts enable row level security;

create policy "Signed-in users read events" on public.events for select to authenticated using (true);
create policy "Signed-in users read markets" on public.markets for select to authenticated using (true);
create policy "Signed-in users read odds" on public.odds_snapshots for select to authenticated using (true);
create policy "Signed-in users read picks" on public.picks for select to authenticated using (true);

create policy "Users manage their own tracked picks" on public.user_picks
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users read their own alerts" on public.alerts
for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users mark their own alerts read" on public.alerts
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select on public.events, public.markets, public.odds_snapshots, public.picks to authenticated;
grant select, insert, update, delete on public.user_picks to authenticated;
grant select on public.alerts to authenticated;
grant update (read_at) on public.alerts to authenticated;
