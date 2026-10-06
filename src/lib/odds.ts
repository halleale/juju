/** American odds helpers. All probabilities are 0..1. */

export function impliedProb(american: number): number {
  if (american === 0) throw new Error('American odds cannot be 0');
  return american < 0 ? -american / (-american + 100) : 100 / (american + 100);
}

/** Converts a probability back to American odds, rounded to the nearest whole number. */
export function probToAmerican(p: number): number {
  if (p <= 0 || p >= 1) throw new Error('Probability must be between 0 and 1');
  return p >= 0.5 ? -Math.round((p / (1 - p)) * 100) : Math.round(((1 - p) / p) * 100);
}

/** Normalizes the implied probabilities of every side of a market so they sum to 1. */
export function noVig(prices: number[]): number[] {
  const raw = prices.map(impliedProb);
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((p) => p / total);
}

/** Edge in percentage points: model probability minus the implied probability of the price. */
export function edgePts(modelProb: number, american: number): number {
  return (modelProb - impliedProb(american)) * 100;
}

/** Profit in units on a 1 unit stake if the bet wins. */
export function winUnits(american: number): number {
  return american < 0 ? 100 / -american : american / 100;
}

export type Result = 'win' | 'loss' | 'push';

export function settleUnits(american: number, result: Result): number {
  if (result === 'win') return winUnits(american);
  if (result === 'loss') return -1;
  return 0;
}

/** A higher (more favorable) American price for the bettor. -105 beats -110, +150 beats +140. */
export function isBetterPrice(a: number, b: number): boolean {
  return winUnits(a) > winUnits(b);
}

/** Closing-line value: did the price at alert time beat the final pre-game price? */
export function beatClose(alertPrice: number, closingPrice: number): boolean {
  return isBetterPrice(alertPrice, closingPrice);
}

export function formatAmerican(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}

export function formatPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function formatSigned(n: number, digits = 1): string {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}
