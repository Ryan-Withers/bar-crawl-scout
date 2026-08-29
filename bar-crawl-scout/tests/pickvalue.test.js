// WHAT A PICK IS WORTH — reconciled against the captured 2026 board.
//
// The old pricing put every pick at slot 4 on a linear board. Both halves of
// that are wrong, and the tests below are written so the old behaviour cannot
// come back without failing.
import { describe, it, expect } from 'vitest';
import drafts from '../src/lib/api/fixtures/drafts-2026.json';
import traded from '../src/lib/api/fixtures/traded_picks-2026.json';
import users from '../src/lib/api/fixtures/users-2026.json';
import rosters from '../src/lib/api/fixtures/rosters-2026.json';
import picks from '../src/lib/api/fixtures/draft-picks-2026.json';
import playersBlob from '../src/lib/api/fixtures/players-trimmed.json';
import { draftSlotBoard, userHandleMap } from '../src/api/league';
import { keeperBoard, keeperLedger, pickCode } from '../src/lib/engine/keepers';
import { overallOf, worthAt, pricePick, trueCost, tradablePicks } from '../src/lib/engine/pickvalue';

const draft = drafts.find((d) => d && d.draft_order);
const uh = userHandleMap(users);
const sb = draftSlotBoard(draft, traded, users, rosters);
const nameOf = (id) => {
  const p = playersBlob[String(id)];
  return p ? { name: p.full_name, pos: p.position } : null;
};
const ledger = keeperLedger(rosters, uh, nameOf);
const rosterHandle = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
const board = keeperBoard(sb, draft.settings.rounds, ledger, picks, rosterHandle);

// A descending board of values, steep at the top like a real one.
const VALUES = Array.from({ length: 300 }, (_, i) => Math.round(160 * Math.pow(0.985, i)));

describe('overallOf', () => {
  it('walks left to right on odd rounds', () => {
    expect(overallOf(1, 1, 10)).toBe(1);
    expect(overallOf(1, 4, 10)).toBe(4);
    expect(overallOf(3, 4, 10)).toBe(24);
  });

  it('turns around on even rounds — the snake the old maths ignored', () => {
    // Slot 4 in round 2 is the SEVENTH pick of that round, not the fourth.
    expect(overallOf(2, 4, 10)).toBe(17);
    expect(overallOf(2, 1, 10)).toBe(20);
    expect(overallOf(2, 10, 10)).toBe(11);
    // The old formula said (2-1)*10+4 = 14. It is 17.
    expect(overallOf(2, 4, 10)).not.toBe(14);
  });

  it('does not turn around on a linear board', () => {
    expect(overallOf(2, 4, 10, 'linear')).toBe(14);
  });

  it('agrees with the real board cell for cell', () => {
    for (const c of board.cells) {
      expect(overallOf(c.round, c.slot, board.teams, board.type)).toBe(c.pickNo);
    }
  });
});

describe('worthAt', () => {
  it('prices a pick as the man it lands', () => {
    expect(worthAt(VALUES, 1)).toBe(VALUES[0]);
    expect(worthAt(VALUES, 25)).toBe(VALUES[24]);
  });

  it('prices a pick past the end of the board at nothing', () => {
    expect(worthAt(VALUES, 5000)).toBe(0);
    expect(worthAt([], 1)).toBe(0);
    expect(worthAt(VALUES, 0)).toBe(0);
    expect(worthAt(VALUES, -3)).toBe(0);
  });
});

describe('pricePick — the slot is the whole point', () => {
  const opts = { teams: 10, type: 'snake', season: '2026' };

  it('prices the SAME round differently for different seats', () => {
    const early = pricePick({ season: '2026', round: 2, slot: 1 }, VALUES, opts);
    const late = pricePick({ season: '2026', round: 2, slot: 10 }, VALUES, opts);
    // Round 2 snakes back, so slot 10 picks FIRST and is worth more.
    expect(late.overall).toBe(11);
    expect(early.overall).toBe(20);
    expect(late.value).toBeGreaterThan(early.value);
  });

  it('takes the MIDDLE of the round when the seat is unknown, not slot 4', () => {
    const anon = pricePick({ season: '2026', round: 1 }, VALUES, opts);
    expect(anon.overall).toBeNull();          // no seat claimed
    expect(anon.value).toBe(worthAt(VALUES, 5));
    expect(anon.value).not.toBe(worthAt(VALUES, 4));
  });

  it('discounts a future season once, and says it did', () => {
    const now = pricePick({ season: '2026', round: 1, slot: 4 }, VALUES, opts);
    const next = pricePick({ season: '2027', round: 1, slot: 4 }, VALUES, opts);
    expect(next.future).toBe(true);
    expect(now.future).toBe(false);
    expect(next.value).toBe(Math.round(now.value * 0.6));
  });

  it('prices a keeper round at nothing once the board runs out', () => {
    const deep = pricePick({ season: '2026', round: 15, slot: 4 }, VALUES.slice(0, 120), opts);
    expect(deep.value).toBe(0);
  });
});

describe('the ride-up — what selling a bottom pick REALLY costs', () => {
  it("selling the pick a keeper sits on costs Ryan his DEEPEST LIVE one instead", () => {
    // His keepers already sit at 12.07 / 13.04 / 14.07 precisely because the
    // 15th is gone — that sale cost him a twelfth, not a fifteenth. Sell the
    // twelfth too and the same thing happens again: the keeper rides onto 11.06,
    // which is the pick that actually leaves his board.
    const keeperCell = board.cells.find((c) => c.handle === 'Ryan' && c.keeper && c.round === 12);
    expect(keeperCell.pickNo).toBe(117);
    expect(pickCode(117, board.teams)).toBe('12.07');
    const cost = trueCost(board, 'Ryan', 117);
    expect(cost.rode).toBe(true);
    expect(pickCode(cost.pickNo, board.teams)).toBe('11.06');
  });

  it('and the historical sale is visible in the placement itself', () => {
    // Everyone who still owns his 15th has his keepers in rounds 13-15. The two
    // who sold one have a keeper in round 12. That IS the cost, on the board.
    const inR12 = board.cells.filter((c) => c.keeper && c.round === 12).map((c) => c.handle).sort();
    expect(inR12).toEqual(['Ryan', 'jpdonners']);
    for (const h of ['ATorelli4', 'WinzTheBrah', 'ShaydenB']) {
      const rounds = board.cells.filter((c) => c.keeper && c.handle === h).map((c) => c.round);
      expect(Math.min(...rounds), `${h} keeps no earlier than round 13`).toBeGreaterThanOrEqual(13);
    }
  });

  it('selling a LIVE pick costs exactly that pick', () => {
    const live = board.cells.find((c) => c.handle === 'Ryan' && !c.keeper);
    const cost = trueCost(board, 'Ryan', live.pickNo);
    expect(cost).toEqual({ pickNo: live.pickNo, rode: false });
  });

  it('says nothing about a pick that is not his', () => {
    expect(trueCost(board, 'Ryan', 1)).toEqual({ pickNo: 1, rode: false });
  });

  it('degrades when a manager holds nothing live', () => {
    const stripped = { ...board, cells: board.cells.map((c) => (c.handle === 'Ryan' ? { ...c, keeper: c.keeper || { playerId: 'x', name: 'x', pos: 'RB' } } : c)) };
    expect(trueCost(stripped, 'Ryan', 117).rode).toBe(false);
  });
});

describe('tradablePicks', () => {
  const mine = tradablePicks(board, 'Ryan');

  it('lists everything he holds, keepers marked', () => {
    expect(mine).toHaveLength(16);                       // 13 live + 3 keeper cells
    expect(mine.filter((p) => p.keeper)).toHaveLength(3);
    expect(mine.filter((p) => !p.keeper)).toHaveLength(13);
  });

  it('comes back in board order', () => {
    const nums = mine.map((p) => p.pickNo);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  it('never lists a pick somebody else owns', () => {
    for (const p of mine) {
      expect(board.cells.find((c) => c.pickNo === p.pickNo).handle).toBe('Ryan');
    }
  });
});
