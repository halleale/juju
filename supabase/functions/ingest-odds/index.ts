// Scheduled odds ingest: pulls pre-game odds from The Odds API, stores changed prices,
// scores every market against the consensus and opens or pulls picks.
//
// Secrets: ODDS_API_KEY, INGEST_SECRET (callers send it as `x-ingest-secret`).
// Optional: ODDS_SPORTS, a comma-separated list of app sports (default below).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy with `npx supabase functions deploy ingest-odds --no-verify-jwt --use-api`.
// --use-api is what lets it import the shared code in src/pipeline/.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runIngest, type PipelineStore } from '../../../src/pipeline/ingest.ts';
import { createTheOddsApi } from '../../../src/pipeline/the-odds-api.ts';

const DEFAULT_SPORTS = ['NFL', 'College FB', 'NBA', 'MLB', 'NHL'];

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

  const sports = (Deno.env.get('ODDS_SPORTS') ?? DEFAULT_SPORTS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const summary = await runIngest({ provider: createTheOddsApi({ apiKey: env('ODDS_API_KEY') }), store, sports });
  console.log(JSON.stringify(summary));
  const ok = summary.every((s) => s.ok);
  return Response.json(summary, { status: ok ? 200 : 500 });
});
