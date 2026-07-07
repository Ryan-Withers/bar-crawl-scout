import { describe, it, expect } from 'vitest';
import { vsLeague } from '../src/lib/engine/vsleague';

const lines = [
  { opponent: 'Mike', points: 20 },
  { opponent: 'Mike', points: 10 },   // Mike avg 15, best 20
  { opponent: 'Sarah', points: 25 },  // Sarah avg 25
  { opponent: '', points: 99 },       // no opponent -> ignored
];

describe('vs the league', () => {
  it('groups points by opponent and sorts by average desc', () => {
    const rows = vsLeague(lines);
    expect(rows.map((r) => r.opponent)).toEqual(['Sarah', 'Mike']);
    expect(rows[1]).toMatchObject({ opponent: 'Mike', games: 2, avg: 15, best: 20, total: 30 });
  });

  it('skips lines with no opponent', () => {
    const rows = vsLeague(lines);
    expect(rows.some((r) => r.opponent === '')).toBe(false);
  });

  it('returns nothing for empty input', () => {
    expect(vsLeague([])).toEqual([]);
  });
});
