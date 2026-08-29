// THE REAL BOARD — contract test against CAPTURED Sleeper reality.
// The 2026 draft fixture + traded picks must map to our handles, and the
// famous case must hold: Ryan owns round-1 picks 2 (via JShrimp341) AND 4.
import { describe, it, expect } from 'vitest';
import drafts from '../src/lib/api/fixtures/drafts-2026.json';
import traded from '../src/lib/api/fixtures/traded_picks-2026.json';
import users from '../src/lib/api/fixtures/users-2026.json';
import rosters from '../src/lib/api/fixtures/rosters-2026.json';
import { draftSlotBoard } from '../src/api/league';
import { sequenceFromSlots } from '../src/lib/engine/mockdraft';
import { TEAMS } from '../src/lib/data.js';

const draft = drafts.find((d) => d && d.draft_order);

describe('the real 2026 board', () => {
  it('maps every slot to a known handle', () => {
    const board = draftSlotBoard(draft, traded, users, rosters);
    expect(board).not.toBeNull();
    expect(board.slotHandles).toHaveLength(10);
    const handles = new Set(TEAMS.map(([h]) => h));
    for (const h of board.slotHandles) expect(handles.has(h), `${h} is a league handle`).toBe(true);
    expect(board.type).toBe('snake');
  });

  it('Ryan picks ONCE in round one — at 1.04, his own slot', () => {
    // This test used to assert he also held 1.02, bought from JShrimp341. He did,
    // and then he sold it on to joshleota, and the capture caught it. data.js
    // still hard-codes two first-rounders for him (CAPITAL Ryan:[2,0,3]), which
    // is the argument for deriving pick capital instead of typing it.
    const board = draftSlotBoard(draft, traded, users, rosters);
    expect(board.slotHandles[3]).toBe('Ryan');       // base slot 4
    expect(board.slotHandles[1]).toBe('JShrimp341'); // slot 2's ORIGINAL owner
    const seq = sequenceFromSlots(board.slotHandles, board.overrides, 11, board.type);
    expect(seq[3]).toBe('Ryan');       // 1.04 — his own
    expect(seq[1]).toBe('joshleota');  // 1.02 — JShrimp's, went through Ryan, now Josh's
    expect(seq.slice(0, 10).filter((h) => h === 'Ryan')).toHaveLength(1);
    expect(seq).toHaveLength(110);     // 11 uniform rounds of 10 slots
  });

  it('only same-season trades apply, and round 2 snakes', () => {
    const board = draftSlotBoard(draft, traded, users, rosters);
    for (const o of board.overrides) {
      expect(o.slot).toBeGreaterThanOrEqual(1);
      expect(o.slot).toBeLessThanOrEqual(10);
    }
    // 2027 picks exist in the fixture but must not leak into the 2026 board.
    const applied = board.overrides.length;
    const sameSeason = traded.filter((t) => t.season === '2026').length;
    expect(applied).toBeLessThanOrEqual(sameSeason);
    // Snake check: round 2 opens with slot 10's owner (or its trade override).
    const seq = sequenceFromSlots(board.slotHandles, board.overrides, 2, 'snake');
    const ov = board.overrides.find((o) => o.round === 2 && o.slot === 10);
    expect(seq[10]).toBe(ov ? ov.handle : board.slotHandles[9]);
  });

  it('degrades to null on junk input (offline, weird shapes)', () => {
    expect(draftSlotBoard(null, traded, users, rosters)).toBeNull();
    expect(draftSlotBoard({ draft_order: null }, traded, users, rosters)).toBeNull();
    expect(draftSlotBoard(draft, traded, {}, rosters)).toBeNull();
    expect(draftSlotBoard(draft, 'nonsense', users, rosters)).not.toBeNull(); // bad trades -> just no overrides
  });
});
