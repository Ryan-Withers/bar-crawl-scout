import { describe, it, expect } from 'vitest';
import { projMapFromBlob } from '../src/api/projections';

const byId = { p1: ['Josh Allen', 'QB', 'BUF'], p2: ['Jahmyr Gibbs', 'RB', 'DET'], p3: ['Nobody', 'WR', 'FA'] };
const scoring = { pass_yd: 0.04, pass_td: 4, rush_yd: 0.1, rush_td: 6, rec: 0.5, rec_yd: 0.1 };

describe('live projection map', () => {
  it('scores each projected player by the league scoring, keyed by lowercase name', () => {
    const blob = {
      p1: { pass_yd: 300, pass_td: 2 },     // 12 + 8 = 20
      p2: { rush_yd: 90, rush_td: 1, rec: 4, rec_yd: 30 }, // 9 + 6 + 2 + 3 = 20
    };
    const m = projMapFromBlob(blob, byId, scoring);
    expect(m['josh allen']).toBe(20);
    expect(m['jahmyr gibbs']).toBe(20);
  });

  it('skips unknown ids and zero-projection players', () => {
    const m = projMapFromBlob({ zzz: { pass_yd: 100 }, p3: {} }, byId, scoring);
    expect(m).toEqual({});
  });
});
