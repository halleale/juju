export type Market = 'Moneyline' | 'Spread' | 'Total';
export type Outcome = 'win' | 'loss' | 'push' | 'void' | 'pending';
export type Pick = {
  id: string; away: string; home: string; kickoff: string; market: Market;
  selection: string; line: number | null; odds: number; book: string;
  win: number; push: number; evidence: string[]; risks: string[];
  status: 'active' | 'watching' | 'withdrawn' | 'settled';
  outcome: Outcome; version: string;
};
export type ManualBet = { id: string; pickId: string; book: string; odds: number; line: number | null; stake: number | null; recordedAt: string };
export const BOOKS = ['DraftKings', 'FanDuel', 'BetMGM'];
export function validOdds(odds: number) { return Number.isFinite(odds) && Number.isInteger(odds) && Math.abs(odds) >= 100; }
export function decimalOdds(odds: number) {
  if (!validOdds(odds)) throw new Error('Enter whole American odds of +100 or higher, or -100 or lower.');
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds;
}
export function price(win: number, push: number, odds: number) {
  if (!Number.isFinite(win) || !Number.isFinite(push) || win < 0 || push < 0 || win + push > 1 || push === 1) throw new Error('Invalid outcome probabilities.');
  const decimal = decimalOdds(odds);
  const loss = 1 - win - push;
  return { breakEven: 1 / decimal, conditionalWin: win / (1 - push), edge: win / (1 - push) - 1 / decimal, expectedReturn: win * (decimal - 1) - loss };
}
export const american = (odds: number) => odds > 0 ? `+${odds}` : `${odds}`;
export function validateBet(input: { book: string; odds: string; line: string; stake: string }, market: Market) {
  if (!BOOKS.includes(input.book)) throw new Error('Select a supported sportsbook.');
  const odds = Number(input.odds);
  decimalOdds(odds);
  const line = market === 'Moneyline' ? null : Number(input.line);
  if (market !== 'Moneyline' && (!input.line.trim() || !Number.isFinite(line) || (line! * 2) % 1 !== 0 || (market === 'Total' && line! <= 0))) throw new Error('Enter a valid line in whole or half points.');
  const stake = input.stake.trim() ? Number(input.stake) : null;
  if (stake !== null && (!Number.isFinite(stake) || stake <= 0)) throw new Error('Stake must be positive, or left blank.');
  return { book: input.book, odds, line, stake };
}
export function eligible(pick: Pick, now: number, receivedAt: number) {
  const kickoff = Date.parse(pick.kickoff);
  const limit = kickoff - now <= 60 * 60 * 1000 ? 2 * 60 * 1000 : 5 * 60 * 1000;
  return pick.status === 'active' && now < kickoff && now >= receivedAt && now - receivedAt <= limit;
}
export function agentReply(pick: Pick, question: string) {
  if (/parlay|prop|teaser|live bet/i.test(question)) return 'This prototype covers pregame moneylines, main spreads, and full-game totals. That market is outside the current scope.';
  if (/recover|chase|win back|lost money/i.test(question)) return 'A previous loss does not change this game’s probabilities. Take a break if useful; this app does not recommend larger stakes or loss-recovery strategies.';
  if (/injur|weather|current|latest/i.test(question)) return 'Live injury, weather, and sportsbook feeds are not connected. I cannot verify current facts or quotes. The evidence below is fictional demonstration data.';
  const match = question.match(/(?:at\s*)?([+-]\d{3,4})\b/i);
  let odds = pick.odds;
  if (match) odds = Number(match[1]);
  if (!validOdds(odds)) return 'Enter valid American odds, for example +110 or -125.';
  const result = price(pick.win, pick.push, odds);
  return `Demo decision: ${pick.status === 'watching' ? 'wait for missing evidence' : result.expectedReturn > 0 ? 'positive estimated return in this fictional example' : 'pass at this price'}.\n\nExact quote: ${pick.selection}${pick.line !== null ? ` (${pick.line})` : ''} at ${american(odds)}. ${match ? 'User-supplied price; availability is unverified.' : 'Fictional sportsbook quote.'}\n\nExpected return: ${(result.expectedReturn * 100).toFixed(1)}% per unit. This is illustrative, not a validated edge or a live recommendation.\n\nEvidence: ${pick.evidence[0]}\n\nMain risk: ${pick.risks[0]}\n\nFreshness and sources: static sample dataset, demo-v1. No live feed or external sources connected.`;
}
