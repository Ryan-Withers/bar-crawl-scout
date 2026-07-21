// STRENGTH OF SCHEDULE — known answers, then a pass over captured reality.
import { describe, it, expect } from 'vitest';
import { strengthOfSchedule } from '../src/lib/engine/sos';
import { rosterHandleMap } from '../src/api/history';
import { userHandleMap, recordsFromRosters } from '../src/api/league';
import users from '../src/lib/api/fixtures/users-2025.json';
import rosters from '../src/lib/api/fixtures/rosters-2025.json';

const RH = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
const row = (roster_id, matchup_id, points) => ({ roster_id, matchup_id, points });
// Season strength (ppg): C is the beast, B the pushover.
const STR = { A: 100, B: 80, C: 120, D: 105 };

describe('strengthOfSchedule — known answers', () => {
  it('averages each opponent\'s season ppg over games played', () => {
    const weeks = [
      [row(1, 1, 90), row(3, 1, 95), row(2, 2, 70), row(4, 2, 88)],   // A vs C, B vs D
      [row(1, 1, 91), row(4, 1, 80), row(2, 2, 60), row(3, 2, 130)],  // A vs D, B vs C
    ];
    const sos = strengthOfSchedule(weeks, RH, STR);
    const A = sos.find((r) => r.handle === 'A');
    // A faced C(120) then D(105) -> mean 112.5, over 2 games.
    expect(A).toMatchObject({ games: 2, oppPpg: 112.5 });
    const B = sos.find((r) => r.handle === 'B');
    // B faced D(105) then C(120) -> also 112.5.
    expect(B.oppPpg).toBe(112.5);
  });

  it('ranks the toughest slate #1', () => {
    const weeks = [
      [row(1, 1, 90), row(3, 1, 95), row(2, 2, 70), row(4, 2, 88)], // A-C, B-D
    ];
    const sos = strengthOfSchedule(weeks, RH, STR);
    // A faced C(120) -> highest; D faced B(80) -> lowest.
    expect(sos[0].handle).toBe('A');
    expect(sos[0].rank).toBe(1);
    expect(sos.at(-1).handle).toBe('D');
    expect(sos.every((r, i) => r.rank === i + 1)).toBe(true);
  });

  it('skips unplayed weeks and opponents with no known strength', () => {
    const weeks = [
      [row(1, 1, 0), row(2, 1, 0)],                       // not played
      [row(1, 2, 88), row(3, 2, 90)],                     // A vs C, but...
    ];
    const sos = strengthOfSchedule(weeks, RH, { A: 100, C: 120 }); // B/D unknown
    const A = sos.find((r) => r.handle === 'A');
    expect(A).toMatchObject({ games: 1, oppPpg: 120 });
    expect(strengthOfSchedule([], RH, STR)).toEqual([]);
  });
});

describe('SOS vs captured reality (2025 fixtures)', () => {
  const rh = rosterHandleMap(rosters, userHandleMap(users));
  const recs = recordsFromRosters(rosters, userHandleMap(users));
  const ppg = Object.fromEntries(Object.entries(recs).map(([h, r]) => {
    const g = r.wins + r.losses + r.ties;
    return [h, g ? r.pf / g : 0];
  }));
  const weekFiles = import.meta.glob('../src/lib/api/fixtures/matchups-2025-*.json', { eager: true, import: 'default' });
  const weeks = [];
  for (const path in weekFiles) {
    const wk = Number(path.match(/matchups-2025-(\d+)\.json$/)?.[1]);
    if (wk) weeks[wk - 1] = weekFiles[path];
  }

  it('every team\'s SOS sits within the league\'s ppg range', () => {
    const sos = strengthOfSchedule(weeks, rh, ppg);
    expect(sos.length).toBeGreaterThan(0);
    const vals = Object.values(ppg).filter((v) => v > 0);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    for (const r of sos) {
      expect(r.oppPpg).toBeGreaterThanOrEqual(lo - 0.05);
      expect(r.oppPpg).toBeLessThanOrEqual(hi + 0.05);
    }
    expect(sos[0].oppPpg).toBeGreaterThanOrEqual(sos.at(-1).oppPpg); // sorted toughest-first
  });
});
