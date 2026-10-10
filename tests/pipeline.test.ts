import { describe, expect, it } from 'vitest';
import fixture from './fixtures/the-odds-api-nfl.json';
import { impliedProb } from '@/lib/odds';
import { createTheOddsApi, DEFAULT_BOOKS, parseOdds } from '@/pipeline/the-odds-api';
import { confidenceFor, groupMarkets, scoreEvent, selectPicks, type ScoredPick } from '@/pipeline/score';
import { runIngest, type PipelineStore } from '@/pipeline/ingest';
import type { OddsProvider, ProviderEvent } from '@/pipeline/types';

const parsed = () => parseOdds(structuredClone(fixture), 'NFL', 'NFL');

/** The fixture with FanDuel's Bills moneyline moved to a stale +160. */
function withStaleFanDuel(): ProviderEvent {
  const [event] = parsed();
  return {
    ...event,
    quotes: event.quotes.map((q) => (q.book === 'fanduel' && q.type === 'moneyline' && q.selection === 'Buffalo Bills' ? { ...q, price: 160 } : q)),
  };
}

describe('The Odds API adapter', () => {
  it('parses moneylines, spreads and totals and skips props and bad prices', () => {
    const [event] = parsed();
    expect(event).toMatchObject({ externalId: 'evt-bills-chiefs', home: 'Kansas City Chiefs', away: 'Buffalo Bills', startTime: '2030-01-06T21:25:00Z' });
    expect(event.quotes).toContainEqual({ type: 'spread', selection: 'Buffalo Bills', line: 2.5, book: 'pinnacle', price: -104 });
    expect(event.quotes).toContainEqual({ type: 'moneyline', selection: 'Kansas City Chiefs', line: null, book: 'fanduel', price: -160 });
    // 4 books x 6 sides, minus BetMGM's 0-priced Under. The prop market is ignored.
    expect(event.quotes).toHaveLength(23);
  });

  it('requests pre-game odds for the configured books and reports usage', async () => {
    const urls: string[] = [];
    const fakeFetch = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(fixture), { headers: { 'x-requests-last': '3', 'x-requests-remaining': '497', 'x-requests-used': '3' } });
    }) as typeof fetch;
    const api = createTheOddsApi({ apiKey: 'k', fetch: fakeFetch, now: () => new Date('2030-01-05T12:00:00.123Z') });
    const { events, usage } = await api.fetchOdds('NFL');

    const url = new URL(urls[0]);
    expect(url.pathname).toBe('/v4/sports/americanfootball_nfl/odds');
    expect(url.searchParams.get('bookmakers')?.split(',')).toEqual(DEFAULT_BOOKS);
    expect(url.searchParams.get('markets')).toBe('h2h,spreads,totals');
    expect(url.searchParams.get('oddsFormat')).toBe('american');
    expect(url.searchParams.get('commenceTimeFrom')).toBe('2030-01-05T12:00:00Z');
    expect(events).toHaveLength(1);
    expect(usage).toEqual({ last: 3, remaining: 497, used: 3 });
  });

  it('sums usage across leagues for a sport', async () => {
    const fakeFetch = (async () => new Response('[]', { headers: { 'x-requests-last': '3', 'x-requests-remaining': '494' } })) as typeof fetch;
    const { usage } = await createTheOddsApi({ apiKey: 'k', fetch: fakeFetch }).fetchOdds('Soccer');
    expect(usage.last).toBe(6);
    expect(usage.remaining).toBe(494);
  });

  it('throws on HTTP errors and unknown sports', async () => {
    const fakeFetch = (async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;
    await expect(createTheOddsApi({ apiKey: 'bad', fetch: fakeFetch }).fetchOdds('NFL')).rejects.toThrow('HTTP 401');
    await expect(createTheOddsApi({ apiKey: 'k', fetch: fakeFetch }).fetchOdds('Golf')).rejects.toThrow('no sport key');
  });
});

describe('scoring', () => {
  it('groups only books that quote every side at the same line', () => {
    const groups = groupMarkets(parsed()[0]);
    const books = (type: string, line: number | null) =>
      groups.find((g) => g.type === type && g.sides[0].line === line)?.quotes.map((q) => q.book);
    expect(books('moneyline', null)).toEqual(['pinnacle', 'draftkings', 'fanduel', 'betmgm']);
    expect(books('spread', 2.5)).toEqual(['pinnacle', 'draftkings', 'betmgm']);
    expect(books('spread', 3)).toEqual(['fanduel']);
    // BetMGM's Under was invalid, so its Over cannot be de-vigged.
    expect(books('total', 47.5)).toEqual(['pinnacle', 'draftkings', 'fanduel']);
    expect(groups.find((g) => g.type === 'spread')?.sides).toEqual([
      { selection: 'Buffalo Bills', line: 2.5 },
      { selection: 'Kansas City Chiefs', line: -2.5 },
    ]);
  });

  it('pairs a pick-em spread', () => {
    const event: ProviderEvent = {
      ...parsed()[0],
      quotes: ['a', 'b', 'c'].flatMap((book) => [
        { type: 'spread' as const, selection: 'Kansas City Chiefs', line: 0, book, price: -110 },
        { type: 'spread' as const, selection: 'Buffalo Bills', line: 0, book, price: -110 },
      ]),
    };
    expect(groupMarkets(event)).toHaveLength(1);
  });

  it('skips markets with too few books', () => {
    const scored = scoreEvent(parsed()[0]);
    expect(scored.some((s) => s.type === 'spread' && s.line === 3)).toBe(false);
    expect(scored.filter((s) => s.type === 'spread')).toHaveLength(2);
  });

  it('measures edge at the best price against the weighted consensus', () => {
    const scored = scoreEvent(withStaleFanDuel());
    const bills = scored.find((s) => s.type === 'moneyline' && s.selection === 'Buffalo Bills')!;
    expect(bills.bestBook).toBe('fanduel');
    expect(bills.bestPrice).toBe(160);
    expect(bills.impliedProb).toBeCloseTo(impliedProb(160), 10);
    expect(bills.edge).toBeCloseTo((bills.modelProb - impliedProb(160)) * 100, 10);
    expect(bills.edge).toBeGreaterThan(3);
    expect(bills.books).toBe(4);
    expect(bills.signals[0].detail).toContain('+160 at FanDuel');
  });

  it('weights Pinnacle more than retail books', () => {
    const base = withStaleFanDuel();
    const flip = (book: string) => ({
      ...base,
      quotes: base.quotes.map((q) => (q.book === book && q.type === 'total' ? { ...q, price: q.selection === 'Over' ? -130 : 110 } : q)),
    });
    const over = (e: ProviderEvent) => scoreEvent(e).find((s) => s.selection === 'Over')!.modelProb;
    expect(over(flip('pinnacle'))).toBeGreaterThan(over(flip('draftkings')));
  });

  it('rates confidence by the books behind the consensus', () => {
    expect(confidenceFor(['pinnacle', 'a', 'b', 'c', 'd', 'e'])).toBe('High');
    expect(confidenceFor(['pinnacle', 'a', 'b'])).toBe('Medium');
    expect(confidenceFor(['a', 'b', 'c', 'd'])).toBe('Medium');
    expect(confidenceFor(['a', 'b', 'c'])).toBe('Low');
  });

  it('flags a consensus without a sharp book', () => {
    const event = parsed()[0];
    const scored = scoreEvent({ ...event, quotes: event.quotes.filter((q) => q.book !== 'pinnacle') });
    expect(scored[0].signals.some((s) => !s.pro && s.title.includes('No sharp book'))).toBe(true);
  });

  it('opens picks above the minimum, keeps them above the floor and drops suspicious edges', () => {
    const at = (edge: number) => ({ edge }) as ScoredPick;
    const { create, keep } = selectPicks([at(1), at(2), at(3.5), at(20)]);
    expect(create.map((s) => s.edge)).toEqual([3.5]);
    expect(keep.map((s) => s.edge)).toEqual([2, 3.5]);
  });
});

describe('runIngest', () => {
  const event = withStaleFanDuel();
  const provider = (events: ProviderEvent[]): OddsProvider => ({
    name: 'fake',
    fetchOdds: async (sport) => {
      if (sport === 'NHL') throw new Error('boom');
      return { events, usage: { last: 3, remaining: 100, used: 3 } };
    },
  });
  const store = () => {
    const calls: { saved: ProviderEvent[][]; picks: Parameters<PipelineStore['recordPicks']>[0][] } = { saved: [], picks: [] };
    const s: PipelineStore = {
      saveOdds: async (events) => (calls.saved.push(events), events.length * 10),
      recordPicks: async (input) => (calls.picks.push(input), { created: input.create.length, pulled: 0 }),
    };
    return { s, calls };
  };

  it('saves upcoming odds, records picks and keeps going when a sport fails', async () => {
    const { s, calls } = store();
    const summary = await runIngest({ provider: provider([event]), store: s, sports: ['NFL', 'NHL'], now: new Date('2030-01-05T12:00:00Z') });
    expect(summary[0]).toMatchObject({ sport: 'NFL', ok: true, events: 1, snapshots: 10, created: 1, usage: { last: 3 } });
    expect(summary[1]).toEqual({ sport: 'NHL', ok: false, error: 'boom' });
    expect(calls.picks[0].eventIds).toEqual(['evt-bills-chiefs']);
    expect(calls.picks[0].create.map((p) => p.selection)).toEqual(['Buffalo Bills']);
    expect(calls.picks[0].keep.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores games that have started', async () => {
    const { s, calls } = store();
    const summary = await runIngest({ provider: provider([event]), store: s, sports: ['NFL'], now: new Date('2030-01-07T00:00:00Z') });
    expect(summary[0]).toMatchObject({ ok: true, events: 0, snapshots: 0, created: 0 });
    expect(calls.saved).toHaveLength(0);
    expect(calls.picks).toHaveLength(0);
  });
});
