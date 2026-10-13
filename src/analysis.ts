import { price, validOdds } from './domain.ts';
import type { Pick } from './domain.ts';

export type QuoteInput = { odds: number; line: number | null; source: 'stored' | 'user' };
export function analyze(pick: Pick, now: number, quote: QuoteInput = { odds: pick.odds, line: pick.line, source: 'stored' }) {
  const blockers: string[] = [];
  const research = pick.research;
  let pricing: ReturnType<typeof price> | null = null;
  let conservativeReturn: number | null = null;
  if (quote.line !== pick.line) blockers.push('The line changed. A new score distribution is required; the original probabilities cannot price this line.');
  if (!validOdds(quote.odds)) blockers.push('The American odds are invalid.');
  if (quote.line === pick.line && validOdds(quote.odds)) {
    try { pricing = price(pick.win, pick.push, quote.odds); } catch { blockers.push('Outcome probabilities are invalid.'); }
  }
  const kickoff = Date.parse(pick.kickoff);
  if (!Number.isFinite(now) || !Number.isFinite(kickoff) || now >= kickoff) blockers.push('The pregame window has expired or its time is invalid.');
  if (pick.status !== 'active') blockers.push(`This record is ${pick.status}; it is not an active recommendation.`);
  if (quote.source === 'user') blockers.push('User-supplied price; sportsbook availability is unverified.');
  if (!research) blockers.push('A traceable research snapshot is missing.');
  if (research) {
    if (!research.modelValidated) blockers.push('The probability model has not passed validation.');
    if (!research.qualification.validated || !Number.isFinite(research.qualification.minimumEdge) || research.qualification.minimumEdge < 0 || research.qualification.minimumEdge >= 1) blockers.push('The qualification rule has not passed validation.');
    const times = [research.analyzedAt, research.quoteUpdatedAt, research.quoteIngestedAt].map(Date.parse);
    const [analysisTime, updated, ingested] = times;
    const limit = kickoff - now <= 3600000 ? 120000 : 300000;
    if (times.some(t => !Number.isFinite(t) || t > now) || updated > ingested || ingested > analysisTime || now - updated > limit) blockers.push('The quote is stale, missing a valid timestamp, or outside the freshness window.');
    const sources = new Map(research.sources.map(source => [source.id, source]));
    if (research.sources.some(source => source.kind === 'sample')) blockers.push('Evidence is fictional sample data, not verified provider information.');
    if (!research.factors.some(f => f.direction === 'supports' && f.modelUse === 'input' && f.status === 'confirmed')) blockers.push('No confirmed supporting factor is linked to model inputs.');
    if (!research.factors.some(f => f.direction === 'opposes')) blockers.push('Opposing evidence has not been documented.');
    for (const factor of research.factors) {
      if (factor.critical && factor.status !== 'confirmed') blockers.push(`Waiting for confirmation: ${factor.title}.`);
      if (!factor.sourceIds.length || factor.sourceIds.some(id => {
        const source = sources.get(id);
        if (!source || !source.reference.trim()) return true;
        const observed = Date.parse(source.observedAt), received = Date.parse(source.ingestedAt);
        return !Number.isFinite(observed) || !Number.isFinite(received) || observed > received || received > analysisTime;
      })) blockers.push(`Missing or invalid source provenance: ${factor.title}.`);
    }
    const [lower, upper] = research.winRange;
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower < 0 || lower > pick.win || upper < pick.win || upper + pick.push > 1) blockers.push('Probability uncertainty is missing or invalid.');
    else if (pricing) {
      const conservative = price(lower, pick.push, quote.odds);
      conservativeReturn = conservative.expectedReturn;
      if (conservative.expectedReturn <= 0 || conservative.edge < research.qualification.minimumEdge) blockers.push('Value does not clear the qualification rule after allowing for probability uncertainty.');
    }
  }
  if (pricing && pricing.expectedReturn <= 0) blockers.push('Pass at this price: the estimated expected return is not positive.');
  return { decision: blockers.length ? 'abstain' as const : 'qualified' as const, blockers: [...new Set(blockers)], pricing, conservativeReturn, snapshot: research || null };
}

export function priceExplanation(pick: Pick, odds = pick.odds) {
  const result = price(pick.win, pick.push, odds);
  return `${(result.conditionalWin * 100).toFixed(1)}% estimated win chance ${pick.push > 0 ? 'among non-push outcomes' : ''} versus ${(result.breakEven * 100).toFixed(1)}% required to break even. Estimated net return is ${(result.expectedReturn * 100).toFixed(1)}% per unit staked; a push returns the stake. ${result.expectedReturn > 0 ? 'The arithmetic is positive, but evidence and model validation still determine whether a recommendation is justified.' : 'The arithmetic favors passing at this price.'}`;
}
