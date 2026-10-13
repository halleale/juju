import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProviderFeed, providerQuoteStatus } from '../src/providerFeed.ts';
const now = Date.parse('2026-10-13T02:00:00Z');
const quote = { eventId: 'real-event', home: 'Home', away: 'Away', kickoff: '2026-10-13T23:00:00Z', market: 'Spread', selection: 'Home', line: -3.5, odds: -110, book: 'DraftKings', provider: 'The Odds API', providerUpdatedAt: new Date(now).toISOString(), ingestedAt: new Date(now).toISOString(), timestampScope: 'market', status: 'current', recommendationEnabled: false };
const feed = { quotes: [quote], events: [{ eventId: 'real-event', home: 'Home', away: 'Away', kickoff: quote.kickoff, schedule: { status: 'unmatched' } }], asOf: new Date(now).toISOString(), ingestedAt: new Date(now).toISOString(), message: 'Research only', recommendationsEnabled: false };
test('live quotes age while open and expire at kickoff', () => {
  assert.equal(providerQuoteStatus(quote, now), 'current');
  assert.equal(providerQuoteStatus(quote, now + 300001), 'stale');
  assert.equal(providerQuoteStatus(quote, Date.parse(quote.kickoff)), 'expired');
  const nearKickoff = { ...quote, kickoff: new Date(now + 3600000).toISOString() };
  assert.equal(providerQuoteStatus(nearKickoff, now + 120001), 'stale');
});
test('missing and future timestamps cannot be current; book timestamps retain scope', () => {
  assert.equal(providerQuoteStatus({ ...quote, providerUpdatedAt: null }, now), 'unavailable');
  assert.equal(providerQuoteStatus(quote, now - 1), 'unavailable');
  assert.equal(providerQuoteStatus({ ...quote, timestampScope: 'book' }, now), 'book_timestamp_only');
  assert.equal(providerQuoteStatus({ ...quote, status: 'stale' }, now), 'stale');
});
test('response validation rejects enabled recommendations and malformed quotes', () => {
  assert.equal(parseProviderFeed(feed).quotes[0].line, -3.5);
  assert.throws(() => parseProviderFeed({ ...feed, recommendationsEnabled: true }));
  for (const change of [{ odds: 90 }, { line: Infinity }, { recommendationEnabled: true }, { eventId: undefined }]) {
    assert.throws(() => parseProviderFeed({ ...feed, quotes: [{ ...quote, ...change }] }));
  }
  assert.throws(() => parseProviderFeed({ ...feed, events: [null] }));
});
