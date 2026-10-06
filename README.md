# Juju

A sports betting agent: scans betting markets, finds data-backed edges (model probability vs. the market's implied probability) and alerts each user only to the bets that match their interests. Juju never places bets.

Built with Expo (React Native + Expo Router), so one codebase ships iOS, Android and web.

## Run it

```bash
npm install
npm start        # then press i / a / w, or scan the QR code with Expo Go
npm run web      # browser only
```

## Check it

```bash
npm test         # odds math, consensus model, feed matching, tracker stats
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
| `src/state/` | User settings and interests |
| `design/` | Approved screen designs (reference only, not runnable) |

See `CLAUDE.md` for the full product brief and build order.
