import { scoreEvent, selectPicks, SCORE_DEFAULTS, type ScoredPick } from './score.ts';
import type { OddsProvider, ProviderEvent, ProviderUsage } from './types.ts';

/** Where the pipeline writes. The Edge Function backs this with Supabase RPCs. */
export interface PipelineStore {
  /** Upserts events and markets and stores prices that changed. Returns snapshots written. */
  saveOdds(events: ProviderEvent[], capturedAt: string): Promise<number>;
  /**
   * Opens a pick for each `create` market without an active pick, and pulls active picks
   * on these events whose market is not in `keep`.
   */
  recordPicks(input: { eventIds: string[]; create: ScoredPick[]; keep: ScoredPick[] }): Promise<{ created: number; pulled: number }>;
}

export type SportSummary =
  | { sport: string; ok: true; events: number; snapshots: number; created: number; pulled: number; usage: ProviderUsage }
  | { sport: string; ok: false; error: string };

export type IngestOptions = {
  provider: OddsProvider;
  store: PipelineStore;
  sports: string[];
  now?: Date;
  thresholds?: Partial<typeof SCORE_DEFAULTS>;
};

/** One pipeline run: ingest and score each sport. A failing sport does not stop the others. */
export async function runIngest({ provider, store, sports, now = new Date(), thresholds }: IngestOptions): Promise<SportSummary[]> {
  const out: SportSummary[] = [];
  for (const sport of sports) {
    try {
      const { events, usage } = await provider.fetchOdds(sport);
      const upcoming = events.filter((e) => new Date(e.startTime) > now);
      const snapshots = upcoming.length ? await store.saveOdds(upcoming, now.toISOString()) : 0;
      const scored = upcoming.flatMap((e) => scoreEvent(e, thresholds?.minBooks));
      const { create, keep } = selectPicks(scored, thresholds);
      const { created, pulled } = upcoming.length
        ? await store.recordPicks({ eventIds: upcoming.map((e) => e.externalId), create, keep })
        : { created: 0, pulled: 0 };
      out.push({ sport, ok: true, events: upcoming.length, snapshots, created, pulled, usage });
    } catch (err) {
      out.push({ sport, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}
