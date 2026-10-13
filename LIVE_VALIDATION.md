# Juju live-feed validation

Collected October 12, 2026 at approximately 10:03 p.m. America/New_York (October 13 at 02:03 UTC). These are observed snapshots, not a continuously refreshed feed.

## Results

| Provider collection | Result | Usage |
| --- | --- | --- |
| The Odds API, NFL | 234 normalized quotes across 13 games | 3 credits |
| The Odds API, NCAAF | 1,062 normalized quotes across 59 games | 3 credits |
| CollegeFootballData, 2026 regular-season week 7 | 62 schedule records; advanced stats returned an empty list | 2 requests |
| nflverse, 2026 | 272 schedule records | 1 unmetered download |

The final Odds API response reported 19,994 remaining credits and six used. This confirms reported allowance, not the account's invoice, subscription price, renewal date, or commercial license. Collection keys stayed in the server environment. The persistent SQLite store retains the snapshots and usage ledger; neither is committed.

All 13 NFL and 59 NCAAF odds events match schedule records with exact stored team aliases, home/away orientation, and kickoff within five minutes. NFL schedule times are converted from America/New_York with daylight saving time. Missing aliases, unknown kickoff times, mismatched dates, and duplicate matches abstain. The college alias table covers the 118 names observed in this slate; it is not a complete all-season team registry. New names require explicit aliases. Venue and week remain schedule context; no model features or statistical edge are inferred.

Example NFL: Seattle Seahawks at Denver Broncos, Odds API event `855f58fad5f0f14b239f4f63df27998b`, nflverse source `2026_06_SEA_DEN`. Example college: Delaware at Middle Tennessee, Odds API event `62dd374d95f55eaaad10717b58220ce7`, CFBD source `401871067`. The app displays the stored IDs and original timestamps. Advanced stats for the college example are unavailable; this is not substituted with invented evidence.

## Refresh budget

Measured cost is three credits per league request, six for both leagues and all three featured markets in one region.

| Collection policy | Estimated odds credits, 31 days | Implication |
| --- | ---: | --- |
| Current local monthly cap | 450 | 75 combined refreshes; manual research only |
| Both leagues every 15 minutes, all day | 17,856 | Fits 20,000 credits, but quotes are stale for much of each interval |
| Both leagues every five minutes, all day | 53,568 | Exceeds 20,000 credits |
| Both leagues every two minutes, all day | 133,920 | Exceeds 100,000 credits |

Current published Odds API pricing is $30/month for 20,000 credits and $59/month for 100,000 credits: https://the-odds-api.com/#pricing. CFBD lists a free 1,000-call monthly tier for core/advanced endpoints: https://collegefootballdata.com/api-tiers. Prices checked October 12, 2026. Commercial rights and actual account billing must be checked separately.

For the research pilot, retain manual collection and the existing 450-credit cap. A later five-minute all-day service could fit the published $59 odds tier plus free CFBD access within the under-$100 data budget, if endpoint and usage rights are sufficient. Even five-minute polling cannot guarantee five-minute quote eligibility because provider update age and request timing also matter; the final-hour limit is two minutes. Live eligibility would need targeted faster collection windows and an explicit allowance/cap change. No plan was purchased, no usage cap was raised, and no background polling was enabled.

App reloads read the shared store and spend no provider quota. Quotes become stale after five minutes, two minutes in the final hour, and expired at kickoff. Market/book timestamp scope is preserved. The screen ages labels while open and reloads the stored snapshot on foreground. Real provider data stays separate from fictional demo research; recommendations remain disabled.

## Validation and device handoff

Passed: 14 backend provider/event tests, all three frontend test files, lint, typecheck, and the Expo web export. Playwright checks at a 390×844 mobile viewport passed live NFL/college source display, pagination, persisted league preference, missing-stat labels, and no horizontal overflow, with no page runtime errors. App reloads left provider usage unchanged. Simulated final-hour freshness and kickoff expiry also passed; these checks used explicitly simulated responses, not freshened production data.

This cloud workspace has no attached physical iPhone or iOS simulator. A web viewport cannot validate native rendering, foreground behavior on iOS, signing, or network access from a phone.

For the remaining physical-device check:

1. Run the backend on a development machine reachable from the phone, with keys only in server environment settings and suitable development access controls. Keep the cloud backend on loopback; it has no production user authentication.
2. Set the app's non-secret `EXPO_PUBLIC_RESEARCH_API_URL` to that reachable API address and restart Expo. A phone cannot use the development machine's `127.0.0.1`. The workspace's ignored `.env.local` uses loopback for web validation only.
3. Use an SDK 57-compatible Expo Go client or a signed development build, following https://docs.expo.dev/versions/v57.0.0/ and https://docs.expo.dev/develop/development-builds/introduction/.
4. In Games, inspect NFL and NCAAF, select a matched game, and compare its books, lines, prices, IDs, kickoff, provider update, and collection times with the API. Check missing college-stat labels, pagination, foreground refresh, stale/expired labels, and league persistence after relaunch.
5. Compare `/v1/providers` before and after app reloads; counts must remain unchanged. No additional provider collection is needed to check stale data.

Fresh collection is explicit and consumes quota. Use the existing CLI only when needed; old snapshots remain useful for checking honest stale labels. Passing this handoff completes the phone-specific portion, not a production launch or model validation.
