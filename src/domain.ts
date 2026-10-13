import type { ResearchSnapshot } from './research';
export type Market = 'Moneyline' | 'Spread' | 'Total';
export type League = 'nfl' | 'ncaaf';
export type Outcome = 'win' | 'loss' | 'push' | 'void' | 'pending';
export type Pick = {
  id: string; away: string; home: string; kickoff: string; market: Market;
  selection: string; line: number | null; odds: number; book: string;
  win: number; push: number; evidence: string[]; risks: string[];
  status: 'active' | 'watching' | 'withdrawn' | 'settled';
  outcome: Outcome; version: string; research?: ResearchSnapshot; league?: League;
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
