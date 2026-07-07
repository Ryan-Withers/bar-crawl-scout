import { describe, it, expect } from 'vitest';
import { rankStandings } from '../src/lib/engine/standings';

const rows = [
  { handle: 'a', team: 'A', wins: 10, losses: 4, ties: 0, pf: 1800, pa: 1600 },
  { handle: 'b', team: 'B', wins: 10, losses: 4, ties: 0, pf: 1900, pa: 1500 }, // same record, higher PF -> ahead
  { handle: 'c', team: 'C', wins: 6, losses: 8, ties: 0, pf: 1700, pa: 1750 },
];

describe('the table', () => {
  it('sorts by wins then points-for, assigns rank', () => {
    const r = rankStandings(rows);
    expect(r.map((x) => x.handle)).toEqual(['b', 'a', 'c']);
    expect(r[0].rank).toBe(1);
  });

  it('computes win%, games-back and point differential', () => {
    const r = rankStandings(rows);
    expect(r[0].pct).toBeCloseTo(0.714, 3); // 10/14
    expect(r[0].gb).toBe(0);
    expect(r[1].gb).toBe(0);   // 10-4 vs 10-4 -> level on games
    expect(r[2].gb).toBe(4);   // (10-6 + 8-4)/2
    expect(r[1].diff).toBe(200); // 1800-1600
  });
});
