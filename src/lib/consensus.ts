import { impliedProb, noVig } from './odds.ts';

/**
 * v1 market-based model: a consensus fair probability built from the no-vig prices
 * across books, weighting sharper books more. A book's price that beats this
 * consensus is an edge.
 */

export type BookQuote = {
  book: string;
  /** American price for each side of the market, in the same order across books. */
  prices: number[];
};

export function consensusFair(quotes: BookQuote[], weights: Record<string, number> = {}): number[] {
  if (quotes.length === 0) throw new Error('Need at least one quote');
  const sides = quotes[0].prices.length;
  const sums = new Array<number>(sides).fill(0);
  let totalWeight = 0;
  for (const q of quotes) {
    if (q.prices.length !== sides) throw new Error(`Book ${q.book} has the wrong number of sides`);
    const w = weights[q.book] ?? 1;
    noVig(q.prices).forEach((p, i) => (sums[i] += p * w));
    totalWeight += w;
  }
  return sums.map((s) => s / totalWeight);
}

export type ScoredSide = {
  side: number;
  fairProb: number;
  bestBook: string;
  bestPrice: number;
  /** Percentage points. */
  edge: number;
};

/** Scores every side of a market against the consensus at its best available price. */
export function scoreMarket(quotes: BookQuote[], weights: Record<string, number> = {}): ScoredSide[] {
  const fair = consensusFair(quotes, weights);
  return fair.map((fairProb, side) => {
    let best = quotes[0];
    for (const q of quotes) if (impliedProb(q.prices[side]) < impliedProb(best.prices[side])) best = q;
    const bestPrice = best.prices[side];
    return { side, fairProb, bestBook: best.book, bestPrice, edge: (fairProb - impliedProb(bestPrice)) * 100 };
  });
}
