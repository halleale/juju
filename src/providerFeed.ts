export type ProviderQuote = {
  eventId: string; home: string; away: string; kickoff: string; market: string;
  selection: string; line: number | null; odds: number; book: string;
  provider: string; providerUpdatedAt: string | null; ingestedAt: string;
  timestampScope: string; status: string; recommendationEnabled: false;
};
export type ProviderEvent = {
  eventId: string; home: string; away: string; kickoff: string;
  schedule: { status: string; provider?: string; sourceEventId?: string;
    ingestedAt?: string; scheduledKickoff?: string; week?: number | string;
    venue?: string | null; advancedStatsStatus?: string; fbsMatchup?: boolean };
};
export type ProviderFeedData = {
  quotes: ProviderQuote[]; events: ProviderEvent[]; message: string;
  asOf: string; ingestedAt: string; recommendationsEnabled: false;
};

export function parseProviderFeed(value: unknown): ProviderFeedData {
  const data = value as ProviderFeedData | null;
  if (!data || data.recommendationsEnabled !== false || !Array.isArray(data.quotes) || !Array.isArray(data.events)
      || typeof data.message !== 'string' || !Number.isFinite(Date.parse(data.asOf)) && data.quotes.length > 0) throw new Error('Unexpected provider response');
  for (const quote of data.quotes) {
    if (!quote || quote.recommendationEnabled !== false || !['eventId', 'home', 'away', 'kickoff', 'market', 'selection', 'book', 'provider', 'ingestedAt', 'timestampScope', 'status'].every(key => typeof quote[key as keyof ProviderQuote] === 'string')
        || !Number.isInteger(quote.odds) || Math.abs(quote.odds) < 100
        || !(quote.line === null || typeof quote.line === 'number' && Number.isFinite(quote.line))
        || !(quote.providerUpdatedAt === null || typeof quote.providerUpdatedAt === 'string')) throw new Error('Invalid quote');
  }
  for (const event of data.events) {
    if (!event || !['eventId', 'home', 'away', 'kickoff'].every(key => typeof event[key as keyof ProviderEvent] === 'string') || !event.schedule || typeof event.schedule.status !== 'string') throw new Error('Invalid event');
  }
  return data;
}

export function providerQuoteStatus(quote: ProviderQuote, now: number): string {
  const kickoff = Date.parse(quote.kickoff);
  const updated = quote.providerUpdatedAt ? Date.parse(quote.providerUpdatedAt) : NaN;
  if (!Number.isFinite(kickoff) || now >= kickoff || quote.status === 'expired') return 'expired';
  if (!Number.isFinite(updated) || updated > now || quote.status === 'unavailable') return 'unavailable';
  const limit = kickoff - now <= 3600000 ? 120000 : 300000;
  if (now - updated > limit || quote.status === 'stale') return 'stale';
  return quote.timestampScope === 'market' && quote.status === 'current' ? 'current' : 'book_timestamp_only';
}
