import type { BetType, Sport, Style } from '@/data/types';
import type { AlertToggles, Settings } from './settings-model';

/** Mapping between app settings and the profiles / user_interests tables. */

export type ProfileRow = {
  style: Style;
  min_edge: number;
  max_alerts_per_day: number;
  alert_new_edges: boolean;
  alert_line_moves: boolean;
  alert_injuries: boolean;
  quiet_hours_enabled: boolean;
  weekly_limit: number | null;
  age_confirmed_at: string | null;
  terms_accepted_at: string | null;
  onboarded_at: string | null;
};

export type InterestKind = 'sport' | 'bet_type' | 'team' | 'player';
export type InterestRow = { kind: InterestKind; value: string };

export const PROFILE_COLUMNS = Object.keys({
  style: 0,
  min_edge: 0,
  max_alerts_per_day: 0,
  alert_new_edges: 0,
  alert_line_moves: 0,
  alert_injuries: 0,
  quiet_hours_enabled: 0,
  weekly_limit: 0,
  age_confirmed_at: 0,
  terms_accepted_at: 0,
  onboarded_at: 0,
} satisfies Record<keyof ProfileRow, 0>).join(',');

/** Settings keys stored as interests, and the kind each maps to. */
export const INTEREST_KINDS = { sports: 'sport', betTypes: 'bet_type', teams: 'team' } as const satisfies Partial<Record<keyof Settings, InterestKind>>;
export type InterestKey = keyof typeof INTEREST_KINDS;

const TOGGLE_COLUMNS: Record<keyof AlertToggles, keyof ProfileRow> = {
  edges: 'alert_new_edges',
  moves: 'alert_line_moves',
  injuries: 'alert_injuries',
  quiet: 'quiet_hours_enabled',
};

/** Profile columns to write for a settings change. Timestamps are stamped with `now`. */
export function profilePatch(patch: Partial<Settings>, now = new Date()): Partial<ProfileRow> {
  const out: Partial<ProfileRow> = {};
  if (patch.style !== undefined) out.style = patch.style;
  if (patch.minEdge !== undefined) out.min_edge = patch.minEdge;
  if (patch.maxAlertsPerDay !== undefined) out.max_alerts_per_day = patch.maxAlertsPerDay;
  if (patch.weeklyLimit !== undefined) out.weekly_limit = patch.weeklyLimit;
  if (patch.toggles) {
    for (const [k, col] of Object.entries(TOGGLE_COLUMNS) as [keyof AlertToggles, keyof ProfileRow][]) {
      (out as Record<string, unknown>)[col] = patch.toggles[k];
    }
  }
  const stamp = now.toISOString();
  if (patch.ageConfirmed) {
    out.age_confirmed_at = stamp;
    out.terms_accepted_at = stamp;
  }
  if (patch.onboarded) out.onboarded_at = stamp;
  return out;
}

/** Settings as stored remotely. Local-only fields (tracked picks for mock data) are not included. */
export function settingsFromRemote(profile: ProfileRow, interests: InterestRow[]): Partial<Settings> {
  const of = (kind: InterestKind) => interests.filter((i) => i.kind === kind).map((i) => i.value);
  return {
    onboarded: profile.onboarded_at !== null,
    ageConfirmed: profile.age_confirmed_at !== null,
    style: profile.style,
    minEdge: Number(profile.min_edge),
    maxAlertsPerDay: profile.max_alerts_per_day,
    weeklyLimit: profile.weekly_limit === null ? null : Number(profile.weekly_limit),
    toggles: {
      edges: profile.alert_new_edges,
      moves: profile.alert_line_moves,
      injuries: profile.alert_injuries,
      quiet: profile.quiet_hours_enabled,
    },
    sports: of('sport') as Sport[],
    betTypes: of('bet_type') as BetType[],
    teams: [...of('team'), ...of('player')],
  };
}

/**
 * Decides what to do after sign-in. An account that already finished onboarding wins,
 * so signing in on a new device restores it. Otherwise whatever the user picked
 * locally before signing in is uploaded.
 */
export function resolveSignIn(local: Settings, remote: Partial<Settings>): 'use_remote' | 'upload_local' | 'nothing' {
  if (remote.onboarded) return 'use_remote';
  if (local.onboarded) return 'upload_local';
  return 'nothing';
}
