import { describe, expect, it } from 'vitest';

import { PICKS, SETTLED } from '@/data/mock';
import { bestBook, matchPicks, pickStats, type Prefs } from '@/lib/picks';
import { byMarketType, formatRecord, summarize } from '@/lib/tracker';

const base: Prefs = {
  sports: ['NFL', 'MLB', 'NHL'],
  betTypes: ['Spreads', 'Totals', 'Player props'],
  teams: ['Buffalo Bills', 'New York Rangers'],
  style: 'balanced',
};

describe('pick stats', () => {
  it('measures edge against the best available price', () => {
    const bills = PICKS.find((p) => p.id === 'buf-mia-under')!;
    expect(bestBook(bills)).toEqual({ book: 'Sportsbook A', price: -108 });
    const { price, edge } = pickStats(bills);
    expect(price).toBe(-108);
    expect(edge).toBeCloseTo(5.58, 2);
  });
});

describe('matchPicks', () => {
  it('filters to sports, bet types and followed teams', () => {
    const ids = matchPicks(PICKS, base).map((p) => p.id);
    // Moneylines are off and no followed team plays in the Mariners game.
    expect(ids).toEqual(['buf-mia-under', 'det-cin-te-rec', 'njd-nyr-over']);
  });

  it('explains why each pick matched', () => {
    const reasons = Object.fromEntries(matchPicks(PICKS, { ...base, betTypes: [...base.betTypes, 'Moneylines'] }).map((p) => [p.id, p.matchReason]));
    expect(reasons['buf-mia-under']).toBe('You follow the Bills');
    expect(reasons['njd-nyr-over']).toBe('You follow the Rangers');
    expect(reasons['det-cin-te-rec']).toBe('You picked player props');
    expect(reasons['sea-det-ml']).toBe('MLB · Balanced style');
  });

  it('applies style', () => {
    const conservative = matchPicks(PICKS, { ...base, style: 'conservative' }).map((p) => p.id);
    expect(conservative).toEqual(['buf-mia-under']);
    const longshot = matchPicks(PICKS, { ...base, style: 'longshot', betTypes: ['Moneylines', 'Player props'] }).map((p) => p.id);
    expect(longshot).toEqual(['sea-det-ml', 'det-cin-te-rec']);
  });

  it('drops sports the user does not follow', () => {
    expect(matchPicks(PICKS, { ...base, sports: ['NBA'] })).toEqual([]);
  });
});

describe('tracker', () => {
  it('summarizes record, units, ROI and CLV', () => {
    const s = summarize(SETTLED);
    expect(formatRecord(s)).toBe('5-2-1');
    expect(s.units).toBeCloseTo(0.909 + 0.952 + 0.909 + 0.909 + 1.5 - 2, 2);
    expect(s.roi).toBeCloseTo(s.units / 7);
    expect(s.clv).toBeCloseTo(6 / 8);
  });

  it('groups by bet type', () => {
    expect(byMarketType(SETTLED).map((r) => r.type)).toEqual(['spread', 'total', 'moneyline', 'prop']);
  });
});
