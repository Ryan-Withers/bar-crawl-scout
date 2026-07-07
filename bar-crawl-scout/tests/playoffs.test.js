import { describe, it, expect } from 'vitest';
import { rankStandings } from '../src/lib/engine/standings';
import { playoffPicture } from '../src/lib/engine/playoffs';

const R = (h, w, l, pf) => ({ handle: h, team: h, wins: w, losses: l, ties: 0, pf, pa: 0 });

describe('playoff picture', () => {
  it('marks clinched, in, hunt and eliminated across the cut line', () => {
    // 6 teams, 2 spots, 1 game left.
    const ranked = rankStandings([
      R('A', 12, 1, 1900), // runaway leader
      R('B', 9, 4, 1800),
      R('C', 8, 5, 1700),  // just outside, can still catch B
      R('D', 3, 10, 1500), // math'd out
      R('E', 7, 6, 1600),
      R('F', 6, 7, 1550),
    ]);
    const pic = playoffPicture(ranked, 2, 1);
    const by = Object.fromEntries(pic.map((p) => [p.handle, p]));
    expect(by.A.zone).toBe('clinched'); // 12 wins, best challenger maxes 9 -> clinched
    expect(by.A.seed).toBe(1);
    expect(by.B.zone).toBe('in');       // in a spot but not safe (C at 8 + 1 = 9 can tie)
    expect(by.C.zone).toBe('hunt');     // outside but alive
    expect(by.D.zone).toBe('out');      // 3 + 1 = 4 < last-in wins -> eliminated
  });

  it('magic number is 0 for a clinched team and positive for a live one', () => {
    const ranked = rankStandings([R('A', 12, 1, 1900), R('B', 9, 4, 1800), R('C', 8, 5, 1700)]);
    const pic = playoffPicture(ranked, 2, 1);
    expect(pic.find((p) => p.handle === 'A').magic).toBe(0);
    expect(pic.find((p) => p.handle === 'B').magic).toBeGreaterThan(0);
  });
});
