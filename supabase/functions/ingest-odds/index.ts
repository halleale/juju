// Scheduled odds ingest: pulls pre-game odds from The Odds API, stores changed prices,
// scores every market against the consensus and opens or pulls picks.
//
// Wake it every 5 minutes. Each sport is only polled (and only spends credits) when it
// is due, based on how soon its next game starts; see src/pipeline/schedule.ts.
// POST ?force=1 polls every sport now.
//
// Secrets: ODDS_API_KEY, INGEST_SECRET (callers send it as `x-ingest-secret`).
// Optional: ODDS_SPORTS, a comma-separated list of app sports (default NFL).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy with `npx supabase functions deploy ingest-odds --no-verify-jwt --use-api`.
// --use-api is what lets it import the shared code in src/pipeline/.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runScheduled, type PipelineStore, type ScheduleStore } from '../../../src/pipeline/ingest.ts';
import { createTheOddsApi } from '../../../src/pipeline/the-odds-api.ts';

const DEFAULT_SPORTS = ['NFL'];

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret ${name}`);
  return v;
}

Deno.serve(async (req) => {
  const secret = env('INGEST_SECRET');
  if (req.headers.get('x-ingest-secret') !== secret) return new Response('Forbidden', { status: 403 });

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const store: PipelineStore = {
    async saveOdds(events, capturedAt) {
      const { data, error } = await db.rpc('ingest_odds', { p_events: events, p_captured_at: capturedAt });
      if (error) throw new Error(`ingest_odds: ${error.message}`);
      return data as number;
    },
    async recordPicks({ eventIds, create, keep }) {
      const { data, error } = await db.rpc('record_picks', { p_event_ids: eventIds, p_create: create, p_keep: keep });
      if (error) throw new Error(`record_picks: ${error.message}`);
      return data as { created: number; pulled: number };
    },
  };
  const schedule: ScheduleStore = {
    async status(sports) {
      const { data, error } = await db.rpc('ingest_status', { p_sports: sports });
      if (error) throw new Error(`ingest_status: ${error.message}`);
      return (data as { sport: string; last_polled_at: string | null; next_kickoff: string | null }[]).map((r) => ({
        sport: r.sport,
        lastPolledAt: r.last_polled_at,
        nextKickoff: r.next_kickoff,
      }));
    },
    async logPoll(s, polledAt) {
      const row: Record<string, string | number | boolean | null> = s.ok
        ? {
            sport: s.sport,
            polled_at: polledAt.toISOString(),
            ok: true,
            events: s.events,
            snapshots: s.snapshots,
            picks_created: s.created,
            picks_pulled: s.pulled,
            credits: s.usage.last,
            credits_remaining: s.usage.remaining,
          }
        : { sport: s.sport, polled_at: polledAt.toISOString(), ok: false, error: s.error };
      const { error } = await db.from('ingest_log').insert(row);
      if (error) console.error(`ingest_log: ${error.message}`);
    },
  };

  const sports = (Deno.env.get('ODDS_SPORTS') ?? DEFAULT_SPORTS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const force = new URL(req.url).searchParams.get('force') === '1';
  const result = await runScheduled({ provider: createTheOddsApi({ apiKey: env('ODDS_API_KEY') }), store, schedule, sports, force });
  if (result.summary.length) console.log(JSON.stringify(result));
  const ok = result.summary.every((s) => s.ok);
  return Response.json(result, { status: ok ? 200 : 500 });
});
