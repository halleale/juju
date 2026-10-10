import { scoreMarket, type BookQuote } from '../lib/consensus.ts';
import { formatAmerican, impliedProb } from '../lib/odds.ts';
import { bookLabel } from './books.ts';
import type { PipelineMarketType, ProviderEvent, Quote } from './types.ts';

/** Sharper books count more in the consensus. Every other book weighs 1. */
export const BOOK_WEIGHTS: Record<string, number> = { pinnacle: 3, lowvig: 1.5, betonlineag: 1.5 };
export const SHARP_BOOK = 'pinnacle';

export const SCORE_DEFAULTS = {
  /** A market needs this many books quoting every side before it is scored. */
  minBooks: 3,
  /** New picks need at least this edge (pts). Matches the lowest alert setting in the app. */
  minEdge: 3,
  /** An active pick is pulled once its edge drops below this, so picks do not flicker. */
  keepEdge: 1.5,
  /** Bigger edges against a market consensus are almost always stale or bad prices. */
  maxEdge: 15,
};

export type Confidence = 'High' | 'Medium' | 'Low';

export type ScoredPick = {
  eventExternalId: string;
  type: PipelineMarketType;
  selection: string;
  line: number | null;
  modelProb: number;
  impliedProb: number;
  bestBook: string;
  bestPrice: number;
  /** Percentage points. */
  edge: number;
  confidence: Confidence;
  /** Books in the consensus. */
  books: number;
  signals: { pro: boolean; title: string; detail: string }[];
};

type Side = { selection: string; line: number | null };
type Group = { type: PipelineMarketType; sides: Side[]; quotes: BookQuote[] };

/**
 * Groups an event's quotes into two- or three-way markets. A book is only included in a
 * market when it quotes every side at the same line, so its prices can be de-vigged.
 */
export function groupMarkets(event: ProviderEvent): Group[] {
  const byBook = new Map<string, Quote[]>();
  for (const q of event.quotes) byBook.set(q.book, [...(byBook.get(q.book) ?? []), q]);

  const groups = new Map<string, Group>();
  const add = (key: string, type: PipelineMarketType, sides: Side[], book: string, prices: number[]) => {
    const g = groups.get(key) ?? { type, sides, quotes: [] };
    g.quotes.push({ book, prices });
    groups.set(key, g);
  };

  for (const [book, quotes] of byBook) {
    const find = (type: PipelineMarketType, selection: string, line: number | null) =>
      quotes.find((q) => q.type === type && q.selection === selection && q.line === line);

    const away = find('moneyline', event.away, null);
    const home = find('moneyline', event.home, null);
    const draw = find('moneyline', 'Draw', null);
    if (away && home) {
      const sides = [away, home, ...(draw ? [draw] : [])];
      add(`moneyline:${sides.length}`, 'moneyline', sides.map(({ selection, line }) => ({ selection, line })), book, sides.map((q) => q.price));
    }

    for (const h of quotes.filter((q) => q.type === 'spread' && q.selection === event.home)) {
      const a = find('spread', event.away, h.line === null ? null : -h.line || 0);
      if (a) add(`spread:${h.line}`, 'spread', [{ selection: a.selection, line: a.line }, { selection: h.selection, line: h.line }], book, [a.price, h.price]);
    }

    for (const o of quotes.filter((q) => q.type === 'total' && q.selection === 'Over')) {
      const u = find('total', 'Under', o.line);
      if (u) add(`total:${o.line}`, 'total', [{ selection: 'Over', line: o.line }, { selection: 'Under', line: o.line }], book, [o.price, u.price]);
    }
  }
  return [...groups.values()];
}

export function confidenceFor(books: string[]): Confidence {
  const sharp = books.includes(SHARP_BOOK);
  if (sharp && books.length >= 6) return 'High';
  if (sharp || books.length >= 4) return 'Medium';
  return 'Low';
}

function pct(p: number) {
  return `${(p * 100).toFixed(1)}%`;
}

/** Every side of every market with enough books, scored against the weighted no-vig consensus. */
export function scoreEvent(event: ProviderEvent, minBooks = SCORE_DEFAULTS.minBooks): ScoredPick[] {
  return groupMarkets(event).flatMap((g) => {
    if (g.quotes.length < minBooks) return [];
    const books = g.quotes.map((q) => q.book);
    const confidence = confidenceFor(books);
    return scoreMarket(g.quotes, BOOK_WEIGHTS).map((s) => {
      const side = g.sides[s.side];
      const implied = impliedProb(s.bestPrice);
      const signals: ScoredPick['signals'] = [
        {
          pro: s.edge > 0,
          title: 'Best price vs. market consensus',
          detail: `${books.length} books de-vigged and averaged put this at ${pct(s.fairProb)}. ${formatAmerican(s.bestPrice)} at ${bookLabel(s.bestBook)} implies ${pct(implied)}.`,
        },
      ];
      if (!books.includes(SHARP_BOOK)) {
        signals.push({ pro: false, title: 'No sharp book in the consensus', detail: 'Pinnacle did not quote this market, so the fair price leans on retail books.' });
      }
      return {
        eventExternalId: event.externalId,
        type: g.type,
        selection: side.selection,
        line: side.line,
        modelProb: s.fairProb,
        impliedProb: implied,
        bestBook: s.bestBook,
        bestPrice: s.bestPrice,
        edge: s.edge,
        confidence,
        books: books.length,
        signals,
      };
    });
  });
}

/**
 * Splits scored sides into picks to open (edge at or above minEdge) and markets whose
 * active pick should stay open (edge at or above keepEdge). Edges above maxEdge are
 * treated as bad data and dropped from both.
 */
export function selectPicks(scored: ScoredPick[], opts: Partial<typeof SCORE_DEFAULTS> = {}) {
  const { minEdge, keepEdge, maxEdge } = { ...SCORE_DEFAULTS, ...opts };
  const sane = scored.filter((s) => s.edge <= maxEdge);
  return { create: sane.filter((s) => s.edge >= minEdge), keep: sane.filter((s) => s.edge >= keepEdge) };
}
