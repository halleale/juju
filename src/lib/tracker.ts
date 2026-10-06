import type { MarketType, SettledPick } from '@/data/types';
import { beatClose, settleUnits } from './odds';

export type Summary = {
  wins: number;
  losses: number;
  pushes: number;
  units: number;
  /** Units won per unit risked. Pushes return the stake, so they are not counted as risked. */
  roi: number;
  /** Share of picks whose alert price beat the closing price. */
  clv: number;
  count: number;
};

export function summarize(picks: SettledPick[]): Summary {
  const wins = picks.filter((p) => p.result === 'win').length;
  const losses = picks.filter((p) => p.result === 'loss').length;
  const pushes = picks.filter((p) => p.result === 'push').length;
  const units = picks.reduce((sum, p) => sum + settleUnits(p.alertPrice, p.result), 0);
  const risked = wins + losses;
  const beat = picks.filter((p) => beatClose(p.alertPrice, p.closingPrice)).length;
  return {
    wins,
    losses,
    pushes,
    units,
    roi: risked ? units / risked : 0,
    clv: picks.length ? beat / picks.length : 0,
    count: picks.length,
  };
}

export function byMarketType(picks: SettledPick[]): { type: MarketType; summary: Summary }[] {
  const types: MarketType[] = ['spread', 'total', 'moneyline', 'prop'];
  return types
    .map((type) => ({ type, summary: summarize(picks.filter((p) => p.marketType === type)) }))
    .filter((r) => r.summary.count > 0);
}

export function formatRecord(s: Summary): string {
  return s.pushes ? `${s.wins}-${s.losses}-${s.pushes}` : `${s.wins}-${s.losses}`;
}
