import type { Result } from '@/lib/odds';

export type Sport = 'NFL' | 'MLB' | 'NHL' | 'NBA' | 'College FB' | 'Soccer' | 'Tennis' | 'Golf';
export type BetType = 'Spreads' | 'Totals' | 'Moneylines' | 'Player props' | 'Parlays' | 'Futures';
export type Style = 'conservative' | 'balanced' | 'longshot';
export type MarketType = 'spread' | 'total' | 'moneyline' | 'prop';
export type Confidence = 'High' | 'Medium' | 'Low';

export type Signal = { pro: boolean; title: string; detail: string };

export type Pick = {
  id: string;
  sport: Sport;
  marketType: MarketType;
  /** Display time, e.g. "Sun 1:00 PM". */
  time: string;
  away: string;
  home: string;
  /** The selection, e.g. "Under 47.5". */
  selection: string;
  modelProb: number;
  confidence: Confidence;
  why: string;
  signals: Signal[];
  /** Current price at each book for this selection. */
  books: { book: string; price: number }[];
  /** The line (or price, for moneylines) over time, oldest first. */
  line: { label: string; open: number; points: number[]; startLabel: string; nowLabel: string };
};

export type AlertKind = 'new_edge' | 'line_move' | 'pulled';

export type AlertItem = {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  ago: string;
  pickId?: string;
};

export type SettledPick = {
  id: string;
  sport: Sport;
  marketType: MarketType;
  label: string;
  date: string;
  alertPrice: number;
  closingPrice: number;
  result: Result;
};
