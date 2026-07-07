import { describe, it, expect } from 'vitest';
import { buildWireRows } from '../src/lib/engine/wire';

const universe = [
  { name: 'Star RB', pos: 'RB', team: 'DET' },
  { name: 'Owned WR', pos: 'WR', team: 'CIN' },
  { name: 'Hot Pickup', pos: 'RB', team: 'NYG' },   // no board value, trending
  { name: 'Deep Guy', pos: 'WR', team: 'FA' },       // no value, no trend
];
const ctx = {
  valByName: { 'star rb': { val: 90, bye: 6, adp: 5 } },
  own: { 'owned wr': 'Mike' },
  trend: { 'hot pickup': 4200 },
  ryan: 'Ryan', pos: 'ALL', freeOnly: false, trendingOnly: false, q: '',
};

describe('the wire', () => {
  it('ranks board value first, then trending, then name', () => {
    const rows = buildWireRows(universe, ctx);
    expect(rows.map((r) => r.name)).toEqual(['Star RB', 'Hot Pickup', 'Deep Guy', 'Owned WR']);
    expect(rows[0].val).toBe(90);
    expect(rows[1].trend).toBe(4200);
  });

  it('free-agent filter drops owned players', () => {
    const rows = buildWireRows(universe, { ...ctx, freeOnly: true });
    expect(rows.some((r) => r.name === 'Owned WR')).toBe(false);
  });

  it('trending-only and position filters', () => {
    expect(buildWireRows(universe, { ...ctx, trendingOnly: true }).map((r) => r.name)).toEqual(['Hot Pickup']);
    expect(buildWireRows(universe, { ...ctx, pos: 'RB' }).every((r) => r.pos === 'RB')).toBe(true);
  });

  it('search matches by name substring', () => {
    expect(buildWireRows(universe, { ...ctx, q: 'hot' }).map((r) => r.name)).toEqual(['Hot Pickup']);
  });
});
