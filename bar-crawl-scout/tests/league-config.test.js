import { describe, it, expect } from 'vitest';
import { rosterShape } from '../src/lib/engine/league-config';

describe('roster shape', () => {
  it('counts starting slots in order and folds the bench', () => {
    const s = rosterShape(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'BN', 'BN', 'BN', 'IR']);
    expect(s.starters).toEqual([
      { pos: 'QB', n: 1 }, { pos: 'RB', n: 2 }, { pos: 'WR', n: 2 },
      { pos: 'TE', n: 1 }, { pos: 'FLEX', n: 1 }, { pos: 'K', n: 1 }, { pos: 'DEF', n: 1 },
    ]);
    expect(s.startCount).toBe(9);
    expect(s.bench).toBe(4); // 3 BN + 1 IR
    expect(s.total).toBe(13);
  });

  it('handles an empty roster config', () => {
    expect(rosterShape([])).toEqual({ starters: [], bench: 0, startCount: 0, total: 0 });
  });
});
