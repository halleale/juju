/**
 * When to spend credits. The Edge Function is woken every few minutes; each sport is
 * only polled when it is due, which depends on how soon its next game starts. Tuned for
 * the NFL, where lines move most in the hours before kickoff and barely at all
 * mid-week overnight.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Time to the next kickoff, and how often to poll inside that window. First match wins. */
export const POLL_TIERS: { within: number; every: number }[] = [
  { within: 90 * MIN, every: 5 * MIN },
  { within: 6 * HOUR, every: 10 * MIN },
  { within: 24 * HOUR, every: 30 * MIN },
  { within: 72 * HOUR, every: 2 * HOUR },
];
/** Further out, or no known game. */
export const IDLE_EVERY = 4 * HOUR;

/** No polls in these local hours (US Eastern) unless a game starts within QUIET_OVERRIDE. */
export const QUIET = { tz: 'America/New_York', from: 1, to: 8 };
export const QUIET_OVERRIDE = 6 * HOUR;

/** Wake-ups are a few minutes apart, so allow a little slack before calling a poll early. */
const SLACK = 2 * MIN;

export type SportStatus = {
  sport: string;
  /** Last poll attempt, ISO. Null if never polled. */
  lastPolledAt: string | null;
  /** Earliest known upcoming game, ISO. Null if none known. */
  nextKickoff: string | null;
};

export function localHour(now: Date, tz = QUIET.tz): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now);
  return Number(h);
}

/** Minimum time between polls given the next kickoff, or null during quiet hours. */
export function pollInterval(nextKickoff: Date | null, now: Date): number | null {
  const until = nextKickoff ? nextKickoff.getTime() - now.getTime() : Infinity;
  const hour = localHour(now);
  if (hour >= QUIET.from && hour < QUIET.to && until > QUIET_OVERRIDE) return null;
  return POLL_TIERS.find((t) => until <= t.within)?.every ?? IDLE_EVERY;
}

export function isDue(status: SportStatus, now: Date): boolean {
  const kickoff = status.nextKickoff ? new Date(status.nextKickoff) : null;
  const every = pollInterval(kickoff && kickoff > now ? kickoff : null, now);
  if (every === null) return false;
  if (!status.lastPolledAt) return true;
  return now.getTime() - new Date(status.lastPolledAt).getTime() >= every - SLACK;
}
