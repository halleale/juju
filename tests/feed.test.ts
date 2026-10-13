import { describe, expect, it } from 'vitest';
import { bestPriceSeries, kickoffLabel, pickFromRow, selectionLabel, shortTeam, type FeedRow } from '@/lib/feed';
import { matchPicks, pickStats } from '@/lib/picks';
import { winUnits } from '@/lib/odds';

// Local-time dates, so labels do not depend on the machine's time zone.
const now = new Date(2026, 9, 13, 10, 0); // Tue Oct 13, 10:00 AM

const row = (over: Partial<FeedRow> = {}): FeedRow => ({
  id: 42,
  sport: 'NFL',
  home: 'Kansas City Chiefs',
  away: 'Buffalo Bills',
  start_time: new Date(2026, 9, 18, 16, 25).toISOString(),
  type: 'spread',
  selection: 'Buffalo Bills',
  line: '2.50',
  current_prob: '0.5500',
  current_edge: '3.78',
  confidence: 'High',
  why: null,
  signals: [{ pro: true, title: 'Best price vs. market consensus', detail: 'd' }],
  open_price: -110,
  created_at: new Date(2026, 9, 13, 9, 5).toISOString(),
  books: [
    { book: 'draftkings', price: -110 },
    { book: 'fanduel', price: -105 },
  ],
  ...over,
});

describe('feed labels', () => {
  it('shortens team names, keeping two-word nicknames', () => {
    expect(shortTeam('Buffalo Bills')).toBe('Bills');
    expect(shortTeam('Boston Red Sox')).toBe('Red Sox');
    expect(shortTeam('San Francisco 49ers')).toBe('49ers');
  });

  it('labels selections like the designs', () => {
    expect(selectionLabel('total', 'Under', 47.5)).toBe('Under 47.5');
    expect(selectionLabel('spread', 'Buffalo Bills', 2.5)).toBe('Bills +2.5');
    expect(selectionLabel('spread', 'Kansas City Chiefs', -2.5)).toBe('Chiefs -2.5');
    expect(selectionLabel('spread', 'Kansas City Chiefs', 0)).toBe('Chiefs PK');
    expect(selectionLabel('moneyline', 'Seattle Mariners', null)).toBe('Mariners ML');
    expect(selectionLabel('moneyline', 'Draw', null)).toBe('Draw');
  });

  it('labels kickoff relative to today', () => {
    expect(kickoffLabel(new Date(2026, 9, 13, 20, 15), now)).toBe('Tonight 8:15 PM');
    expect(kickoffLabel(new Date(2026, 9, 13, 13, 0), now)).toBe('Today 1:00 PM');
    expect(kickoffLabel(new Date(2026, 9, 14, 12, 5), now)).toBe('Tomorrow 12:05 PM');
    expect(kickoffLabel(new Date(2026, 9, 18, 16, 25), now)).toBe('Sun 4:25 PM');
    expect(kickoffLabel(new Date(2026, 9, 25, 9, 30), now)).toBe('Oct 25 9:30 AM');
  });
});

describe('pickFromRow', () => {
  it('maps a feed row to a pick with live prices', () => {
    const pick = pickFromRow(row(), now)!;
    expect(pick).toMatchObject({ id: '42', sport: 'NFL', marketType: 'spread', away: 'Bills', home: 'Chiefs', selection: 'Bills +2.5', time: 'Sun 4:25 PM', modelProb: 0.55 });
    expect(pick.books).toEqual([
      { book: 'DraftKings', price: -110 },
      { book: 'FanDuel', price: -105 },
    ]);
    expect(pickStats(pick).price).toBe(-105);
    expect(pick.why).toContain('2 books');
    expect(pick.line).toMatchObject({ label: 'Price', open: -110, nowLabel: '-105', points: [winUnits(-110), winUnits(-105)] });
  });

  it('drops picks no book is quoting', () => {
    expect(pickFromRow(row({ books: [] }), now)).toBeNull();
  });

  it('matches followed teams stored as full names', () => {
    const pick = pickFromRow(row(), now)!;
    const matched = matchPicks([pick], { sports: ['NFL'], betTypes: [], teams: ['Buffalo Bills'], style: 'balanced' });
    expect(matched[0]?.matchReason).toBe('You follow the Bills');
  });
});

describe('bestPriceSeries', () => {
  const at = (min: number) => new Date(Date.UTC(2026, 9, 13, 12, min)).toISOString();

  it('tracks the best price across books over time', () => {
    const history = [
      { book: 'a', price: -110, captured_at: at(0) },
      { book: 'b', price: -112, captured_at: at(0) },
      { book: 'b', price: -105, captured_at: at(10) },
      { book: 'a', price: -115, captured_at: at(20) },
      { book: 'b', price: 100, captured_at: at(30) },
    ];
    expect(bestPriceSeries(history)).toEqual([-110, -105, 100]);
  });

  it('starts at the pick opening, carrying earlier prices forward', () => {
    const history = [
      { book: 'a', price: -120, captured_at: at(0) },
      { book: 'a', price: -110, captured_at: at(5) },
      { book: 'a', price: -105, captured_at: at(30) },
    ];
    expect(bestPriceSeries(history, new Date(at(6)))).toEqual([-110, -105]);
    expect(bestPriceSeries(history, new Date(at(40)))).toEqual([-105]);
  });
});
