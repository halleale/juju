import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings-model';
import {
  INTEREST_KINDS,
  PROFILE_COLUMNS,
  profilePatch,
  resolveSignIn,
  settingsFromRemote,
  type InterestKey,
  type InterestRow,
  type ProfileRow,
} from '@/lib/settings-sync';
import { supabase } from '@/lib/supabase';
import { useAuth } from './auth';

export { DEFAULT_SETTINGS, type AlertToggles, type Settings } from '@/lib/settings-model';

type ListKey = 'sports' | 'betTypes' | 'teams' | 'tracked' | 'lineAlerts';

type Ctx = {
  settings: Settings;
  /** True once settings for the signed-in user have loaded (always true without an account). */
  hydrated: boolean;
  /** True when the signed-in user's settings could not be loaded; `retrySave` tries again. */
  loadFailed: boolean;
  /** Set when loading or saving failed. `retrySave` reloads or pushes everything again. */
  saveError: string | null;
  retrySave: () => void;
  update: (patch: Partial<Settings>) => void;
  toggleIn: <K extends ListKey>(key: K, value: Settings[K][number]) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

async function loadRemote(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const [profile, interests] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single<ProfileRow>(),
    supabase.from('user_interests').select('kind,value').returns<InterestRow[]>(),
  ]);
  if (profile.error) throw profile.error;
  if (interests.error) throw interests.error;
  return settingsFromRemote(profile.data, interests.data ?? []);
}

async function saveProfile(userId: string, patch: Partial<Settings>) {
  if (!supabase) return;
  const row = profilePatch(patch);
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}

async function saveInterests(key: InterestKey, values: string[]) {
  if (!supabase) return;
  const { error } = await supabase.rpc('set_interests', { p_kind: INTEREST_KINDS[key], p_values: values });
  if (error) throw error;
}

async function saveAll(userId: string, s: Settings) {
  await saveProfile(userId, {
    style: s.style,
    minEdge: s.minEdge,
    maxAlertsPerDay: s.maxAlertsPerDay,
    weeklyLimit: s.weeklyLimit,
    toggles: s.toggles,
    ageConfirmed: s.ageConfirmed,
    onboarded: s.onboarded,
  });
  await Promise.all((Object.keys(INTEREST_KINDS) as InterestKey[]).map((k) => saveInterests(k, s[k])));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session, enabled } = useAuth();
  const userId = session?.user.id ?? null;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** Result of the latest settings load, tagged with the user and attempt it belongs to. */
  const [load, setLoad] = useState<{ userId: string; attempt: number; ok: boolean } | null>(null);
  const latest = useRef(settings);
  useEffect(() => {
    latest.current = settings;
  }, [settings]);
  // Writes run one at a time so rapid taps reach the server in order.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const current = load && userId && load.userId === userId && load.attempt === reloadKey ? load : null;
  const hydrated = !enabled || !userId || current?.ok === true;
  const loadFailed = current?.ok === false;

  // On a user change, forget the last load; after sign-out, clear settings so the next person starts fresh.
  const [prevUser, setPrevUser] = useState(userId);
  if (prevUser !== userId) {
    setPrevUser(userId);
    setLoad(null);
    setSaveError(null);
    if (prevUser && !userId) setSettings(DEFAULT_SETTINGS);
  }

  // Load (or upload) settings when a user signs in.
  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await loadRemote(userId);
        const action = resolveSignIn(latest.current, remote);
        if (action === 'use_remote') {
          const merged = { ...latest.current, ...remote };
          latest.current = merged;
          setSettings(merged);
        } else if (action === 'upload_local') {
          await saveAll(userId, latest.current);
        }
        if (cancelled) return;
        setSaveError(null);
        setLoad({ userId, attempt: reloadKey, ok: true });
      } catch (e) {
        if (cancelled) return;
        setSaveError(e instanceof Error ? e.message : 'Could not load your settings');
        setLoad({ userId, attempt: reloadKey, ok: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, reloadKey]);

  const persist = useCallback(
    (run: (uid: string) => Promise<void>) => {
      // Never write before the account's settings have loaded, or local defaults could overwrite them.
      if (!userId || !current?.ok) return;
      queue.current = queue.current
        .then(() => run(userId))
        .then(() => setSaveError(null))
        .catch((e: unknown) => setSaveError(e instanceof Error ? e.message : 'Could not save your changes'));
    },
    [userId, current?.ok],
  );

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setSettings(next);
      // Finishing onboarding uploads everything picked so far.
      persist((uid) => (patch.onboarded ? saveAll(uid, next) : saveProfile(uid, patch)));
    },
    [persist],
  );

  const toggleIn = useCallback(
    <K extends ListKey>(key: K, value: Settings[K][number]) => {
      const list = latest.current[key] as string[];
      const nextList = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      const next = { ...latest.current, [key]: nextList };
      latest.current = next;
      setSettings(next);
      if (key in INTEREST_KINDS) persist(() => saveInterests(key as InterestKey, nextList));
    },
    [persist],
  );

  const retrySave = useCallback(() => {
    if (loadFailed) setReloadKey((k) => k + 1);
    else persist((uid) => saveAll(uid, latest.current));
  }, [loadFailed, persist]);

  const value = useMemo<Ctx>(
    () => ({ settings, hydrated, loadFailed, saveError, retrySave, update, toggleIn }),
    [settings, hydrated, loadFailed, saveError, retrySave, update, toggleIn],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
