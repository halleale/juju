import { describe, expect, it } from 'vitest';

import { consensusFair, scoreMarket } from '@/lib/consensus';
import { beatClose, edgePts, impliedProb, noVig, probToAmerican, settleUnits } from '@/lib/odds';

describe('odds math', () => {
  it('converts American odds to implied probability', () => {
    expect(impliedProb(-110)).toBeCloseTo(0.5238, 4);
    expect(impliedProb(145)).toBeCloseTo(0.4082, 4);
    expect(impliedProb(100)).toBe(0.5);
  });

  it('converts probability back to American odds', () => {
    expect(probToAmerican(0.58)).toBe(-138);
    expect(probToAmerican(0.46)).toBe(117);
    expect(probToAmerican(0.5)).toBe(-100);
  });

  it('removes the vig so both sides sum to 1', () => {
    const [a, b] = noVig([-110, -110]);
    expect(a).toBeCloseTo(0.5);
    expect(a + b).toBeCloseTo(1);
  });

  it('computes edge in points', () => {
    expect(edgePts(0.58, -110)).toBeCloseTo(5.62, 2);
    expect(edgePts(0.46, 145)).toBeCloseTo(5.18, 2);
  });

  it('settles units on a 1 unit stake', () => {
    expect(settleUnits(-110, 'win')).toBeCloseTo(0.909, 3);
    expect(settleUnits(150, 'win')).toBe(1.5);
    expect(settleUnits(-110, 'loss')).toBe(-1);
    expect(settleUnits(-110, 'push')).toBe(0);
  });

  it('measures closing-line value', () => {
    expect(beatClose(-110, -120)).toBe(true);
    expect(beatClose(130, 118)).toBe(true);
    expect(beatClose(-108, -104)).toBe(false);
    expect(beatClose(-110, -110)).toBe(false);
  });
});

describe('consensus model', () => {
  const quotes = [
    { book: 'sharp', prices: [-105, -105] },
    { book: 'a', prices: [-110, -110] },
    { book: 'b', prices: [100, -120] },
  ];

  it('weights sharper books more', () => {
    const equal = consensusFair(quotes);
    const weighted = consensusFair(quotes, { sharp: 3 });
    expect(equal[0] + equal[1]).toBeCloseTo(1);
    // The sharp book is 50/50, so weighting it pulls the consensus toward 0.5.
    expect(Math.abs(weighted[0] - 0.5)).toBeLessThan(Math.abs(equal[0] - 0.5));
  });

  it('finds the best price and edge for each side', () => {
    const [over] = scoreMarket(quotes);
    expect(over.bestBook).toBe('b');
    expect(over.bestPrice).toBe(100);
    expect(over.edge).toBeCloseTo((over.fairProb - 0.5) * 100);
  });
});
