// RIVALRIES — known answers for the head-to-head ledger.
import { describe, it, expect } from 'vitest';
import { rivalryLedger } from '../src/lib/engine/rivalries';

// WeekResult shape: { week, pts, oppPts, opp, won, tie }
const g = (week, opp, pts, oppPts) => ({ week, opp, pts, oppPts, won: pts > oppPts, tie: pts === oppPts });

describe('rivalryLedger', () => {
  it('groups by opponent and tallies the series', () => {
    const results = [
      g(1, 'B', 110, 100), // W vs B
      g(3, 'B', 90, 120),  // L vs B
      g(5, 'C', 130, 88),  // W vs C
    ];
    const led = rivalryLedger(results);
    const B = led.find((r) => r.opp === 'B');
    expect(B).toMatchObject({ meetings: 2, wins: 1, losses: 1, ties: 0, pf: 200, pa: 220, diff: -20 });
    expect(B.lastWeek).toBe(3);
    expect(B.lastResult).toBe('L');
    const C = led.find((r) => r.opp === 'C');
    expect(C).toMatchObject({ meetings: 1, wins: 1, diff: 42, lastResult: 'W' });
  });

  it('orders most-played first, then by point differential', () => {
    const results = [
      g(1, 'B', 100, 90), g(2, 'B', 100, 90),  // B: 2 meetings
      g(3, 'C', 150, 80),                        // C: 1 meeting, big diff
      g(4, 'D', 90, 88),                         // D: 1 meeting, small diff
    ];
    const led = rivalryLedger(results);
    expect(led.map((r) => r.opp)).toEqual(['B', 'C', 'D']);
  });

  it('handles ties and picks the latest week for last result', () => {
    const results = [g(2, 'B', 100, 100), g(6, 'B', 95, 99)];
    const B = rivalryLedger(results)[0];
    expect(B).toMatchObject({ meetings: 2, wins: 0, losses: 1, ties: 1 });
    expect(B.lastResult).toBe('L'); // week 6 is the latest
  });

  it('is empty on empty input', () => {
    expect(rivalryLedger([])).toEqual([]);
    expect(rivalryLedger(undefined)).toEqual([]);
  });
});
