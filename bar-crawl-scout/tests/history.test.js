import { describe, it, expect } from 'vitest';
import { rosterHandleMap, buildSeasonData, vsLinesForPlayer, usageInputs } from '../src/api/history';
import { buildUsage } from '../src/lib/engine/usage';
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

  it('aggregates team denominators from the weekly blob into usage shares', () => {
    // Our RB "P1" is a DET RB. byId: id -> [name, pos, team]. Team totals summed
    // from teammates' pass_att / rush_att in the same blob.
    const byId = {
      P1: ['Gibbs', 'RB', 'DET'],
      QB: ['Goff', 'QB', 'DET'],
      WR: ['StBrown', 'WR', 'DET'],
      OTHER: ['SomeGuy', 'WR', 'GB'], // different team -> excluded
    };
    const week1 = {
      P1: { rec_tgt: 5, rush_att: 15, off_snp: 40, tm_off_snp: 60, pass_att: 0 },
      QB: { pass_att: 30, rush_att: 2 },
      WR: { rec_tgt: 10, rush_att: 0 },
      OTHER: { pass_att: 99, rush_att: 99 }, // must not leak into DET totals
    };
    const inputs = usageInputs('P1', [1], [week1], byId);
    expect(inputs[0]).toMatchObject({
      week: 1, recTgt: 5, rushAtt: 15, offSnp: 40, tmOffSnp: 60,
      teamPassAtt: 30,           // only DET QB
      teamPlays: 30 + 17,        // DET pass_att(30) + rush_att(15+2+0)
    });
    const summary = buildUsage(inputs);
    expect(summary.weeks[0].tgtShare).toBeCloseTo(16.7, 1); // 5/30
    expect(summary.avgSnap).toBeCloseTo(66.7, 1);           // 40/60
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

// ---------------------------------------------------------------------------
import realPicks from '../src/lib/api/fixtures/draft-picks-2026.json';

describe('pick numbers are within the round, not overall', () => {
  it('renders a 14th-round keeper as R14.07, not R14.137', () => {
    // Sleeper's pick_no is the OVERALL number. DraftPick.pick means the position
    // within the round, which is what the custody chain prints. Handing pick_no
    // straight over showed Brock Bowers as "Kept · R14.137".
    const rosterHandle = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, `m${i + 1}`]));
    const season = buildSeasonData('2026', rosterHandle, realPicks, []);
    for (const p of season.picks) {
      expect(p.pick, `pick ${p.player_id} sits inside its round`).toBeGreaterThanOrEqual(1);
      expect(p.pick).toBeLessThanOrEqual(10);
    }
    const bowers = season.picks.find((p) => p.player_id === '11604');
    expect(bowers.round).toBe(14);
    expect(bowers.pick).toBe(4);        // Ryan drafts from slot 4
    expect(bowers.is_keeper).toBe(true);
  });

  it('derives the position when Sleeper sends no draft_slot', () => {
    const rosterHandle = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, `m${i + 1}`]));
    const bare = [{ player_id: 'x', round: 2, pick_no: 13, roster_id: 1 }];
    expect(buildSeasonData('2026', rosterHandle, bare, []).picks[0].pick).toBe(3);
  });
});
