// GRADING THE DRAFT THAT HASN'T HAPPENED YET.
//
// The real draft is six days away, so there are no real picks to test against.
// What can be tested is the arithmetic and — more to the point — the three ways
// this could quietly grade the wrong thing: counting keepers as picks, scoring
// an unrankable flier as par, and rewarding whoever simply had the most picks.
import { describe, it, expect } from 'vitest';
import { gradeDraft, draftIsDone } from '../src/lib/engine/draftgrade';
import { gradeFor } from '../src/lib/engine/mockdraft';

// A tiny board: player id N is the Nth best man available.
const BOARD = {};
for (let i = 1; i <= 200; i += 1) {
  BOARD[String(i)] = { rank: i, name: `Player ${i}`, pos: ['QB', 'RB', 'WR', 'TE'][i % 4] };
}
const look = {
  rank: (id) => BOARD[id] || null,
  handleOf: { 1: 'ryan', 2: 'joshleota', 3: 'ImyHunter' },
  userHandle: { u9: 'ryan' },
};
const pick = (over, id, roster, extra = {}) => ({
  pick_no: over, round: Math.ceil(over / 10), draft_slot: ((over - 1) % 10) + 1,
  player_id: String(id), roster_id: roster, ...extra,
});
const rowFor = (g, handle) => g.rows.find((r) => r.handle === handle);

describe('the number it grades on', () => {
  it('scores nothing for taking the best man on the board', () => {
    // Pick 1 takes rank 1, pick 2 takes rank 2. Nobody has done anything
    // clever; par is B, not A.
    const g = gradeDraft([pick(1, 1, 1), pick(2, 2, 2)], look);
    expect(rowFor(g, 'ryan').perPick).toBe(0);
    expect(rowFor(g, 'ryan').grade).toBe('B');
  });

  it('pays you for a man who fell, and charges you for a reach', () => {
    const g = gradeDraft([pick(10, 1, 1), pick(11, 40, 2)], look);
    expect(rowFor(g, 'ryan').rawPerPick).toBe(9);        // took rank 1 at pick 10
    expect(rowFor(g, 'joshleota').rawPerPick).toBe(-29); // took rank 40 at pick 11
    expect(rowFor(g, 'ryan').grade).toBe('A+');
    expect(rowFor(g, 'joshleota').grade).toBe('D');
  });

  it('does not reward simply owning more picks', () => {
    // Nineteen picks against six is a real spread in this league. Both drafted
    // exactly at par; both should read the same.
    const many = Array.from({ length: 19 }, (_, i) => pick(i + 1, i + 1, 1));
    const few = Array.from({ length: 6 }, (_, i) => pick(i + 40, i + 40, 2));
    const g = gradeDraft([...many, ...few], look);
    expect(rowFor(g, 'ryan').perPick).toBe(0);
    expect(rowFor(g, 'joshleota').perPick).toBe(0);
    expect(rowFor(g, 'ryan').grade).toBe(rowFor(g, 'joshleota').grade);
    expect(rowFor(g, 'ryan').surplus).toBe(0);
  });
});

describe('what it refuses to count', () => {
  it('leaves keepers out — they are not picks', () => {
    // Sleeper files all thirty down this feed with is_keeper set, sitting on the
    // last selections each manager owns. Counted, they would read as enormous
    // reaches and bury everyone who kept a good player.
    const withKeepers = [
      pick(1, 1, 1),
      pick(120, 2, 1, { is_keeper: true }),   // rank 2 at pick 120: +118 if counted
      pick(121, 3, 2, { is_keeper: true }),
    ];
    const g = gradeDraft(withKeepers, look);
    expect(g.graded).toBe(1);
    expect(rowFor(g, 'ryan').picks).toHaveLength(1);
    expect(rowFor(g, 'ryan').surplus).toBe(0);
    expect(rowFor(g, 'joshleota')).toBeUndefined();  // kept, drafted nothing yet
  });

  it('does not hand out free steals for the keeper cells it skipped', () => {
    // Sleeper's keepers sit in the LAST picks each manager owns, so by round 13
    // the pick number runs ahead of the number of men actually taken. Ten keeper
    // cells before pick 130 means it is really the 120th man off the board, and
    // grading him against a 120-man board without that correction gifts +10.
    const keepers = Array.from({ length: 10 }, (_, i) => pick(100 + i, 60 + i, 3, { is_keeper: true }));
    const g = gradeDraft([...keepers, pick(130, 120, 1)], look);
    const p = rowFor(g, 'ryan').picks[0];
    expect(p.overall).toBe(130);   // what the draft board calls it
    expect(p.seq).toBe(120);       // what it actually was
    expect(p.delta).toBe(0);       // par, not a steal
  });

  it('skips a man it cannot rank instead of scoring him as par', () => {
    // A round-15 flier on somebody outside the board is not evidence either way.
    // Scored as zero it would drag a long draft toward the middle.
    const g = gradeDraft([pick(10, 1, 1), pick(150, 9999, 1)], look);
    expect(g.unranked).toBe(1);
    expect(g.graded).toBe(1);
    expect(rowFor(g, 'ryan').rawPerPick).toBe(9);
    // Graded, he is the whole field, so he is exactly average. You cannot beat
    // a room you are the only member of.
    expect(rowFor(g, 'ryan').perPick).toBe(0);
  });

  it('ignores rubbish rows rather than crediting them to nobody', () => {
    const g = gradeDraft([
      pick(1, 1, 1),
      { pick_no: 2, player_id: '', roster_id: 1 },        // no player
      { pick_no: 0, player_id: '5', roster_id: 1 },       // no pick number
      pick(3, 4, 77),                                     // roster we cannot name
    ], look);
    expect(g.graded).toBe(1);
    expect(g.rows).toHaveLength(1);
  });

  it('survives an empty or missing feed', () => {
    for (const input of [[], null, undefined]) {
      const g = gradeDraft(input, look);
      expect(g.rows).toEqual([]);
      expect(g.graded).toBe(0);
    }
  });
});

describe('who it names', () => {
  it('falls back to the picker when the roster is not one of ours', () => {
    const g = gradeDraft([{ pick_no: 5, player_id: '1', picked_by: 'u9' }], look);
    expect(rowFor(g, 'ryan').picks).toHaveLength(1);
  });

  it('pulls out the steals and the reaches, biggest first', () => {
    const g = gradeDraft([
      pick(20, 1, 1),    // +19
      pick(21, 10, 2),   // +11
      pick(22, 21, 3),   // +1, neither
      pick(30, 60, 1),   // -30
      pick(31, 50, 2),   // -19
    ], look);
    expect(g.steals.map((s) => s.delta)).toEqual([19, 11]);
    expect(g.reaches.map((s) => s.delta)).toEqual([-30, -19]);
  });

  it('ranks the managers and reports each one’s best and worst', () => {
    const g = gradeDraft([
      pick(20, 1, 1), pick(21, 30, 1),     // ryan: +19, -9 => +5 per pick
      pick(22, 22, 2), pick(23, 23, 2),    // josh: 0, 0
    ], look);
    expect(g.rows.map((r) => r.handle)).toEqual(['ryan', 'joshleota']);
    expect(rowFor(g, 'ryan').best.delta).toBe(19);
    expect(rowFor(g, 'ryan').worst.delta).toBe(-9);
    expect(rowFor(g, 'ryan').picks.map((p) => p.overall)).toEqual([20, 21]);
    // One pick has no worst — the same man is not both.
    const solo = gradeDraft([pick(20, 1, 1)], look);
    expect(rowFor(solo, 'ryan').worst).toBeNull();
    expect(rowFor(solo, 'ryan').best.name).toBe('Player 1');
  });

  it('counts the positions each manager actually took', () => {
    const g = gradeDraft([pick(1, 4, 1), pick(2, 8, 1), pick(3, 5, 1)], look);
    expect(rowFor(g, 'ryan').posCounts).toEqual({ QB: 2, RB: 1 });
  });
});

describe('when there is anything to grade', () => {
  it('waits for the draft to say complete, not for picks to exist', () => {
    // Thirty picks exist before a ball is thrown, because keepers live in the
    // feed. "Has picks" is not the test.
    expect(draftIsDone({ status: 'pre_draft' })).toBe(false);
    expect(draftIsDone({ status: 'drafting' })).toBe(false);
    expect(draftIsDone({ status: 'complete' })).toBe(true);
    expect(draftIsDone(null)).toBe(false);
    expect(draftIsDone({})).toBe(false);
  });

  it('cuts the grades on the same scale the mock room uses', () => {
    // One scale for both, so a mock A- and a real A- mean the same thing.
    expect(gradeFor(3)).toBe('A+');
    expect(gradeFor(0)).toBe('B');
    const g = gradeDraft([pick(10, 1, 1), pick(11, 40, 2)], look);
    expect(g.rows[0].grade).toBe(gradeFor(rowFor(g, 'ryan').perPick));
  });
});

// ---------------------------------------------------------------------------
describe('the two corrections without which everyone gets a D', () => {
  it('stops round fourteen from swamping round one', () => {
    // The board ranks 470 men; 120 get taken. A round-14 flier on the board's
    // 300th man is a -180 raw, which is not a reach — it is what round 14 is.
    // Past the draftable depth everyone is replacement level and ranks the same.
    const g = gradeDraft([pick(1, 1, 1), pick(120, 200, 1)], look, { depth: 150 });
    const late = rowFor(g, 'ryan').picks[1];
    expect(late.boardRank).toBe(200);   // what the board actually says
    expect(late.effRank).toBe(150);     // what it is graded on
    expect(late.delta).toBe(-30);       // not -80
  });

  it('leaves a man inside the depth exactly where the board has him', () => {
    const g = gradeDraft([pick(1, 1, 1), pick(100, 120, 1)], look, { depth: 150 });
    const p = rowFor(g, 'ryan').picks[1];
    expect(p.effRank).toBe(120);
    expect(p.delta).toBe(-20);
  });

  it('grades you against the room, not against a board nobody drafted off', () => {
    // Nobody drafts off a VORP board — they draft off ADP — so the whole room
    // comes out negative before anyone has done anything wrong. Two managers,
    // both 40 slots "behind" the board, both did exactly as well as the field.
    const g = gradeDraft([pick(1, 41, 1), pick(2, 42, 2)], look);
    expect(rowFor(g, 'ryan').rawPerPick).toBe(-40);
    expect(rowFor(g, 'ryan').perPick).toBe(0);
    expect(rowFor(g, 'ryan').grade).toBe('B');
    expect(rowFor(g, 'joshleota').grade).toBe('B');
    expect(g.field).toBe(-40);
  });

  it('still separates the room once it is centred', () => {
    // Same draft, one man who took the board and one who did not.
    const g = gradeDraft([pick(1, 1, 1), pick(2, 60, 2)], look);
    expect(rowFor(g, 'ryan').perPick).toBeGreaterThan(0);
    expect(rowFor(g, 'joshleota').perPick).toBeLessThan(0);
    expect(rowFor(g, 'ryan').perPick + rowFor(g, 'joshleota').perPick).toBeCloseTo(0, 5);
  });

  it('measures steals and reaches from the same line as the grades', () => {
    // Every pick here is 40 behind the board. If steals were measured from zero
    // this page would call the whole draft a disaster and then grade it a B.
    const picks = Array.from({ length: 6 }, (_, i) => pick(i + 1, i + 41, (i % 3) + 1));
    const g = gradeDraft(picks, look);
    expect(g.field).toBe(-40);
    expect(g.steals).toEqual([]);
    expect(g.reaches).toEqual([]);
  });
});
