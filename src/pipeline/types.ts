/**
 * Provider-neutral shapes for the odds pipeline. Each odds source (The Odds API today)
 * has an adapter that turns its responses into these, so it can be swapped.
 *
 * Files in src/pipeline/ also run in Deno (Supabase Edge Functions), so they import
 * with explicit .ts extensions and never use the @/ alias.
 */

export type PipelineMarketType = 'spread' | 'total' | 'moneyline';

/** One side of a market at one book. */
export type Quote = {
  type: PipelineMarketType;
  /** Team name, "Over" / "Under", or "Draw". */
  selection: string;
  /** Spread or total line; null for moneylines. */
  line: number | null;
  /** Stable book id, e.g. "pinnacle". */
  book: string;
  /** American odds. */
  price: number;
};

export type ProviderEvent = {
  /** The provider's event id. */
  externalId: string;
  /** App sport, e.g. "NFL" or "College FB". */
  sport: string;
  league: string;
  home: string;
  away: string;
  /** ISO timestamp. */
  startTime: string;
  quotes: Quote[];
};

export type ProviderUsage = {
  /** Credits this request cost. */
  last: number | null;
  remaining: number | null;
  used: number | null;
};

export type FetchResult = { events: ProviderEvent[]; usage: ProviderUsage };

export interface OddsProvider {
  readonly name: string;
  /** Pre-game odds for one sport, keyed by the app's sport name. */
  fetchOdds(sport: string): Promise<FetchResult>;
}
