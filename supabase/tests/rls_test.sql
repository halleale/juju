-- Row-level security and RPC checks. Run with scripts/test-db.sh.
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

-- Sign-up trigger created a profile with defaults.
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles created on sign-up';
  assert (select style from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'balanced', 'default style';
end $$;

-- Pipeline data, written by the service role.
set role service_role;
insert into public.events (external_id, sport, league, home, away, start_time) values ('evt1', 'NFL', 'NFL', 'Dolphins', 'Bills', now() + interval '2 days');
insert into public.markets (event_id, type, selection, line) select id, 'total', 'Under', 47.5 from public.events;
insert into public.picks (market_id, model_prob, implied_prob, best_price, best_book, edge, confidence) select id, 0.575, 0.5192, -108, 'A', 5.58, 'High' from public.markets;
reset role;

-- User A.
set role authenticated;
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a"}';

select public.set_interests('sport', array['NFL', 'MLB', 'NFL']);
select public.set_interests('team', array['Buffalo Bills']);
update public.profiles set style = 'longshot', onboarded_at = now() where id = auth.uid();
-- Trying to change someone else's profile silently matches nothing.
update public.profiles set style = 'conservative' where id = '00000000-0000-0000-0000-00000000000b';
insert into public.user_picks (user_id, pick_id, tracked) select auth.uid(), id, true from public.picks;

do $$ begin
  assert (select count(*) from public.profiles) = 1, 'A sees only their own profile';
  assert (select count(*) from public.user_interests where kind = 'sport') = 2, 'duplicates collapsed';
  assert (select count(*) from public.picks) = 1, 'A can read picks';
  assert (select count(*) from public.user_picks) = 1, 'A tracked a pick';
end $$;

-- Replacing interests removes old values.
select public.set_interests('sport', array['NHL']);
do $$ begin
  assert (select array_agg(value) from public.user_interests where kind = 'sport') = array['NHL'], 'sports replaced';
end $$;

-- A cannot write interests for B.
do $$ begin
  begin
    insert into public.user_interests (user_id, kind, value) values ('00000000-0000-0000-0000-00000000000b', 'sport', 'NBA');
    assert false, 'insert for another user should fail';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A cannot write pipeline tables.
do $$ begin
  begin
    insert into public.picks (market_id, model_prob, implied_prob, best_price, best_book, edge, confidence) values (1, 0.6, 0.5, 100, 'X', 10, 'High');
    assert false, 'users must not insert picks';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Check constraints.
do $$ begin
  begin
    update public.profiles set max_alerts_per_day = 50 where id = auth.uid();
    assert false, 'max alerts capped at 20';
  exception when check_violation then null;
  end;
end $$;

-- User B sees none of A's data, and their profile is untouched.
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b"}';
do $$ begin
  assert (select style from public.profiles) = 'balanced', 'B profile unchanged by A';
  assert (select count(*) from public.user_interests) = 0, 'B sees no interests from A';
  assert (select count(*) from public.user_picks) = 0, 'B sees no tracked picks from A';
end $$;

-- Anonymous callers get nothing.
reset role;
set role anon;
set request.jwt.claims = '';
do $$ begin
  begin
    perform count(*) from public.profiles;
    assert false, 'anon must not read profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_interests('sport', array['NFL']);
    assert false, 'anon must not call set_interests';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Account deletion cascades.
reset role;
set role authenticated;
set request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select public.delete_my_account();
reset role;
do $$ begin
  assert (select count(*) from auth.users) = 1, 'auth user deleted';
  assert (select count(*) from public.profiles) = 1, 'profile cascaded';
  assert (select count(*) from public.user_interests) = 0, 'interests cascaded';
  assert (select count(*) from public.user_picks) = 0, 'tracked picks cascaded';
end $$;

\echo 'All database checks passed.'
