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

## Check it

```bash
npm test         # odds math, consensus model, feed matching, tracker stats, settings sync
npm run test:db  # applies the migrations to a throwaway local Postgres and checks row-level security
npm run typecheck
npm run lint
```

## Layout

| Path | What |
|---|---|
| `src/app/` | Routes: `onboarding/`, `(tabs)/` (Picks, Alerts, Tracker, Interests), `pick/[id]` |
| `src/components/` | Shared UI, pick card, tab bar, line chart, icons |
| `src/lib/` | Odds math, consensus no-vig model, pick matching, tracker stats |
| `src/data/` | Types and mock data (replaced by the live pipeline later) |
| `src/state/` | Auth session and user settings (synced to Supabase when signed in) |
| `supabase/migrations/` | Database schema and row-level security policies |
| `supabase/tests/` | Database checks run by `npm run test:db` |
| `design/` | Approved screen designs (reference only, not runnable) |

See `CLAUDE.md` for the full product brief and build order.
