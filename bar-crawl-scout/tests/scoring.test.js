import { describe, it, expect } from 'vitest';
import { scoreStats, positionRanks, replacementRank } from '../src/lib/engine/scoring';
import {
  ppg, volatility, floorPct, boomRate, bustRate, targetShare, touchShare, snapShare, mileageFlag, trend,
} from '../src/lib/engine/derived';
import scoring from '../src/lib/api/fixtures/league-scoring.json';

describe('scoring engine (reconciliation vs league scoring_settings)', () => {
  it('scores a WR line to the league total (half-PPR)', () => {
    // 8 rec, 112 yds, 1 TD = 8*0.5 + 112*0.1 + 6 = 21.2
    expect(scoreStats({ rec: 8, rec_yd: 112, rec_td: 1 }, scoring)).toBe(21.2);
  });
  it('scores a QB line (6pt pass TD, -2 INT — the captured real settings)', () => {
    // The capture bot replaced the hand-written scoring fixture with the league's
    // REAL settings and exposed two wrong guesses: INTs are -2 (not -1) and lost
    // fumbles -1 (not -2). Proven by the 36-week reconciliation suite.
    // 305*0.04 + 3*6 - 2 + 22*0.1 = 12.2 + 18 - 2 + 2.2 = 30.4
    expect(scoreStats({ pass_yd: 305, pass_td: 3, pass_int: 1, rush_yd: 22 }, scoring)).toBe(30.4);
  });
  it('ignores stat keys the league does not score', () => {
    expect(scoreStats({ rec: 5, blk_kick: 1 }, scoring)).toBe(2.5);
  });
  it('reconciles a full RB/receiving line within rounding', () => {
    const raw = { rec: 6, rec_yd: 74, rush_att: 9, rush_yd: 41, rush_td: 1, fum_lost: 1 };
    const expected = 6 * 0.5 + 74 * 0.1 + 41 * 0.1 + 6 - 1; // 19.5 (rush_att unscored; fum_lost -1)
    expect(scoreStats(raw, scoring)).toBeCloseTo(expected, 2);
  });
});

describe('positionRanks + replacement line', () => {
  it('ranks within a position by league points', () => {
    const scored = { a: 20, b: 30, c: 10, d: 25 };
    const pos = { a: 'WR', b: 'WR', c: 'WR', d: 'RB' };
    expect(positionRanks(scored, pos, 'WR')).toEqual({ b: 1, a: 2, c: 3 });
    expect(replacementRank('QB')).toBe(12);
    expect(replacementRank('TE')).toBe(12);
    expect(replacementRank('RB')).toBe(24);
  });
});

describe('derived stats', () => {
  it('ppg / volatility / floor', () => {
    expect(ppg(212, 13)).toBe(16.3);
    expect(ppg(10, 0)).toBeNull();
    expect(volatility([10, 10, 10])).toBe(0);
    expect(volatility([0, 20])).toBe(10);
    expect(floorPct([12, 8, 20, 5], 10)).toBe(50);
  });
  it('boom / bust by position', () => {
    expect(boomRate([3, 8, 15, 1])).toBe(75);
    expect(bustRate([40, 5, 38, 12], 'WR')).toBe(50);
    expect(bustRate([20, 5], 'QB')).toBe(50);
  });
  it('usage shares', () => {
    expect(targetShare(10, 40)).toBe(25);
    expect(touchShare(12, 6, 60)).toBe(30);
    expect(snapShare(50, 70)).toBe(71.4);
    expect(targetShare(5, 0)).toBeNull();
  });
  it('mileage flag + trend arrow', () => {
    expect(mileageFlag('RB', 28)).toBe(true);
    expect(mileageFlag('WR', 27)).toBe(false);
    expect(mileageFlag('QB', 36)).toBe(true);
    expect(trend([5, 6, 8, 12])).toBe('up');
    expect(trend([12, 8, 6, 5])).toBe('down');
    expect(trend([10, 10, 10, 10])).toBe('flat');
  });
});
