import { describe, it, expect } from 'vitest';
import { decimalOdds, twoWay, overround, spread, overUnder, parlayOdds, potentialReturn, futuresOdds } from '../src/lib/engine/odds';

describe('the book — odds math', () => {
  it('shortens odds by the margin (house edge)', () => {
    expect(decimalOdds(0.5, 0)).toBe(2);       // fair coin flip = $2.00
    expect(decimalOdds(0.5, 0.07)).toBeLessThan(2); // with vig, worse than fair
    expect(decimalOdds(0.8, 0.07)).toBeCloseTo(1.17, 2);
  });

  it('two-way market books over 100% (overround)', () => {
    const { a, b } = twoWay(0.6, 0.07);
    expect(overround(a, b)).toBeGreaterThan(1);
  });

  it('derives a spread line from the projected margin', () => {
    expect(spread(12.3).line).toBe(12.5);
    expect(spread(0).line).toBe(0.5);
  });

  it('sets an over/under line at a half point', () => {
    expect(overUnder(21.2).line).toBe(21);
    expect(overUnder(21.4).line).toBe(21.5);
  });

  it('multiplies legs for a parlay and computes the return', () => {
    expect(parlayOdds([1.5, 2, 1.38])).toBe(4.14);
    expect(potentialReturn(20, 4.14)).toBe(82.8);
  });

  it('futures: better teams get shorter odds, sums to a fat book', () => {
    const f = futuresOdds([{ handle: 'A', score: 90 }, { handle: 'B', score: 60 }, { handle: 'C', score: 30 }]);
    expect(f[0].odds).toBeLessThan(f[2].odds);      // favourite shorter
    expect(overround(...f.map((x) => x.odds))).toBeGreaterThan(1.2); // heavy margin
  });
});
