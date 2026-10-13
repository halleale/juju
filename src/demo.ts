import type { Pick } from './domain';

// Fictional fixtures. Dates are deliberately fixed; no quote is represented as live.
const fixtures: Pick[] = [
  { id: 'demo-1', away: 'Buffalo', home: 'Kansas City', kickoff: '2026-11-15T21:25:00Z', market: 'Moneyline', selection: 'Buffalo', line: null, odds: 110, book: 'DraftKings', win: 0.5, push: 0, status: 'active', outcome: 'pending', version: 'demo-v1', evidence: ['Sample model balances opponent-adjusted efficiency and venue.', 'At +110, a 50% win probability implies a 5% expected return.'], risks: ['A small probability error can erase the estimated value.', 'Quarterback availability and the price must be verified.'] },
  { id: 'demo-2', away: 'Detroit', home: 'Green Bay', kickoff: '2026-11-15T18:00:00Z', market: 'Spread', selection: 'Detroit', line: 3, odds: -110, book: 'FanDuel', win: 0.51, push: 0.04, status: 'active', outcome: 'pending', version: 'demo-v1', evidence: ['Sample margin distribution includes a 4% push probability at +3.', 'This analysis applies only to +3, not +2.5 or +3.5.'], risks: ['A different spread requires a new probability estimate.', 'Related bets on this matchup would be correlated.'] },
  { id: 'demo-3', away: 'Seattle', home: 'San Francisco', kickoff: '2026-11-16T01:20:00Z', market: 'Total', selection: 'Under', line: 45.5, odds: -105, book: 'BetMGM', win: 0.54, push: 0, status: 'watching', outcome: 'pending', version: 'demo-v1', evidence: ['This example is paused while a critical input is unresolved.'], risks: ['Quarterback availability is unresolved in this fictional scenario.'] },
  { id: 'demo-4', away: 'Baltimore', home: 'Cincinnati', kickoff: '2026-09-20T17:00:00Z', market: 'Moneyline', selection: 'Baltimore', line: null, odds: 105, book: 'DraftKings', win: 0.51, push: 0, status: 'settled', outcome: 'loss', version: 'demo-v1', evidence: ['Original fictional analysis is retained after settlement.'], risks: ['Estimated advantage does not guarantee a win.'] },
  { id: 'demo-5', away: 'Philadelphia', home: 'Dallas', kickoff: '2026-09-20T20:25:00Z', market: 'Spread', selection: 'Philadelphia', line: -3, odds: -110, book: 'FanDuel', win: 0.53, push: 0.04, status: 'settled', outcome: 'push', version: 'demo-v1', evidence: ['Illustrative final margin equals the spread: stake returned.'], risks: ['Book rules determine settlement.'] },
  { id: 'demo-6', away: 'Los Angeles', home: 'Arizona', kickoff: '2026-09-20T20:25:00Z', market: 'Total', selection: 'Over', line: 44.5, odds: -110, book: 'BetMGM', win: 0.55, push: 0, status: 'withdrawn', outcome: 'win', version: 'demo-v1', evidence: ['Published sample pick withdrawn after a line change. Original quote retained.'], risks: ['Withdrawn picks remain in the original published cohort.'] },
  { id: 'college-demo-1', league: 'ncaaf', away: 'Oregon', home: 'Ohio State', kickoff: '2026-11-14T20:30:00Z', market: 'Moneyline', selection: 'Oregon', line: null, odds: 110, book: 'DraftKings', win: .5, push: 0, status: 'active', outcome: 'pending', version: 'demo-v1', evidence: ['Fictional FBS example, not an actual schedule or prediction.'], risks: ['College player availability is not verified.'] },
  { id: 'college-demo-2', league: 'ncaaf', away: 'Georgia', home: 'Alabama', kickoff: '2026-11-14T23:00:00Z', market: 'Spread', selection: 'Georgia', line: 3, odds: -110, book: 'FanDuel', win: .51, push: .04, status: 'active', outcome: 'pending', version: 'demo-v1', evidence: ['Fictional exact-line FBS spread example.'], risks: ['Roster turnover and opponent strength need validated inputs.'] },
  { id: 'college-demo-3', league: 'ncaaf', away: 'Texas', home: 'LSU', kickoff: '2026-11-15T01:00:00Z', market: 'Total', selection: 'Under', line: 52.5, odds: -105, book: 'BetMGM', win: .54, push: 0, status: 'watching', outcome: 'pending', version: 'demo-v1', evidence: ['Fictional FBS example waiting on a critical input.'], risks: ['Unconfirmed quarterback availability.'] },
];

export const picks: Pick[] = fixtures.map(pick => {
  const analyzedAt = pick.outcome === 'pending' ? '2026-10-12T20:00:00Z' : new Date(Date.parse(pick.kickoff) - 1800000).toISOString();
  const factor = pick.market === 'Moneyline'
    ? { title: 'Opponent-adjusted efficiency', observation: 'Fictional fixture: the selected team rates slightly higher after opponent adjustment.', relevance: 'Efficiency could inform win probability beyond a raw win-loss record. This demo does not establish an actual model contribution.' }
    : pick.market === 'Spread'
      ? { title: 'Exact-line score distribution', observation: `Fictional fixture: ${(pick.push * 100).toFixed(0)}% probability mass lands exactly on the selected spread.`, relevance: 'An integer spread can push. Moving a half-point changes which outcomes win, lose, or push.' }
      : { title: 'Possession and scoring distribution', observation: 'Fictional fixture: the authored probability favors the selected total at this exact line.', relevance: 'Pace and scoring efficiency would inform a full-game points distribution; win predictions alone cannot price totals.' };
  return { ...pick, research: {
    id: `${pick.id}-snapshot-1`, analyzedAt, quoteUpdatedAt: analyzedAt, quoteIngestedAt: analyzedAt,
    modelValidated: false, winRange: [Math.max(0, pick.win - .04), Math.min(1 - pick.push, pick.win + .04)],
    qualification: { minimumEdge: .02, validated: false, version: 'illustrative-rule-v1' },
    sources: [
      { id: `${pick.id}-performance`, name: 'Authored performance scenario', kind: 'sample', observedAt: analyzedAt, ingestedAt: analyzedAt, reference: 'src/demo.ts · fictional fixture; no provider or trained model' },
      { id: `${pick.id}-availability`, name: 'Authored availability scenario', kind: 'sample', observedAt: analyzedAt, ingestedAt: analyzedAt, reference: 'src/demo.ts · fictional availability, not an injury report' },
    ],
    factors: [
      { id: 'performance', ...factor, direction: 'supports', status: 'confirmed', modelUse: 'input', sourceIds: [`${pick.id}-performance`], invalidatedBy: 'A corrected input or a different line requires recomputing the probability.', critical: false },
      { id: 'availability', title: 'Quarterback availability', observation: pick.status === 'watching' ? 'This fictional scenario leaves quarterback status unresolved.' : 'This fictional scenario assumes the expected quarterback is available; no real report has been checked.', relevance: 'A quarterback change can materially alter scoring and win probabilities.', direction: 'opposes', status: pick.status === 'watching' ? 'unresolved' : 'confirmed', modelUse: 'context', sourceIds: [`${pick.id}-availability`], invalidatedBy: 'Do not publish while a critical availability assumption is unresolved.', critical: true },
    ],
  } };
});
