import { describe, it, expect } from 'vitest';
import { powerRankings } from '../src/lib/engine/power';

describe('power rankings', () => {
  const teams = [
    { handle: 'A', team: 'A', winPct: 0.9, pf: 2000, rosterVal: 900 }, // best everywhere
    { handle: 'B', team: 'B', winPct: 0.5, pf: 1800, rosterVal: 700 },
    { handle: 'C', team: 'C', winPct: 0.2, pf: 1500, rosterVal: 500 }, // worst everywhere
  ];

  it('ranks the all-round best first and worst last', () => {
    const r = powerRankings(teams);
    expect(r.map((x) => x.handle)).toEqual(['A', 'B', 'C']);
    expect(r[0].rank).toBe(1);
    expect(r[0].score).toBeGreaterThan(r[2].score);
  });

  it('normalizes each part 0..100 with the leader maxed and tail at 0', () => {
    const r = powerRankings(teams);
    const a = r.find((x) => x.handle === 'A');
    const c = r.find((x) => x.handle === 'C');
    expect(a.parts).toEqual({ record: 100, scoring: 100, roster: 100 });
    expect(c.parts).toEqual({ record: 0, scoring: 0, roster: 0 });
  });

  it('handles an empty league', () => {
    expect(powerRankings([])).toEqual([]);
  });
});
