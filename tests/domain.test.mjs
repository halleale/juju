import test from 'node:test';
import assert from 'node:assert/strict';
import { price, decimalOdds, eligible, validateBet } from '../src/domain.ts';
import { agentReply } from '../src/agent.ts';
const p = { id: 'test', kickoff: '2026-11-15T21:00:00Z', status: 'active', selection: 'Team A', line: null, win: .5, push: 0, odds: 110, evidence: ['Sample evidence'], risks: ['Sample risk'] };
test('PRD example returns 5% at +110 and negative return at -110', () => {
  assert.ok(Math.abs(price(.5, 0, 110).expectedReturn - .05) < 1e-10);
  assert.ok(price(.5, 0, -110).expectedReturn < 0);
  assert.ok(Math.abs(price(.5, 0, 110).breakEven - 1 / 2.1) < 1e-10);
});
test('pushes contribute zero and comparisons use conditional probabilities', () => {
  const v = price(.5, .1, 100);
  assert.ok(Math.abs(v.expectedReturn - .1) < 1e-10);
  assert.equal(v.conditionalWin, .5 / .9);
});
test('invalid odds and probabilities are rejected', () => {
  for (const value of [0, 90, -90, Infinity, NaN, 110.5]) assert.throws(() => decimalOdds(value));
  assert.throws(() => price(.9, .2, 100));
  assert.throws(() => price(NaN, 0, 100));
});
test('freshness tightens in final hour and kickoff expires eligibility', () => {
  const kickoff = Date.parse(p.kickoff);
  assert.equal(eligible(p, kickoff - 7200000, kickoff - 7200000 - 299000), true);
  assert.equal(eligible(p, kickoff - 7200000, kickoff - 7200000 - 301000), false);
  assert.equal(eligible(p, kickoff - 300000, kickoff - 421000), false);
  assert.equal(eligible(p, kickoff, kickoff), false);
  assert.equal(eligible({ ...p, status: 'watching' }, kickoff - 300000, kickoff - 300000), false);
});
test('actual bet quote is independent and accepts an omitted stake', () => {
  const input = { book: 'FanDuel', odds: '-125', line: '2.5', stake: '' };
  assert.deepEqual(validateBet(input, 'Spread'), { book: 'FanDuel', odds: -125, line: 2.5, stake: null });
  assert.throws(() => validateBet({ ...input, line: '' }, 'Spread'));
  assert.throws(() => validateBet({ ...input, stake: '-5' }, 'Spread'));
  assert.throws(() => validateBet({ ...input, line: '2.3' }, 'Spread'));
});
test('agent labels user quotes and refuses fabricated live data', () => {
  assert.match(agentReply(p, 'Is this worth taking at -125?'), /pass at this price/);
  assert.match(agentReply(p, 'Is this worth taking at -125?'), /User-supplied price/);
  assert.match(agentReply(p, 'Any current injuries?'), /cannot verify/);
  assert.match(agentReply(p, 'Build a parlay'), /outside the current scope/);
  assert.match(agentReply(p, 'Help recover losses'), /does not recommend larger stakes/);
});
