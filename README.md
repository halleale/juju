# Juju

A sports betting agent: scans betting markets, finds data-backed edges (model probability vs. the market's implied probability) and alerts each user only to the bets that match their interests. Juju never places bets.

Built with Expo (React Native + Expo Router), so one codebase ships iOS, Android and web.

## Run it

```bash
npm install
npm start        # then press i / a / w, or scan the QR code with Expo Go
npm run web      # browser only
```

Without Supabase keys the app runs in **demo mode**: no sign-in, and settings reset on reload.

## Connect Supabase (accounts and saved settings)

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema in `supabase/migrations/`, either with the CLI (`npx supabase link --project-ref <ref>` then `npx supabase db push`) or by running each file, in order, in the dashboard's SQL editor.
3. Sign-in uses a one-time email code, so the emails must contain the code. In **Authentication > Emails**, edit the **Magic link** and **Confirm signup** templates to include `{{ .Token }}`, for example: `Your Juju code is {{ .Token }}`.
4. Copy `.env.example` to `.env` and fill in the project URL and publishable key from **Project Settings > API**. Restart with `npx expo start --clear` after changing it.
5. Before launch, set up custom SMTP: Supabase's built-in email sender is rate-limited and meant for testing.

## Live odds (The Odds API)

A scheduled Supabase Edge Function, `supabase/functions/ingest-odds`, pulls pre-game odds, stores every price change in `odds_snapshots`, scores each market against a weighted no-vig consensus (Pinnacle counts 3x) and opens or pulls rows in `picks`. The logic lives in `src/pipeline/`; the provider sits behind the `OddsProvider` interface so another source can be added as one adapter.

1. Get a key at [the-odds-api.com](https://the-odds-api.com). Each poll costs about 3 credits per league (3 markets, 10 books), and every poll's actual cost is logged.
2. Apply the migrations (step 2 above), then set the function's secrets. `INGEST_SECRET` is any long random string:
   ```bash
   npx supabase secrets set ODDS_API_KEY=... INGEST_SECRET=...
   # Optional, defaults to NFL. Other sports use the same kickoff-based schedule:
   npx supabase secrets set ODDS_SPORTS="NFL,NBA"
   ```
3. Deploy. `--use-api` lets the function import `src/pipeline/`:
   ```bash
   npx supabase functions deploy ingest-odds --no-verify-jwt --use-api
   ```
4. Run it once by hand. `force=1` polls even if the schedule says it is not due. The response shows events, snapshots, picks created and pulled, and credits used:
   ```bash
   curl -X POST "https://<ref>.supabase.co/functions/v1/ingest-odds?force=1" -H "x-ingest-secret: <INGEST_SECRET>"
   ```
5. Schedule it. In the dashboard, enable the `pg_cron` and `pg_net` extensions, store the secret in Vault, and run in the SQL editor:
   ```sql
   select vault.create_secret('<INGEST_SECRET>', 'ingest_secret');
   select cron.schedule('ingest-odds', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/ingest-odds',
       headers := jsonb_build_object('x-ingest-secret',
         (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_secret'))
     );
   $$);
   ```
   Waking every 5 minutes is free; a sport is only polled when it is due (`src/pipeline/schedule.ts`):

   | Next kickoff | Poll every |
   |---|---|
   | within 90 min | 5 min |
   | within 6 h | 10 min |
   | within 24 h | 30 min |
   | within 3 days | 2 h |
   | later, or none known | 4 h |

   No polls 1am-8am Eastern unless a game starts within 6 hours. For a normal NFL week (Thursday, Sunday, Monday games) that is about 330 polls, roughly 1,000 credits a week or 4,000 a month, which fits the 20K plan.
6. Check credit use:
   ```sql
   select date_trunc('day', polled_at) as day, count(*) as polls, sum(credits) as credits, min(credits_remaining) as remaining
   from ingest_log group by 1 order by 1 desc;
   ```

## Check it

```bash
npm test         # odds math, consensus model, odds pipeline, feed matching, tracker stats, settings sync
npm run test:db  # applies the migrations to a throwaway local Postgres and checks row-level security and the pipeline RPCs
npm run typecheck
npm run lint
```

## Layout

| Path | What |
|---|---|
| `src/app/` | Routes: `onboarding/`, `(tabs)/` (Picks, Alerts, Tracker, Interests), `pick/[id]` |
| `src/components/` | Shared UI, pick card, tab bar, line chart, icons |
| `src/lib/` | Odds math, consensus no-vig model, pick matching, tracker stats |
| `src/pipeline/` | Odds provider interface, The Odds API adapter, market scoring and the ingest run (also runs in Deno) |
| `src/data/` | Types and mock data (replaced by the live pipeline later) |
| `src/state/` | Auth session and user settings (synced to Supabase when signed in) |
| `supabase/functions/` | Edge Functions: `ingest-odds` (scheduled odds ingest and scoring) |
| `supabase/migrations/` | Database schema and row-level security policies |
| `supabase/tests/` | Database checks run by `npm run test:db` |
| `design/` | Approved screen designs (reference only, not runnable) |

See `CLAUDE.md` for the full product brief and build order.
