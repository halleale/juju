import type { FetchResult, OddsProvider, PipelineMarketType, ProviderEvent, ProviderUsage, Quote } from './types.ts';

/**
 * Adapter for The Odds API v4 (https://the-odds-api.com/liveapi/guides/v4/).
 *
 * Cost: each /odds call costs one credit per market per region, and every group of up
 * to 10 bookmakers counts as one region. The defaults below (3 markets, 10 books) cost
 * 3 credits per league per call. The adapter reports what each call actually cost from
 * the x-requests-* headers, so check that before raising the schedule.
 */

/** App sport name to The Odds API sport keys. */
export const SPORT_KEYS: Record<string, { key: string; league: string }[]> = {
  NFL: [{ key: 'americanfootball_nfl', league: 'NFL' }],
  'College FB': [{ key: 'americanfootball_ncaaf', league: 'NCAAF' }],
  NBA: [{ key: 'basketball_nba', league: 'NBA' }],
  MLB: [{ key: 'baseball_mlb', league: 'MLB' }],
  NHL: [{ key: 'icehockey_nhl', league: 'NHL' }],
  Soccer: [
    { key: 'soccer_epl', league: 'EPL' },
    { key: 'soccer_usa_mls', league: 'MLS' },
  ],
};

/** Ten books, so one region's worth of credits. Pinnacle and LowVig anchor the consensus. */
export const DEFAULT_BOOKS = [
  'pinnacle',
  'lowvig',
  'betonlineag',
  'draftkings',
  'fanduel',
  'betmgm',
  'williamhill_us',
  'espnbet',
  'fanatics',
  'betrivers',
];

const MARKET_KEYS: Record<string, PipelineMarketType> = { h2h: 'moneyline', spreads: 'spread', totals: 'total' };

type ApiOutcome = { name: string; price: number; point?: number };
type ApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: { key: string; markets: { key: string; outcomes: ApiOutcome[] }[] }[];
};

function validPrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isInteger(price) && Math.abs(price) >= 100;
}

/** Turns one /odds response into provider-neutral events. Skips anything malformed. */
export function parseOdds(body: ApiEvent[], sport: string, league: string): ProviderEvent[] {
  return body.map((e) => {
    const quotes: Quote[] = [];
    for (const bm of e.bookmakers ?? []) {
      for (const m of bm.markets ?? []) {
        const type = MARKET_KEYS[m.key];
        if (!type) continue;
        for (const o of m.outcomes ?? []) {
          if (!validPrice(o.price)) continue;
          const line = type === 'moneyline' ? null : typeof o.point === 'number' ? o.point : undefined;
          if (line === undefined) continue;
          quotes.push({ type, selection: o.name, line, book: bm.key, price: o.price });
        }
      }
    }
    return { externalId: e.id, sport, league, home: e.home_team, away: e.away_team, startTime: e.commence_time, quotes };
  });
}

function numHeader(headers: Headers, name: string): number | null {
  const v = headers.get(name);
  return v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v);
}

export type TheOddsApiOptions = {
  apiKey: string;
  books?: string[];
  markets?: string[];
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Only events starting after this time. Defaults to now. */
  now?: () => Date;
};

export function createTheOddsApi(opts: TheOddsApiOptions): OddsProvider {
  const doFetch = opts.fetch ?? fetch;
  const baseUrl = opts.baseUrl ?? 'https://api.the-odds-api.com/v4';
  const books = opts.books ?? DEFAULT_BOOKS;
  const markets = opts.markets ?? Object.keys(MARKET_KEYS);
  const now = opts.now ?? (() => new Date());

  return {
    name: 'the-odds-api',
    async fetchOdds(sport: string): Promise<FetchResult> {
      const leagues = SPORT_KEYS[sport];
      if (!leagues) throw new Error(`The Odds API: no sport key for "${sport}"`);
      const events: ProviderEvent[] = [];
      const usage: ProviderUsage = { last: 0, remaining: null, used: null };
      for (const { key, league } of leagues) {
        const params = new URLSearchParams({
          apiKey: opts.apiKey,
          bookmakers: books.join(','),
          markets: markets.join(','),
          oddsFormat: 'american',
          dateFormat: 'iso',
          // Pre-game only. The API wants whole seconds.
          commenceTimeFrom: now().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        });
        const res = await doFetch(`${baseUrl}/sports/${key}/odds?${params}`);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`The Odds API ${key}: HTTP ${res.status} ${text.slice(0, 200)}`);
        }
        events.push(...parseOdds((await res.json()) as ApiEvent[], sport, league));
        const last = numHeader(res.headers, 'x-requests-last');
        usage.last = usage.last === null || last === null ? null : usage.last + last;
        usage.remaining = numHeader(res.headers, 'x-requests-remaining');
        usage.used = numHeader(res.headers, 'x-requests-used');
      }
      return { events, usage };
    },
  };
}
