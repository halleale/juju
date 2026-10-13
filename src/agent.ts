import { american, validOdds } from './domain.ts';
import type { Pick } from './domain.ts';
import { analyze, priceExplanation } from './analysis.ts';

export function agentReply(pick: Pick, question: string, now = Date.now()) {
  if (/parlay|prop|teaser|live bet/i.test(question)) return 'This prototype covers pregame moneylines, main spreads, and full-game totals. That market is outside the current scope.';
  if (/recover|chase|win back|lost money/i.test(question)) return 'A previous loss does not change this game’s probabilities. Take a break if useful; this app does not recommend larger stakes or loss-recovery strategies.';
  if (/injur|weather|current|latest/i.test(question)) return 'Live injury, weather, and sportsbook feeds are not connected. I cannot verify current facts or quotes. The research snapshots are fictional demonstration data.';
  if (/spread|line|total|over|under/i.test(question) && /[+-]?\d+(?:\.\d+)?/.test(question)) return 'A changed line requires a new evaluation. Ask about American odds at the original line, or use the price checker to specify both line and odds.';
  const match = question.match(/([+-]\d+(?:\.\d+)?)\b/);
  const odds = match ? Number(match[1]) : pick.odds;
  if (!validOdds(odds)) return 'Enter valid American odds, for example +110 or -125.';
  const result = analyze(pick, now, { odds, line: pick.line, source: match ? 'user' : 'stored' });
  if (!result.pricing) return `No recommendation. ${result.blockers.join(' ')}`;
  const factors = pick.research?.factors || [];
  const support = factors.filter(f => f.direction === 'supports').map(f => `${f.title}: ${f.observation} Why it matters: ${f.relevance} [${f.sourceIds.join(', ')}]`).join('\n') || 'No traceable supporting evidence is available.';
  const risk = factors.filter(f => f.direction === 'opposes').map(f => `${f.title}: ${f.observation} [${f.sourceIds.join(', ')}]`).join('\n') || 'Counterevidence has not been documented; that is an evidence gap.';
  return `Demo decision: ${result.pricing && result.pricing.expectedReturn <= 0 ? 'pass at this price' : 'no actionable recommendation'}.\n\nExact quote: ${pick.selection}${pick.line !== null ? ` (${pick.line})` : ''} at ${american(odds)}. ${match ? 'User-supplied price; availability is unverified.' : 'Fictional sportsbook quote.'}\n\nWhy this price: ${priceExplanation(pick, odds)}\n\nSupporting evidence:\n${support}\n\nOpposing evidence:\n${risk}\n\nReasons to pass or wait:\n${result.blockers.map(b => `• ${b}`).join('\n')}\n\nFreshness and sources: ${pick.research?.analyzedAt || 'unknown'}; snapshot ${pick.research?.id || 'missing'}; model ${pick.version}. All demo sources are authored fixtures, not live facts.`;
}
