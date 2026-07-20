// THE RECORD BOOK — known answers first, then a pass over CAPTURED reality.
import { describe, it, expect } from 'vitest';
import { recordBook } from '../src/lib/engine/recordbook';
import { rosterHandleMap } from '../src/api/history';
import { userHandleMap } from '../src/api/league';
import users from '../src/lib/api/fixtures/users-2025.json';
import rosters from '../src/lib/api/fixtures/rosters-2025.json';

const RH = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
const row = (roster_id, matchup_id, points) => ({ roster_id, matchup_id, points });

describe('recordBook — known answers', () => {
  it('finds the season extremes across weeks and games', () => {
    const weeks = [
      // Wk1: A150 vs B70 (blowout, margin 80), C101 vs D99 (nail-biter, margin 2)
      [row(1, 1, 150), row(2, 1, 70), row(3, 2, 101), row(4, 2, 99)],
      // Wk2: A120 vs C118 (combined 238 shootout), B40 (season low) vs D110
      [row(1, 1, 120), row(3, 1, 118), row(2, 2, 40), row(4, 2, 110)],
    ];
    const rb = recordBook(weeks, RH);
    expect(rb.topWeek).toMatchObject({ handle: 'A', week: 1, pts: 150 });
    expect(rb.lowWeek).toMatchObject({ handle: 'B', week: 2, pts: 40 });
    expect(rb.blowout).toMatchObject({ winner: 'A', loser: 'B', week: 1, margin: 80 });
    expect(rb.nailbiter).toMatchObject({ winner: 'C', loser: 'D', week: 1, margin: 2 });
    expect(rb.shootout).toMatchObject({ week: 2, combined: 238 });
  });

  it('skips unplayed (0-0) weeks and ties are neither blowout nor nail-biter', () => {
    const weeks = [
      [row(1, 1, 100), row(2, 1, 100)],  // a tie
      [row(1, 1, 0), row(2, 1, 0)],       // not played
    ];
    const rb = recordBook(weeks, RH);
    expect(rb.topWeek).toMatchObject({ pts: 100 });
    expect(rb.blowout).toBeNull();
    expect(rb.nailbiter).toBeNull();
    expect(rb.shootout).toMatchObject({ combined: 200 }); // the tie still counts as a shootout
  });

  it('is all-null on empty / junk input', () => {
    const rb = recordBook([], RH);
    expect(rb).toEqual({ topWeek: null, lowWeek: null, blowout: null, nailbiter: null, shootout: null });
    expect(recordBook(undefined, RH).topWeek).toBeNull();
  });
});

describe('record book vs captured reality (2025 fixtures)', () => {
  const rh = rosterHandleMap(rosters, userHandleMap(users));
  const weekFiles = import.meta.glob('../src/lib/api/fixtures/matchups-2025-*.json', { eager: true, import: 'default' });
  const weeks = [];
  for (const path in weekFiles) {
    const wk = Number(path.match(/matchups-2025-(\d+)\.json$/)?.[1]);
    if (wk) weeks[wk - 1] = weekFiles[path];
  }

  it('produces coherent, self-consistent records', () => {
    const rb = recordBook(weeks, rh);
    expect(rb.topWeek).not.toBeNull();
    expect(rb.topWeek.pts).toBeGreaterThanOrEqual(rb.lowWeek.pts);
    // The blowout margin is the widest; the nail-biter the narrowest (non-tie).
    expect(rb.blowout.margin).toBeGreaterThanOrEqual(rb.nailbiter.margin);
    // A game's combined can't exceed twice the season-high team week.
    expect(rb.shootout.combined).toBeLessThanOrEqual(rb.topWeek.pts * 2 + 0.01);
    for (const h of [rb.blowout.winner, rb.blowout.loser]) {
      expect(Object.values(rh)).toContain(h);
    }
  });
});
