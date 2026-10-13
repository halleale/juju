# juju — NFL research prototype

iOS-first React Native / Expo app with a web build for development. This is a local, fictional-data prototype, not a production recommendation service.

## Run

Requires Node 22.13+ (Node 24 used here).

```sh
cd /workspace/juju
npm ci
npm start
```

Use a compatible Expo Go client on a device, or a native development build. Native iOS compilation needs macOS/Xcode or an EAS build; neither was performed in this cloud workspace. SDK 57 client availability must be checked for your device.

```sh
npm run web
npm run typecheck
npm test
npm run build:web
```

If Expo metadata services are blocked, `EXPO_OFFLINE=1 npm run web` uses the installed SDK without fetching metadata. Dependencies must already be installed. In the cloud workspace use `npm_config_cache=/workspace/.npm-cache` if the default cache is not writable.

## Implemented

- Onboarding and book preferences.
- Picks, Games, My Picks, Results, recommendation details, and watching/withdrawn/settled examples.
- Separate saved research and manually entered external bets, persisted on device with AsyncStorage.
- Exact-price sample calculations with push-aware expected return.
- Deterministic contextual assistant with explicit sample-data provenance, unsupported-market handling, and no invented live information.
- Original quote retained independently of entered book, line, odds, and optional stake.
- Local record deletion and clearing.

All fixtures and results are fictional. Fixed demo dates expire; changing the sample fixture dates is a development task, not a live-feed refresh. Manual bet settlement is deliberately pending, because changed lines require real scores and book rules. No validated numerical edge, acceptable-price threshold, or live recommendation is published.

## Smoke test

Explore the demo, open Buffalo, ask about -125 (expect a pass), save research, record a separate bet at a different price, and inspect My Picks. Reload: both records should persist separately. Filter all books off: expect an empty Picks state while Games remains available. Results must retain the withdrawn sample and its outcome. Clear local records in Preferences.

## Next milestone

See [BUILD_PLAN.md](BUILD_PLAN.md). No feed credentials, user authentication, paid subscription, server, live AI agent, live grading, model training, notifications, or production eligibility controls are configured. Do not submit this prototype as a production betting product.
