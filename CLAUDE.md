# Juju: sports betting agent (build brief)

Juju (working name in the designs: "Signal") is a mobile-first app (with a web version) that scans betting markets at scale, finds data-backed edges, and alerts each user only to the bets that match their interests. Users never place bets in Juju. It is an information and alerting product.

## The problem it solves

- There are thousands of markets every day. Nobody can research them all by hand.
- Most "picks" content is opinion. Juju shows the math: model probability vs. the market's implied probability.
- Users only care about some sports, teams and bet types. Juju filters to those and stays quiet otherwise.

## Design reference

`design/` holds the approved screens (`Tracker.dc.html` and `Web.dc.html` are not in the repo yet) as `.dc.html` files. Read them as HTML/CSS source for layout, copy, colors, type and interaction states. They reference a `support.js` runtime that is not included, so do not try to run them; rebuild them as real components. The `<script data-dc-script>` block in each file shows the sample data and state each screen uses.

| File | Screen |
|---|---|
| `Main.dc.html` | Onboarding: pick sports, bet types, teams, style (Conservative / Balanced / Long shots) |
| `Feed.dc.html` | Personalized picks feed, filter chips, pick cards |
| `PickDetail.dc.html` | Pick breakdown: model vs market, line movement, signals for/against, best price, suggested size |
| `Alerts.dc.html` | Alert history and controls: minimum edge, alert types, daily cap, quiet hours, weekly limit |
| `Tracker.dc.html` | Track record: record, units, ROI, closing-line value, by bet type, recently settled |
| `Web.dc.html` | Desktop web dashboard: interests sidebar, "Ask your agent" box, ranked picks table |

### Design tokens

- Background `#0D1015`, surface `#161A21`, raised `#1E232C`, border `#2A303B`
- Text `#F2F4F7`, secondary `#C9D0DA`, muted `#9AA3B2`
- Accent / positive `#C8F25A` (text on accent: `#0D1015`), caution / negative `#FF9F43`
- Fonts: Barlow Condensed 700 (display, uppercase), IBM Plex Sans (UI), IBM Plex Mono (odds and numbers)
- Touch targets at least 44px. Bottom tab bar: Picks, Alerts, Tracker, Interests.

## Suggested stack (confirm with the owner before locking in)

- **Client:** Expo (React Native) with Expo Router, so one codebase ships iOS, Android and web.
- **Backend:** Postgres (Supabase is a good fit: auth, database, edge functions, cron).
- **Odds data:** an odds aggregator API covering multiple sportsbooks (for example The Odds API). Keep it behind a provider interface so it can be swapped.
- **Stats / injuries / weather:** add later behind the same kind of interface.
- **LLM:** Claude API for the plain-language "why" on each pick and for "Ask your agent" (natural language to feed filters via tool use).
- **Push:** Expo Notifications.

## Core concepts and math

- **Implied probability** from American odds: negative odds `-A` gives `A / (A + 100)`; positive odds `+B` gives `100 / (B + 100)`.
- **No-vig fair probability:** normalize both sides of a market so they sum to 1.
- **Edge (pts)** = model probability minus the implied probability of the best available price.
- **Fair odds** = model probability converted back to American odds.
- **Closing-line value (CLV):** whether the price at alert time beat the final pre-game price. This is the main honesty metric on the Tracker.
- **Units:** 1 unit stake; a win at `-110` returns `+0.91u`, a loss `-1u`.

## Model, v1 (keep it simple and honest)

Start with a market-based model, not a from-scratch sports model:
1. For each market, build a consensus fair probability from the no-vig prices across books (weight sharper books more).
2. Compare each book's price to that consensus. A positive gap is an edge.
3. Store every snapshot so line movement and CLV can be computed.
Proprietary sport-specific models (pace, weather, injuries) come later and plug in as additional "signals" that adjust the probability and populate the "for / against" list on the detail screen.

## Pipeline

1. **Ingest** (scheduled, every few minutes): pull odds for enabled sports, store snapshots.
2. **Score:** compute fair probability, edge, confidence for every market.
3. **Match:** for each user, filter scored picks by their sports, bet types, teams and style, and by their minimum edge.
4. **Explain:** generate the one-line "why" and the signals list (Claude API, grounded only in stored data; never invent stats).
5. **Alert:** push new edges, line moves on tracked picks, and pulled picks, respecting daily cap, quiet hours and weekly limit.
6. **Grade:** after games end, settle picks, compute units, ROI and CLV for the Tracker.

## Data model (starting point)

- `users`: id, style, min_edge, max_alerts_per_day, quiet_hours, weekly_limit
- `user_interests`: user_id, kind (sport | bet_type | team | player), value
- `events`: id, sport, league, home, away, start_time, status, final_score
- `markets`: id, event_id, type (spread | total | moneyline | prop), line, selection
- `odds_snapshots`: market_id, book, price, captured_at
- `picks`: id, market_id, model_prob, implied_prob, edge, confidence, why, signals (json), created_at, result, units, closing_price
- `user_picks`: user_id, pick_id, tracked, alerted_at
- `alerts`: id, user_id, pick_id, kind (new_edge | line_move | pulled), sent_at

## Build order

1. Expo app shell, theme tokens, tab navigation, all six screens on mock data matching `design/`.
2. Auth and onboarding that saves interests and style.
3. Odds ingestion, scoring and the real feed.
4. Pick detail with line movement and best price.
5. Alerts and push with all user controls.
6. Grading and the Tracker.
7. Web layout (sidebar + table) and "Ask your agent".

## Must-haves before launch

- 21+ age gate and terms; show a problem-gambling helpline and the weekly-limit control.
- Copy always frames picks as model estimates, not guarantees.
- Check state-by-state rules for sportsbook links or affiliate deals before adding any.
- Never fabricate stats in explanations; if data is missing, say so.

## Current status

- Step 1 done: Expo SDK 57 app (Expo Router, routes in `src/app/`), theme tokens in `src/theme.ts`, custom tab bar, all mobile screens on mock data in `src/data/mock.ts`. Tracker was built from this brief since its design file was not provided.
- Onboarding step 2 is the 21+ age gate, terms and helpline.
- Math lives in `src/lib/` (`odds.ts`, `consensus.ts`, `picks.ts`, `tracker.ts`) with tests in `tests/`. Edge is always measured against the best available price.
- Settings are in memory (`src/state/settings.tsx`) until auth lands in step 2.

## Commands

- `npm start` / `npm run web`: dev server
- `npm test`: unit tests (Vitest)
- `npm run typecheck`, `npm run lint`
