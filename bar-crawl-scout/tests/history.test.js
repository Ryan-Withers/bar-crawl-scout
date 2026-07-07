import { describe, it, expect } from 'vitest';
import { rosterHandleMap, buildSeasonData, vsLinesForPlayer } from '../src/api/history';
import { chainOfCustody } from '../src/lib/engine/chain';
import { vsLeague } from '../src/lib/engine/vsleague';

const userHandle = { u1: 'Mike', u2: 'Trevor', u3: 'Sarah' };
const rosters = [
  { roster_id: 1, owner_id: 'u1' },
  { roster_id: 2, owner_id: 'u2' },
  { roster_id: 3, owner_id: 'u3' },
];

describe('history resolver', () => {
  it('maps roster_id -> handle via owner', () => {
    expect(rosterHandleMap(rosters, userHandle)).toEqual({ 1: 'Mike', 2: 'Trevor', 3: 'Sarah' });
  });

  it('feeds a walkable SeasonData into the chain engine', () => {
    const rh = rosterHandleMap(rosters, userHandle);
    const sd = buildSeasonData('2024', rh,
      [{ player_id: 'X', round: 3, pick_no: 2, roster_id: 1 }],
      [
        { type: 'waiver', status: 'complete', leg: 7, created: 2000, settings: { waiver_bid: 23 }, adds: { X: 2 } },
        { type: 'waiver', status: 'failed', leg: 8, created: 3000, adds: { X: 3 } }, // dropped: not complete
      ],
    );
    const ev = chainOfCustody('X', [sd]);
    expect(ev.map((e) => e.kind)).toEqual(['draft', 'faab']);
    expect(ev[1]).toMatchObject({ handle: 'Trevor', detail: 'FAAB claim · $23' });
  });

  it('derives vs-the-league lines from weekly matchups', () => {
    const rh = rosterHandleMap(rosters, userHandle);
    const weeks = [
      [ // week 1: roster 1 (has X) vs roster 2 (Trevor)
        { roster_id: 1, matchup_id: 5, players: ['X'], players_points: { X: 20 } },
        { roster_id: 2, matchup_id: 5, players: ['Y'], players_points: { Y: 8 } },
      ],
      [ // week 2: roster 1 (has X) vs roster 3 (Sarah)
        { roster_id: 1, matchup_id: 6, players: ['X'], players_points: { X: 12 } },
        { roster_id: 3, matchup_id: 6, players: ['Z'], players_points: { Z: 9 } },
      ],
    ];
    const lines = vsLinesForPlayer('X', weeks, rh);
    const rows = vsLeague(lines);
    expect(rows.map((r) => r.opponent)).toEqual(['Trevor', 'Sarah']);
    expect(rows[0]).toMatchObject({ opponent: 'Trevor', avg: 20 });
  });
});
