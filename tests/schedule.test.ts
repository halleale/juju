import { describe, expect, it } from 'vitest';
import { isDue, localHour, pollInterval } from '@/pipeline/schedule';
import { runScheduled, type PipelineStore, type ScheduleStore, type SportSummary } from '@/pipeline/ingest';
import type { OddsProvider } from '@/pipeline/types';

// October is EDT (UTC-4).
const et = (s: string) => new Date(`${s}-04:00`);
const MIN = 60_000;

describe('poll schedule', () => {
  it('reads the hour in US Eastern', () => {
    expect(localHour(et('2026-10-14T03:00'))).toBe(3);
    expect(localHour(et('2026-10-14T23:59'))).toBe(23);
  });

  it('polls more often as kickoff gets closer', () => {
    const now = et('2026-10-18T12:00');
    expect(pollInterval(et('2026-10-18T13:00'), now)).toBe(5 * MIN);
    expect(pollInterval(et('2026-10-18T16:25'), now)).toBe(10 * MIN);
    expect(pollInterval(et('2026-10-19T08:00'), now)).toBe(30 * MIN);
    expect(pollInterval(et('2026-10-20T20:15'), now)).toBe(120 * MIN);
    expect(pollInterval(et('2026-10-25T13:00'), now)).toBe(240 * MIN);
    expect(pollInterval(null, now)).toBe(240 * MIN);
  });

  it('stays quiet overnight unless a game is close', () => {
    expect(pollInterval(et('2026-10-15T20:15'), et('2026-10-14T03:00'))).toBeNull();
    // A London game at 9:30 ET is within six hours at 3:30 ET.
    expect(pollInterval(et('2026-10-18T09:30'), et('2026-10-18T03:30'))).toBe(10 * MIN);
    expect(pollInterval(et('2026-10-15T20:15'), et('2026-10-14T08:00'))).toBe(120 * MIN);
  });

  it('is due once the interval has passed, with a little slack for the wake-up cadence', () => {
    const now = et('2026-10-18T12:00');
    const status = (lastPolledAt: string | null) => ({ sport: 'NFL', lastPolledAt, nextKickoff: et('2026-10-18T16:25').toISOString() });
    expect(isDue(status(null), now)).toBe(true);
    expect(isDue(status(new Date(+now - 9 * MIN).toISOString()), now)).toBe(true);
    expect(isDue(status(new Date(+now - 7 * MIN).toISOString()), now)).toBe(false);
  });

  it('ignores a kickoff that has already passed', () => {
    const now = et('2026-10-18T12:00');
    const status = { sport: 'NFL', lastPolledAt: new Date(+now - 30 * MIN).toISOString(), nextKickoff: et('2026-10-18T11:00').toISOString() };
    expect(isDue(status, now)).toBe(false);
  });
});

describe('runScheduled', () => {
  const now = et('2026-10-18T12:00');
  const fetched: string[] = [];
  const provider: OddsProvider = {
    name: 'fake',
    fetchOdds: async (sport) => (fetched.push(sport), { events: [], usage: { last: 3, remaining: 100, used: 3 } }),
  };
  const store: PipelineStore = { saveOdds: async () => 0, recordPicks: async () => ({ created: 0, pulled: 0 }) };
  const logged: SportSummary[] = [];
  const schedule: ScheduleStore = {
    status: async () => [
      { sport: 'NFL', lastPolledAt: new Date(+now - 15 * MIN).toISOString(), nextKickoff: et('2026-10-18T13:00').toISOString() },
      { sport: 'NBA', lastPolledAt: new Date(+now - 15 * MIN).toISOString(), nextKickoff: et('2026-10-21T19:30').toISOString() },
    ],
    logPoll: async (s) => void logged.push(s),
  };

  it('polls and logs only the sports that are due', async () => {
    fetched.length = logged.length = 0;
    const result = await runScheduled({ provider, store, schedule, sports: ['NFL', 'NBA'], now });
    expect(result.due).toEqual(['NFL']);
    expect(result.skipped).toEqual(['NBA']);
    expect(fetched).toEqual(['NFL']);
    expect(logged.map((s) => s.sport)).toEqual(['NFL']);
  });

  it('polls everything when forced', async () => {
    fetched.length = logged.length = 0;
    const result = await runScheduled({ provider, store, schedule, sports: ['NFL', 'NBA'], now, force: true });
    expect(result.due).toEqual(['NFL', 'NBA']);
    expect(fetched).toEqual(['NFL', 'NBA']);
  });
});
