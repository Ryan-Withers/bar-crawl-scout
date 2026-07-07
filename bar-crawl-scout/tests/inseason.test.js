import { describe, it, expect } from 'vitest';
import { byeOutlook } from '../src/lib/engine/byeradar';
import { winProbability, matchupGrade } from '../src/lib/engine/matchup';

const P = (name, pos, bye) => ({ name, pos, bye, starter: true });

describe('bye radar', () => {
  it('groups players by bye week and flags thin positions (2+ out)', () => {
    const roster = [P('A', 'RB', 7), P('B', 'RB', 7), P('C', 'WR', 7), P('D', 'QB', 10), P('E', 'TE', 0)];
    const out = byeOutlook(roster, 1, 14);
    expect(out.map((w) => w.week)).toEqual([7, 10]);
    const wk7 = out[0];
    expect(wk7.byPos).toEqual({ RB: 2, WR: 1 });
    expect(wk7.thin).toEqual(['RB']); // two RBs out = a hole
  });

  it('ignores byes outside the window and bye 0', () => {
    const out = byeOutlook([P('A', 'RB', 5), P('B', 'WR', 0), P('C', 'TE', 18)], 6, 14);
    expect(out).toEqual([]);
  });
});

describe('matchup win probability', () => {
  it('is 50% when projections are equal', () => {
    expect(winProbability(120, 120)).toBe(50);
  });
  it('rises above 50 when favored and is symmetric', () => {
    const a = winProbability(130, 110);
    const b = winProbability(110, 130);
    expect(a).toBeGreaterThan(60);
    expect(Math.round(a + b)).toBe(100);
  });
  it('grades the matchup', () => {
    expect(matchupGrade(70).label).toBe('FAVORED');
    expect(matchupGrade(50).label).toBe('COIN FLIP');
    expect(matchupGrade(20).tone).toBe('bad');
  });
});
