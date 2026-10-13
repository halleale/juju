# Build plan

Goal: public iOS-first NFL research app; Android follows distribution review. Source requirements: uploaded NFL Betting Agent PRD dated October 12, 2026.

## Milestone 1 — local product prototype

Four destinations, recommendation details, exact-price questions, separate saved picks/manual bets, local persistence, transparent illustrative outcomes. Validate usability with prospective users. Current implementation is this milestone; it has no live feed or validated model.

## Milestone 2 — shared backend and real research

Python/FastAPI, PostgreSQL, object storage, managed jobs. Build provider adapters for odds, schedules/results, and authorized evidence. Normalize event IDs, market period, selection, line, book, and settlement rules. Preserve provider update, first available, ingestion, and analysis timestamps. Start with a small book set selected through user research.

Implement API contracts for slate, game analysis, exact-line quote evaluation, recommendation revisions, user preferences, saved picks, manual bets, history, and deletion. Move pricing and qualification authority to the server. The demo's local calculations are illustrative only.

Use chronological snapshots and append-only recommendation revisions. Keep status (active/watching/withdrawn/expired) separate from settlement (pending/win/loss/push/void). Grade actual bets at their actual lines. Idempotent ingestion and settlement corrections must preserve history.

Reconcile polling with quote freshness and feed budget: 15-minute collection cannot guarantee 5-minute quote eligibility. Recheck freshness at API response, app foreground, agent response, and notification time. Expire at kickoff. Do not substitute successful ingestion time for provider quote update time.

## Milestone 3 — model and contextual agent

Establish a de-vigged market baseline and a simple challenger. Model exact-line score distributions, integer push mass, and book-specific ties. Only use features that can be reconstructed at prediction time. Chronological splits grouped by game; freeze selection thresholds before final testing. Evaluate calibration, proper scoring, return with uncertainty, and same-line CLV. Shadow live predictions before promotion; human review and rollback required.

Add server-side tool-calling agent using the same pricing records and authorized evidence. Validate numerical claims against tool results, keep source links/timestamps, recheck current eligibility, and treat fetched text as data. Keep personalization separate from probabilities. No unsupervised model updates.

## Milestone 4 — private beta and public readiness

Managed auth, cross-device sync, production privacy/deletion controls, validated age/location policy, quiet hours and capped opt-in alerts, operational monitoring. Test 25–50 users over at least four NFL weeks; this evaluates usefulness and retention, not profitability. Validate accessibility and real iOS devices. Integrate subscriptions only after business/platform/payment eligibility and unit economics are confirmed.

Public release dependencies: approved provider display/storage/training rights; supported jurisdictions and distribution classification review; model qualification evidence; stale quote and settlement exception tests; agent factuality evaluation; privacy and security review; measured service targets. Research-only release can precede numerical recommendation approval if the actual product flow is eligible.

## Decisions to resolve next

Initial supported books and states, provider/historical data budget, model owner, acceptable uncertainty presentation, iOS developer account/build route, team capacity. No secret values should be committed or entered in chat; configure them through secure environment settings when integrations exist.
