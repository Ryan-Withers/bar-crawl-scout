import { describe, it, expect } from 'vitest';
import { pairMatchups } from '../src/lib/engine/gameday';

const rosterHandle = { 1: 'Mike', 2: 'Sarah', 3: 'Trevor', 4: 'Amy' };
const teamName = { Mike: 'Team M', Sarah: 'Team S', Trevor: 'Team T', Amy: 'Team A' };

describe('gameday pairing', () => {
  it('folds rows into head-to-heads, higher score first', () => {
    const rows = [
      { roster_id: 1, matchup_id: 5, points: 90 },
      { roster_id: 2, matchup_id: 5, points: 110 },
      { roster_id: 3, matchup_id: 6, points: 130 },
      { roster_id: 4, matchup_id: 6, points: 120 },
    ];
    const games = pairMatchups(rows, rosterHandle, teamName);
    // sorted by combined total: game 6 (250) before game 5 (200)
    expect(games[0].a.handle).toBe('Trevor');
    expect(games[0].b.handle).toBe('Amy');
    expect(games[0].margin).toBe(10);
    expect(games[1].a.handle).toBe('Sarah'); // 110 > 90 -> Sarah first
    expect(games[1].margin).toBe(20);
  });

  it('handles a bye (single roster in a matchup)', () => {
    const games = pairMatchups([{ roster_id: 1, matchup_id: 9, points: 100 }], rosterHandle, teamName);
    expect(games[0].b).toBeNull();
    expect(games[0].margin).toBe(0);
  });

  it('skips rows with no matchup_id or unknown roster', () => {
    const games = pairMatchups([
      { roster_id: 1, matchup_id: null, points: 50 },
      { roster_id: 99, matchup_id: 5, points: 50 },
    ], rosterHandle, teamName);
    expect(games).toEqual([]);
  });
});
