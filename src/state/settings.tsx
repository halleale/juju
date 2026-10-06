import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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
  tracked: string[];
  lineAlerts: string[];
};

const DEFAULTS: Settings = {
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

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  toggleIn: <K extends 'sports' | 'betTypes' | 'teams' | 'tracked' | 'lineAlerts'>(key: K, value: Settings[K][number]) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

/** In-memory for now; build step 2 moves this to the user's account (users + user_interests). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const value = useMemo<Ctx>(
    () => ({
      settings,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      toggleIn: (key, value) =>
        setSettings((s) => {
          const list = s[key] as string[];
          return { ...s, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
        }),
    }),
    [settings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
