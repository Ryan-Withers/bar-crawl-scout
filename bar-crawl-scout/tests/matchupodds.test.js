// H2H MATCHUP ODDS — known answers for the win-prob + pricing.
import { describe, it, expect } from 'vitest';
import { winProb, priceMatchup } from '../src/lib/engine/matchupodds';

describe('winProb', () => {
  it('is a coin flip at an even margin and symmetric around it', () => {
    expect(winProb(0)).toBe(0.5);
    expect(winProb(12) + winProb(-12)).toBeCloseTo(1, 10);
  });

  it('+1 scale of margin is ~73%', () => {
    expect(winProb(26, 26)).toBeCloseTo(1 / (1 + Math.exp(-1)), 6); // ~0.731
  });

  it('a blowout margin approaches certainty; junk input defaults to 0.5', () => {
    expect(winProb(200)).toBeGreaterThan(0.99);
    expect(winProb(Infinity)).toBe(0.5);
    expect(winProb(10, 0)).toBe(0.5);
  });
});

describe('priceMatchup', () => {
  it('an even matchup books both sides the same, on a half-point line', () => {
    const p = priceMatchup(100, 100);
    expect(p.probA).toBe(0.5);
    expect(p.oddsA).toBe(p.oddsB);
    expect(p.margin).toBe(0);
    expect(p.line).toBe(0.5);
    expect(p.favoursA).toBe(true);
  });

  it('the stronger team is the favourite: higher prob, shorter odds', () => {
    const p = priceMatchup(122, 100);
    expect(p.margin).toBe(22);
    expect(p.line).toBe(22);
    expect(p.favoursA).toBe(true);
    expect(p.probA).toBeGreaterThan(0.5);
    expect(p.oddsA).toBeLessThan(p.oddsB); // favourite pays less
  });

  it('flipping the sides mirrors the probabilities', () => {
    const a = priceMatchup(122, 100);
    const b = priceMatchup(100, 122);
    expect(b.probB).toBeCloseTo(a.probA, 10);
    expect(b.favoursA).toBe(false);
    expect(b.oddsB).toBe(a.oddsA);
  });

  it('both sides carry the house margin (book > 100%)', () => {
    const p = priceMatchup(110, 96);
    expect(1 / p.oddsA + 1 / p.oddsB).toBeGreaterThan(1);
  });
});
