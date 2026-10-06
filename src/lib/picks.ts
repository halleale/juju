import type { BetType, MarketType, Pick, Sport, Style } from '@/data/types';
import { edgePts, impliedProb, isBetterPrice, probToAmerican } from './odds';

export const MARKET_LABEL: Record<MarketType, string> = {
  spread: 'Spread',
  total: 'Total',
  moneyline: 'Moneyline',
  prop: 'Player prop',
};

export const MARKET_BET_TYPE: Record<MarketType, BetType> = {
  spread: 'Spreads',
  total: 'Totals',
  moneyline: 'Moneylines',
  prop: 'Player props',
};

export const STYLE_LABEL: Record<Style, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  longshot: 'Long shots',
};

export function bestBook(pick: Pick) {
  return pick.books.reduce((best, b) => (isBetterPrice(b.price, best.price) ? b : best));
}

/** Books sorted best price first. */
export function booksByPrice(pick: Pick) {
  return [...pick.books].sort((a, b) => (isBetterPrice(a.price, b.price) ? -1 : isBetterPrice(b.price, a.price) ? 1 : 0));
}

/** Edge is always measured against the best available price. */
export function pickStats(pick: Pick) {
  const { price } = bestBook(pick);
  return {
    price,
    implied: impliedProb(price),
    edge: edgePts(pick.modelProb, price),
    fair: probToAmerican(pick.modelProb),
  };
}

export type Prefs = {
  sports: Sport[];
  betTypes: BetType[];
  teams: string[];
  style: Style;
};

/** Minimum edge (pts) a pick needs to appear in the feed for each style. */
export const STYLE_MIN_EDGE: Record<Style, number> = { conservative: 5, balanced: 3, longshot: 3 };

export function fitsStyle(pick: Pick, style: Style): boolean {
  const { price, edge } = pickStats(pick);
  if (edge < STYLE_MIN_EDGE[style]) return false;
  // Conservative: mostly favorites and totals, no props.
  if (style === 'conservative') return pick.marketType !== 'prop' && price < 100;
  // Long shots: plus-money prices and props.
  if (style === 'longshot') return price > 0 || pick.marketType === 'prop';
  return true;
}

/** Short names of teams in this pick the user follows. Team interests are stored as full names. */
function followedTeams(pick: Pick, teams: string[]): string[] {
  return [pick.away, pick.home].filter((t) => teams.some((full) => full === t || full.endsWith(` ${t}`)));
}

/**
 * Filters scored picks to the user's interests. A followed team always counts, even
 * if the bet type is not one they picked; the sport and style still have to fit.
 */
export function matchPicks(picks: Pick[], prefs: Prefs): (Pick & { matchReason: string })[] {
  return picks
    .filter((p) => prefs.sports.includes(p.sport) && fitsStyle(p, prefs.style))
    .flatMap((p) => {
      const followed = followedTeams(p, prefs.teams);
      if (followed.length) return [{ ...p, matchReason: `You follow the ${followed[0]}` }];
      if (!prefs.betTypes.includes(MARKET_BET_TYPE[p.marketType])) return [];
      if (p.marketType === 'prop') return [{ ...p, matchReason: 'You picked player props' }];
      return [{ ...p, matchReason: `${p.sport} · ${STYLE_LABEL[prefs.style]} style` }];
    })
    .sort((a, b) => pickStats(b).edge - pickStats(a).edge);
}

/** Suggested stake in units. */
export function suggestedUnits(style: Style): number {
  return style === 'longshot' ? 0.5 : 1;
}
