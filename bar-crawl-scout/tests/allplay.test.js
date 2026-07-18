// THE LUCK INDEX — known answers first, then a pass over CAPTURED reality.
import { describe, it, expect } from 'vitest';
import { allPlayTable, luckBoard } from '../src/lib/engine/allplay';
import { rosterHandleMap } from '../src/api/history';
import { userHandleMap } from '../src/api/league';
import users from '../src/lib/api/fixtures/users-2025.json';
import rosters from '../src/lib/api/fixtures/rosters-2025.json';

const RH = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
const row = (roster_id, points) => ({ roster_id, matchup_id: 1, points });

describe('allPlayTable', () => {
  it('scores every team against the whole field each week', () => {
    // Wk1 order: A100 > B90 > C80 > D70 ; Wk2 order: D120 > C110 > B100 > A90
    const weeks = [
      [row(1, 100), row(2, 90), row(3, 80), row(4, 70)],
      [row(1, 90), row(2, 100), row(3, 110), row(4, 120)],
    ];
    const t = allPlayTable(weeks, RH);
    const A = t.find((r) => r.handle === 'A');
    // Wk1 A beats 3; Wk2 A beats 0 -> 3-3 all-play over 2 weeks.
    expect(A).toMatchObject({ allWins: 3, allLosses: 3, allTies: 0, weeks: 2 });
    expect(A.allPct).toBeCloseTo(0.5, 5);
    expect(A.expWins).toBe(1); // 0.5 * 2
    const D = t.find((r) => r.handle === 'D');
    // Wk1 D beats 0; Wk2 D beats 3 -> also 3-3.
    expect(D).toMatchObject({ allWins: 3, allLosses: 3 });
  });

  it('counts ties as half and skips unplayed (all-zero) weeks', () => {
    const weeks = [
      [row(1, 100), row(2, 100), row(3, 80), row(4, 80)], // A,B tie top; C,D tie bottom
      [row(1, 0), row(2, 0), row(3, 0), row(4, 0)],        // not played yet
    ];
    const t = allPlayTable(weeks, RH);
    const A = t.find((r) => r.handle === 'A');
    // A: beats C,D (2), ties B (1) -> 2-0-1, pct = (2+0.5)/3
    expect(A).toMatchObject({ allWins: 2, allLosses: 0, allTies: 1, weeks: 1 });
    expect(A.allPct).toBeCloseTo(2.5 / 3, 5);
    // Only one week counted for everyone.
    expect(t.every((r) => r.weeks === 1)).toBe(true);
  });

  it('is empty on empty / junk input', () => {
    expect(allPlayTable([], RH)).toEqual([]);
    expect(allPlayTable(undefined, RH)).toEqual([]);
    expect(allPlayTable([[row(1, 100)]], RH)).toEqual([]); // <2 scorers -> no week
  });
});

describe('luckBoard', () => {
  it('ranks by luck delta: actual wins minus expected wins', () => {
    const table = [
      { handle: 'Lucky', allWins: 5, allLosses: 13, allTies: 0, allPct: 5 / 18, weeks: 2, expWins: 0.6 },
      { handle: 'Robbed', allWins: 13, allLosses: 5, allTies: 0, allPct: 13 / 18, weeks: 2, expWins: 1.4 },
    ];
    const board = luckBoard(table, { Lucky: 2, Robbed: 0 });
    expect(board[0].handle).toBe('Lucky');   // 2 - 0.6 = +1.4
    expect(board[0].luck).toBe(1.4);
    expect(board[1].handle).toBe('Robbed');  // 0 - 1.4 = -1.4
    expect(board[1].luck).toBe(-1.4);
  });

  it('defaults missing actual-win entries to zero', () => {
    const board = luckBoard([{ handle: 'X', allWins: 1, allLosses: 1, allTies: 0, allPct: 0.5, weeks: 1, expWins: 0.5 }], {});
    expect(board[0].actualWins).toBe(0);
    expect(board[0].luck).toBe(-0.5);
  });
});

describe('all-play vs captured reality (2025 fixtures)', () => {
  const rh = rosterHandleMap(rosters, userHandleMap(users));
  const weekFiles = import.meta.glob('../src/lib/api/fixtures/matchups-2025-*.json', { eager: true, import: 'default' });
  const weeks = [];
  for (const path in weekFiles) {
    const wk = Number(path.match(/matchups-2025-(\d+)\.json$/)?.[1]);
    if (wk) weeks[wk - 1] = weekFiles[path];
  }

  it('produces a coherent all-play table for the season', () => {
    const t = allPlayTable(weeks, rh);
    expect(t.length).toBeGreaterThan(0);
    for (const r of t) {
      expect(r.allPct).toBeGreaterThanOrEqual(0);
      expect(r.allPct).toBeLessThanOrEqual(1);
      expect(r.expWins).toBeGreaterThanOrEqual(0);
      expect(r.expWins).toBeLessThanOrEqual(r.weeks);
    }
    // Sum of all expected wins ~= total games played / 2 (every game has a winner).
    const totalExp = t.reduce((s, r) => s + r.expWins, 0);
    const totalWeeks = t.reduce((s, r) => s + r.weeks, 0);
    expect(totalExp).toBeCloseTo(totalWeeks / 2, 0);
  });
});
