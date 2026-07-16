// STREAKS & RECORDS — known answers first, then a pass over CAPTURED reality.
import { describe, it, expect } from 'vitest';
import { weekResultsFor, streakSummary } from '../src/lib/engine/streaks';
import { rosterHandleMap } from '../src/api/history';
import { userHandleMap } from '../src/api/league';
import users from '../src/lib/api/fixtures/users-2025.json';
import rosters from '../src/lib/api/fixtures/rosters-2025.json';

const RH = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
const row = (roster_id, matchup_id, points) => ({ roster_id, matchup_id, points });

describe('weekResultsFor', () => {
  it('maps weeks to results with the right opponent, and skips unplayed 0-0 weeks', () => {
    const weeks = [
      [row(1, 1, 120.5), row(2, 1, 99.2), row(3, 2, 88), row(4, 2, 90)],   // wk1: A beats B
      [row(1, 1, 80), row(3, 1, 101.4), row(2, 2, 70), row(4, 2, 60)],     // wk2: A loses to C
      [row(1, 1, 0), row(2, 1, 0)],                                        // wk3: not played yet
    ];
    const res = weekResultsFor('A', weeks, RH);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ week: 1, pts: 120.5, oppPts: 99.2, opp: 'B', won: true, tie: false });
    expect(res[1]).toMatchObject({ week: 2, opp: 'C', won: false });
  });

  it('handles ties, byes (no matchup_id) and unknown handles safely', () => {
    const weeks = [
      [row(1, 1, 100), row(2, 1, 100)],           // tie
      [{ roster_id: 1, matchup_id: null, points: 50 }, row(2, 1, 60)], // A on bye
    ];
    const res = weekResultsFor('A', weeks, RH);
    expect(res).toHaveLength(1);
    expect(res[0].tie).toBe(true);
    expect(weekResultsFor('NOBODY', weeks, RH)).toEqual([]);
    expect(weekResultsFor('A', undefined, RH)).toEqual([]);
  });
});

describe('streakSummary', () => {
  const W = (week, pts = 100) => ({ week, pts, oppPts: pts - 10, opp: 'B', won: true, tie: false });
  const L = (week, pts = 80) => ({ week, pts, oppPts: pts + 10, opp: 'B', won: false, tie: false });
  const T = (week) => ({ week, pts: 90, oppPts: 90, opp: 'B', won: false, tie: true });

  it('tracks the active run, longest runs, and best/worst weeks', () => {
    // W W L L L W W  -> cur 2W, longestW 2, longestL 3
    const s = streakSummary([W(1, 130), W(2), L(3), L(4, 61.2), L(5), W(6), W(7)]);
    expect(s.cur).toEqual({ kind: 'W', len: 2 });
    expect(s.longestW).toBe(2);
    expect(s.longestL).toBe(3);
    expect(s.best.pts).toBe(130);
    expect(s.best.week).toBe(1);
    expect(s.worst.pts).toBe(61.2);
    expect(s.last5).toEqual(['L', 'L', 'L', 'W', 'W']);
  });

  it('a tie breaks both runs; empty input gives the empty shape', () => {
    const s = streakSummary([W(1), T(2), W(3)]);
    expect(s.cur).toEqual({ kind: 'W', len: 1 });
    expect(s.longestW).toBe(1);
    expect(streakSummary([])).toEqual({ cur: null, longestW: 0, longestL: 0, best: null, worst: null, last5: [] });
  });
});

describe('streaks vs captured reality (2025 fixtures)', () => {
  const rh = rosterHandleMap(rosters, userHandleMap(users));
  const weekFiles = import.meta.glob('../src/lib/api/fixtures/matchups-2025-*.json', { eager: true, import: 'default' });
  const weeks = [];
  for (const path in weekFiles) {
    const wk = Number(path.match(/matchups-2025-(\d+)\.json$/)?.[1]);
    if (wk) weeks[wk - 1] = weekFiles[path];
  }

  it('every manager with games has coherent results (points > 0, real opponents)', () => {
    const handles = [...new Set(Object.values(rh))];
    expect(handles.length).toBe(10);
    let managersWithGames = 0;
    for (const h of handles) {
      const res = weekResultsFor(h, weeks, rh);
      if (!res.length) continue;
      managersWithGames += 1;
      const s = streakSummary(res);
      expect(s.cur).not.toBeNull();
      expect(s.best.pts).toBeGreaterThan(0);
      expect(s.best.pts).toBeGreaterThanOrEqual(s.worst.pts);
      for (const r of res) expect(r.opp).not.toBe(h); // never plays himself
    }
    expect(managersWithGames, 'captured season yields form lines').toBeGreaterThan(0);
  });
});
