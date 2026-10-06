import { describe, expect, it } from 'vitest';

import { profilePatch, resolveSignIn, settingsFromRemote, type ProfileRow } from '@/lib/settings-sync';
import { DEFAULT_SETTINGS } from '@/lib/settings-model';

const NOW = new Date('2026-10-06T12:00:00Z');

const row: ProfileRow = {
  style: 'longshot',
  min_edge: 7,
  max_alerts_per_day: 3,
  alert_new_edges: true,
  alert_line_moves: false,
  alert_injuries: true,
  quiet_hours_enabled: true,
  weekly_limit: 50,
  age_confirmed_at: '2026-10-01T00:00:00Z',
  terms_accepted_at: '2026-10-01T00:00:00Z',
  onboarded_at: '2026-10-01T00:00:00Z',
};

describe('profilePatch', () => {
  it('maps only the fields that changed', () => {
    expect(profilePatch({ style: 'conservative' }, NOW)).toEqual({ style: 'conservative' });
    expect(profilePatch({ weeklyLimit: null }, NOW)).toEqual({ weekly_limit: null });
    expect(profilePatch({ tracked: ['x'] }, NOW)).toEqual({});
  });

  it('maps alert toggles to columns', () => {
    expect(profilePatch({ toggles: { edges: false, moves: true, injuries: false, quiet: true } }, NOW)).toEqual({
      alert_new_edges: false,
      alert_line_moves: true,
      alert_injuries: false,
      quiet_hours_enabled: true,
    });
  });

  it('stamps age confirmation, terms and onboarding', () => {
    expect(profilePatch({ ageConfirmed: true, onboarded: true }, NOW)).toEqual({
      age_confirmed_at: NOW.toISOString(),
      terms_accepted_at: NOW.toISOString(),
      onboarded_at: NOW.toISOString(),
    });
  });
});

describe('settingsFromRemote', () => {
  it('rebuilds settings from rows', () => {
    const s = settingsFromRemote({ ...row, min_edge: '7.0' as unknown as number }, [
      { kind: 'sport', value: 'NFL' },
      { kind: 'bet_type', value: 'Totals' },
      { kind: 'team', value: 'Buffalo Bills' },
      { kind: 'player', value: 'Josh Allen' },
    ]);
    expect(s).toMatchObject({
      onboarded: true,
      ageConfirmed: true,
      style: 'longshot',
      minEdge: 7,
      maxAlertsPerDay: 3,
      weeklyLimit: 50,
      toggles: { edges: true, moves: false, injuries: true, quiet: true },
      sports: ['NFL'],
      betTypes: ['Totals'],
      teams: ['Buffalo Bills', 'Josh Allen'],
    });
  });

  it('round-trips through profilePatch', () => {
    const s = settingsFromRemote(row, []);
    const back = profilePatch(s, NOW);
    expect(back).toMatchObject({ style: row.style, min_edge: row.min_edge, max_alerts_per_day: row.max_alerts_per_day, weekly_limit: row.weekly_limit, alert_line_moves: false });
  });
});

describe('resolveSignIn', () => {
  const fresh = { ...settingsFromRemote({ ...row, onboarded_at: null }, []) };

  it('restores an onboarded account on a new device', () => {
    expect(resolveSignIn(DEFAULT_SETTINGS, settingsFromRemote(row, []))).toBe('use_remote');
    expect(resolveSignIn({ ...DEFAULT_SETTINGS, onboarded: true }, settingsFromRemote(row, []))).toBe('use_remote');
  });

  it('uploads choices made before creating the account', () => {
    expect(resolveSignIn({ ...DEFAULT_SETTINGS, onboarded: true }, fresh)).toBe('upload_local');
  });

  it('does nothing when neither side has onboarded', () => {
    expect(resolveSignIn(DEFAULT_SETTINGS, fresh)).toBe('nothing');
  });
});
