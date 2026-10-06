-- User settings and interests. One profiles row per auth user, created on sign-up.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  style text not null default 'balanced' check (style in ('conservative', 'balanced', 'longshot')),
  min_edge numeric(4, 1) not null default 5 check (min_edge between 0 and 20),
  max_alerts_per_day smallint not null default 5 check (max_alerts_per_day between 1 and 20),
  alert_new_edges boolean not null default true,
  alert_line_moves boolean not null default true,
  alert_injuries boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_start time not null default '23:00',
  quiet_end time not null default '08:00',
  timezone text not null default 'America/New_York',
  -- Weekly budget in dollars. Null means no limit.
  weekly_limit numeric(10, 2) check (weekly_limit is null or weekly_limit > 0),
  age_confirmed_at timestamptz,
  terms_accepted_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('sport', 'bet_type', 'team', 'player')),
  value text not null check (length(value) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, value)
);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Create a profile for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_interests enable row level security;

create policy "Users read their own profile" on public.profiles
for select to authenticated using ((select auth.uid()) = id);

create policy "Users update their own profile" on public.profiles
for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users read their own interests" on public.user_interests
for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own interests" on public.user_interests
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users remove their own interests" on public.user_interests
for delete to authenticated using ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.user_interests to authenticated;

-- Replaces all of the caller's interests of one kind in a single transaction.
create function public.set_interests(p_kind text, p_values text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from public.user_interests where user_id = uid and kind = p_kind;
  insert into public.user_interests (user_id, kind, value)
  select distinct uid, p_kind, v from unnest(coalesce(p_values, '{}')) as v;
end;
$$;

revoke execute on function public.set_interests(text, text[]) from public, anon;
grant execute on function public.set_interests(text, text[]) to authenticated;

-- Lets a signed-in user delete their own account and everything that cascades from it.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
