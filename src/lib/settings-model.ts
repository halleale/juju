import type { BetType, Sport, Style } from '@/data/types';

export type AlertToggles = { edges: boolean; moves: boolean; injuries: boolean; quiet: boolean };

export type Settings = {
  onboarded: boolean;
  ageConfirmed: boolean;
  sports: Sport[];
  betTypes: BetType[];
  /** Full team or player names. */
  teams: string[];
  style: Style;
  /** Minimum edge in points before an alert is sent. */
  minEdge: number;
  maxAlertsPerDay: number;
  toggles: AlertToggles;
  /** Weekly budget in dollars; null means no limit set. */
  weeklyLimit: number | null;
  /** Local only until picks come from the database (build step 3). */
  tracked: string[];
  lineAlerts: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  ageConfirmed: false,
  sports: ['NFL', 'MLB', 'NHL'],
  betTypes: ['Spreads', 'Totals', 'Player props'],
  teams: ['Buffalo Bills', 'New York Rangers'],
  style: 'balanced',
  minEdge: 5,
  maxAlertsPerDay: 5,
  toggles: { edges: true, moves: true, injuries: true, quiet: false },
  weeklyLimit: null,
  tracked: [],
  lineAlerts: [],
};
