import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/analysis.ts';
import { agentReply } from '../src/agent.ts';
const now = Date.parse('2026-11-15T18:00:00Z');
const at = new Date(now - 60000).toISOString();
function fixture() {
  return { id: 'test', kickoff: '2026-11-15T21:00:00Z', status: 'active', market: 'Moneyline', selection: 'Team A', line: null, odds: 110, win: .55, push: 0, version: 'test-v1', research: {
    id: 'snapshot', analyzedAt: at, quoteUpdatedAt: at, quoteIngestedAt: at, modelValidated: true, winRange: [.53, .57], qualification: { minimumEdge: .02, validated: true, version: 'test-rule' },
    sources: [{ id: 'source', name: 'Test source', kind: 'provider', observedAt: at, ingestedAt: at, reference: 'test-only reference' }],
    factors: [
      { id: 'factor', title: 'Efficiency', observation: 'Test observation', relevance: 'Test relevance', direction: 'supports', status: 'confirmed', modelUse: 'input', sourceIds: ['source'], critical: true, invalidatedBy: 'Input correction' },
      { id: 'counter', title: 'Venue risk', observation: 'Test counterevidence', relevance: 'Test relevance', direction: 'opposes', status: 'confirmed', modelUse: 'context', sourceIds: ['source'], critical: false, invalidatedBy: 'Venue correction' },
    ],
  } };
}
test('qualification requires both validated evidence and conservative value', () => {
  const p = fixture();
  assert.equal(analyze(p, now).decision, 'qualified');
  p.research.modelValidated = false;
  assert.equal(analyze(p, now).decision, 'abstain');
  assert.ok(analyze(p, now).pricing.expectedReturn > 0);
});
test('fictional sources never qualify even when all other gates pass', () => {
  const p = fixture(); p.research.sources[0].kind = 'sample';
  assert.equal(analyze(p, now).decision, 'abstain');
});
test('missing sources and unresolved critical inputs block publication', () => {
  const p = fixture(); p.research.factors[0].sourceIds = ['missing'];
  assert.match(analyze(p, now).blockers.join(' '), /source provenance/);
  p.research.factors[0].sourceIds = ['source']; p.research.factors[0].status = 'unresolved';
  assert.match(analyze(p, now).blockers.join(' '), /Waiting for confirmation/);
});
test('evidence known only after analysis is excluded', () => {
  const p = fixture(); p.research.sources[0].ingestedAt = new Date(now).toISOString();
  assert.equal(analyze(p, now).decision, 'abstain');
});
test('provider update time governs freshness, not a successful later fetch', () => {
  const p = fixture(); p.research.quoteUpdatedAt = new Date(now - 301000).toISOString();
  assert.match(analyze(p, now).blockers.join(' '), /stale/);
  p.research.quoteUpdatedAt = new Date(now + 1000).toISOString();
  assert.equal(analyze(p, now).decision, 'abstain');
});
test('changed lines suppress pricing and user quotes cannot qualify', () => {
  const p = fixture(); p.market = 'Spread'; p.line = 3;
  const changed = analyze(p, now, { odds: 110, line: 3.5, source: 'user' });
  assert.equal(changed.pricing, null);
  assert.match(changed.blockers.join(' '), /line changed/);
  assert.equal(analyze(p, now, { odds: 110, line: 3, source: 'user' }).decision, 'abstain');
});
test('uncertainty can invalidate positive central expected return', () => {
  const p = fixture(); p.research.winRange = [.45, .6];
  const result = analyze(p, now);
  assert.ok(result.pricing.expectedReturn > 0);
  assert.ok(result.conservativeReturn < 0);
  assert.equal(result.decision, 'abstain');
});
test('withdrawn records and expired windows cannot qualify', () => {
  const p = fixture(); p.status = 'withdrawn';
  assert.equal(analyze(p, now).decision, 'abstain');
  p.status = 'active'; assert.equal(analyze(p, Date.parse(p.kickoff)).decision, 'abstain');
});
test('agent includes traceable support, counterevidence gaps, and abstention', () => {
  const p = fixture(); p.research.modelValidated = false;
  p.research.factors = p.research.factors.filter(f => f.direction === 'supports');
  assert.match(analyze(p, now).blockers.join(' '), /Opposing evidence/);
  const reply = agentReply(p, 'Why this pick?', now);
  assert.match(reply, /no actionable recommendation/);
  assert.match(reply, /Efficiency: Test observation/);
  assert.match(reply, /\[source\]/);
  assert.match(reply, /Counterevidence has not been documented/);
  assert.match(reply, /snapshot snapshot/);
  assert.match(agentReply(p, 'What about spread +3.5?', now), /new evaluation/);
});
