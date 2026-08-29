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

// ---------------------------------------------------------------------------
import leagueFixture from '../src/lib/api/fixtures/league.json';
import { needTargets } from '../src/lib/engine/league-config';
import { NEED_TGT } from '../src/lib/data.js';

describe('needTargets — the starting lineup decides what a manager needs', () => {
  it('reproduces the hand-written table for THIS league, off the live lineup', () => {
    // The point is not to change the numbers, it is to stop them being a memory.
    expect(needTargets(leagueFixture.roster_positions)).toEqual({ ...NEED_TGT });
  });

  it('spreads flex seats rather than stacking them on one position', () => {
    // Handing every flex to whoever already has the most gave RB 4 / WR 2 for a
    // two-flex league, which is not how anybody fills a lineup.
    expect(needTargets(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX']))
      .toEqual({ QB: 1, RB: 3, WR: 3, TE: 1 });
    expect(needTargets(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'FLEX']))
      .toEqual({ QB: 1, RB: 3, WR: 3, TE: 2 });
  });

  it('counts only the seats, ignoring bench, IR and taxi', () => {
    expect(needTargets(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'BN', 'BN', 'IR', 'TAXI']))
      .toEqual({ QB: 1, RB: 2, WR: 2, TE: 1 });
  });

  it('ignores the IDP seat this board does not model', () => {
    const withIdp = needTargets(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'IDP_FLEX']);
    const without = needTargets(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX']);
    expect(withIdp).toEqual(without);
  });

  it('respects what a flex is actually eligible for', () => {
    // REC_FLEX cannot be filled by a running back.
    const rec = needTargets(['QB', 'RB', 'WR', 'TE', 'REC_FLEX']);
    expect(rec.RB).toBe(1);
    expect(rec.WR + rec.TE).toBe(3);
  });

  it('never returns a zero, which would divide the need score by nothing', () => {
    for (const shape of [[], ['BN'], ['QB'], ['RB', 'RB', 'RB']]) {
      const t = needTargets(shape);
      for (const k of ['QB', 'RB', 'WR', 'TE']) expect(t[k], `${k} in ${shape}`).toBeGreaterThan(0);
    }
    expect(needTargets(null).QB).toBe(1);
  });
});
