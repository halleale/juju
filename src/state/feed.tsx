import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { MARKETS_SCANNED, PICKS } from '@/data/mock';
import type { Pick } from '@/data/types';
import { bestPriceSeries, pickFromRow, priceLine, type FeedRow, type HistoryRow } from '@/lib/feed';
import { bestBook } from '@/lib/picks';
import { supabase } from '@/lib/supabase';
import { useAuth } from './auth';

/** How often the feed refreshes while the app is open. The pipeline polls at most every 5 minutes. */
const REFRESH_MS = 2 * 60_000;

type FeedCtx = {
  picks: Pick[];
  marketsScanned: number;
  /** False in demo mode or when signed out: picks are sample data. */
  live: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const FeedContext = createContext<FeedCtx | null>(null);

async function loadFeed(): Promise<{ picks: Pick[]; marketsScanned: number }> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('feed_picks');
  if (error) throw error;
  const body = data as { markets_scanned: number; picks: FeedRow[] };
  const now = new Date();
  return {
    picks: body.picks.map((r) => pickFromRow(r, now)).filter((p): p is Pick => p !== null),
    marketsScanned: Number(body.markets_scanned),
  };
}

export function FeedProvider({ children }: { children: ReactNode }) {
  const { enabled, session } = useAuth();
  const live = enabled && session !== null;
  const [state, setState] = useState<{ picks: Pick[]; marketsScanned: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Forget the last user's feed on sign-out.
  const [prevLive, setPrevLive] = useState(live);
  if (prevLive !== live) {
    setPrevLive(live);
    setState(null);
    setError(null);
  }

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    loadFeed()
      .then((next) => {
        if (cancelled) return;
        setState(next);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load picks'));
    return () => {
      cancelled = true;
    };
  }, [live, tick]);

  // Refresh on an interval and when the app comes back to the foreground.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(refresh, REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [live, refresh]);

  const value = useMemo<FeedCtx>(
    () =>
      live
        ? { picks: state?.picks ?? [], marketsScanned: state?.marketsScanned ?? 0, live, loading: !state && !error, error, refresh }
        : { picks: PICKS, marketsScanned: MARKETS_SCANNED, live, loading: false, error: null, refresh },
    [live, state, error, refresh],
  );
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used inside FeedProvider');
  return ctx;
}

/** The pick's price movement since it opened, from stored snapshots. Sample picks keep their own. */
export function usePriceLine(pick: Pick | undefined): Pick['line'] | undefined {
  const { live } = useFeed();
  const [history, setHistory] = useState<{ id: string; rows: HistoryRow[] } | null>(null);
  const id = pick?.id;

  useEffect(() => {
    if (!live || !id || !supabase) return;
    let cancelled = false;
    supabase
      .rpc('pick_history', { p_pick_id: Number(id) })
      .then(({ data, error }) => {
        if (!cancelled && !error) setHistory({ id, rows: (data ?? []) as HistoryRow[] });
      });
    return () => {
      cancelled = true;
    };
  }, [live, id]);

  if (!pick || !live || !pick.openedAt || history?.id !== pick.id) return pick?.line;
  const series = bestPriceSeries(history.rows, new Date(pick.openedAt));
  // End on the current best price; a book that stopped quoting can linger in the history.
  const now = bestBook(pick).price;
  if (series[series.length - 1] !== now) series.push(now);
  return priceLine(series, new Date(pick.openedAt), new Date());
}
