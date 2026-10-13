# Shared football research backend

Selected stack: The Odds API for NFL/NCAAF odds, CollegeFootballData for college research, nflverse for initial NFL schedules/results. No SportsDataIO integration and no paid subscription is purchased by this code.

## Start locally

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn backend.api:app --host 127.0.0.1 --port 8000
```

The read-only API serves cached snapshots; app requests never trigger provider calls. SQLite is a local prototype store; migrate to PostgreSQL and managed ingestion before a shared public deployment. This local API has no user accounts or production authentication and should stay on loopback until deployment access controls are implemented.

## Credentials and collection

Configure `ODDS_API_KEY` and `CFBD_API_KEY` securely in server environment settings. Never put them in `EXPO_PUBLIC_*` variables, source files, chat, command arguments, or the mobile bundle. Keys are absent by default; missing access does not fall back to fictional data.

Run collection explicitly from the repository root:

```sh
.venv/bin/python -m backend.cli odds --league nfl
.venv/bin/python -m backend.cli odds --league ncaaf
.venv/bin/python -m backend.cli cfbd --year 2026 --week 7
.venv/bin/python -m backend.cli nflverse --year 2026
```

CFBD currently collects regular-season FBS schedules/results plus advanced game stats for the selected week. Postseason collection, event-ID matching across providers, advanced NFL features, and verified injury feeds are subsequent work. Stored research is not automatically attached to demo recommendations. Historical values fetched today are not proof that those values were available before kickoff.

## Budget controls

Odds requests collect three featured markets in one US region, estimated at three credits per league request based on the provider's official sample. NFL plus NCAAF costs an estimated six credits for a full refresh; pricing and coverage must be confirmed for the selected plan. A single shared cache serves all users, with a five-minute collection cache. Default local caps are **450 reserved odds credits per UTC calendar month** and **30 per UTC day**, shared across both leagues. CFBD defaults to 50 requests/month and 10/day. Failed requests retain reservations conservatively because they might have consumed quota.

Override server variables only after confirming the purchased allowance: `ODDS_MONTHLY_CREDIT_LIMIT`, `ODDS_DAILY_CREDIT_LIMIT`, `CFBD_MONTHLY_REQUEST_LIMIT`, `CFBD_DAILY_REQUEST_LIMIT`. Counts persist in `.data/research.sqlite` and limits apply atomically. Use a persistent `RESEARCH_DB_PATH` in deployment; deleting the store resets local accounting. Multiple server processes must share one database. Monthly boundaries follow UTC calendar months, which may differ from provider billing cycles.

These are request limits, **not dollar billing enforcement**. Start with free/trial access; choose a paid plan only after checking its current price and commercial usage terms against the user's **under-$100/month total data budget**. Historical odds purchases, high-frequency automatic polling, and injury subscriptions are not enabled. Low quotas cannot provide continuously current quotes: stale research remains visible but is labeled stale, with recommendations disabled. There is no background provider polling.

## API

- `GET /health`: service health, recommendations disabled.
- `GET /v1/providers`: credential presence and local usage counts, never secret values.
- `GET /v1/slate?league=nfl|ncaaf`: cached normalized quotes, with provider timestamp and current/stale/expired/unavailable status. No pricing across different lines.
- Book-only timestamps retain their scope and receive `book_timestamp_only` status rather than an assertion of exact-market freshness. Ingestion time never substitutes for provider time.
- `GET /v1/research?league=ncaaf&year=2026&week=7`: stored research snapshot.

Set the mobile app's non-secret `EXPO_PUBLIC_RESEARCH_API_URL` to a reachable API base URL and restart Expo to show the separate provider research panel. An Expo tunnel exposes Metro, not this API; an iPhone cannot reach a Mac's `127.0.0.1`. Use a suitable development-network address or a secured hosted backend. The app remains usable in demo mode without this variable.

Tests: `python3 -m unittest discover -s backend/tests -v`. Mocked provider tests consume no API quota. A live nflverse schedule collection can be checked separately without a key. Odds and CFBD require their own successful live validation before claiming they work.
