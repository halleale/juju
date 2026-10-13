import type { Confidence, MarketType, Pick, Signal, Sport } from '@/data/types';
import { bookLabel } from '@/pipeline/books';
import { formatAmerican, isBetterPrice, winUnits } from './odds';

/** One row of `feed_picks().picks`. Numerics arrive as numbers or strings depending on the driver. */
export type FeedRow = {
  id: number;
  sport: string;
  home: string;
  away: string;
  start_time: string;
  type: MarketType;
  selection: string;
  line: number | string | null;
  current_prob: number | string;
  current_edge: number | string;
  confidence: Confidence;
  why: string | null;
  signals: Signal[];
  open_price: number;
  created_at: string;
  books: { book: string; price: number }[];
};

export type HistoryRow = { book: string; price: number; captured_at: string };

/** Nicknames that are two words, so "Boston Red Sox" shortens to "Red Sox", not "Sox". */
const TWO_WORD = ['Red Sox', 'White Sox', 'Blue Jays', 'Maple Leafs', 'Golden Knights', 'Blue Jackets', 'Red Wings', 'Trail Blazers'];

export function shortTeam(name: string): string {
  const two = TWO_WORD.find((n) => name.endsWith(` ${n}`));
  if (two) return two;
  const words = name.trim().split(/\s+/);
  return words[words.length - 1];
}

function signedLine(line: number): string {
  if (line === 0) return 'PK';
  return line > 0 ? `+${line}` : `${line}`;
}

export function selectionLabel(type: MarketType, selection: string, line: number | null): string {
  if (type === 'total') return `${selection} ${line}`;
  if (selection === 'Draw') return 'Draw';
  if (type === 'spread' && line !== null) return `${shortTeam(selection)} ${signedLine(line)}`;
  return `${shortTeam(selection)} ML`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clock(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Tonight 8:15 PM", "Tomorrow 1:00 PM", "Sun 4:25 PM" or "Oct 26 1:00 PM", in local time. */
export function kickoffLabel(start: Date, now: Date): string {
  const days = Math.round((dayStart(start) - dayStart(now)) / 86_400_000);
  if (days === 0) return `${start.getHours() >= 17 ? 'Tonight' : 'Today'} ${clock(start)}`;
  if (days === 1) return `Tomorrow ${clock(start)}`;
  if (days > 1 && days < 7) return `${DAYS[start.getDay()]} ${clock(start)}`;
  return `${MONTHS[start.getMonth()]} ${start.getDate()} ${clock(start)}`;
}

/** Ordered so it can be plotted: bigger is a better price for the bettor. */
const priceScale = winUnits;

/**
 * Best available price over time from stored snapshots, starting at `since` (prices from
 * before then carry forward into the first point). Each book's latest price carries
 * forward until it changes; consecutive repeats are collapsed.
 */
export function bestPriceSeries(history: HistoryRow[], since?: Date): number[] {
  const from = since?.getTime() ?? -Infinity;
  const latest = new Map<string, number>();
  const out: number[] = [];
  const best = () => [...latest.values()].reduce((a, b) => (isBetterPrice(b, a) ? b : a));
  const push = (p: number) => out[out.length - 1] !== p && out.push(p);
  const rows = [...history].sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at));
  rows.forEach((r, i) => {
    const at = Date.parse(r.captured_at);
    if (at >= from && out.length === 0 && latest.size > 0) push(best());
    latest.set(r.book, r.price);
    if (at < from || (rows[i + 1] && Date.parse(rows[i + 1].captured_at) === at)) return;
    push(best());
  });
  if (out.length === 0 && latest.size > 0) push(best());
  return out;
}

/** Maps a feed row to the app's Pick. Returns null for a pick no book is quoting right now. */
export function pickFromRow(row: FeedRow, now: Date): Pick | null {
  if (row.books.length === 0) return null;
  const line = row.line === null ? null : Number(row.line);
  const books = row.books.map((b) => ({ book: bookLabel(b.book), price: b.price }));
  const best = books.reduce((a, b) => (isBetterPrice(b.price, a.price) ? b : a));
  const start = new Date(row.start_time);
  return {
    id: String(row.id),
    sport: row.sport as Sport,
    marketType: row.type,
    time: kickoffLabel(start, now),
    away: shortTeam(row.away),
    home: shortTeam(row.home),
    selection: selectionLabel(row.type, row.selection, line),
    modelProb: Number(row.current_prob),
    confidence: row.confidence,
    why: row.why ?? `The best price is better than the de-vigged consensus of ${books.length} books.`,
    signals: row.signals ?? [],
    books,
    openedAt: row.created_at,
    line: priceLine([row.open_price, best.price], new Date(row.created_at), now),
  };
}

/** Price movement for the detail chart, from the pick opening to now. */
export function priceLine(prices: number[], opened: Date, now: Date): Pick['line'] {
  const points = prices.length > 1 ? prices : [prices[0], prices[0]];
  return {
    label: 'Price',
    open: points[0],
    points: points.map(priceScale),
    startLabel: `Opened ${kickoffLabel(opened, now).replace(/^(Tonight|Today) /, '')}`,
    nowLabel: formatAmerican(points[points.length - 1]),
  };
}
