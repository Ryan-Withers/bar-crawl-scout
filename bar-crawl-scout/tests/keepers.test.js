// THE KEEPER BOARD — reconciled against the CAPTURED 2026 board, not invented.
//
// Every number in here was read off Sleeper's own draft after the keepers were
// locked. That matters more than usual: the whole point of this engine is that
// the app stopped guessing which three each manager is keeping, so a test built
// from a hand-written guess would defeat it.
import { describe, it, expect } from 'vitest';
import drafts from '../src/lib/api/fixtures/drafts-2026.json';
import traded from '../src/lib/api/fixtures/traded_picks-2026.json';
import users from '../src/lib/api/fixtures/users-2026.json';
import rosters from '../src/lib/api/fixtures/rosters-2026.json';
import picks from '../src/lib/api/fixtures/draft-picks-2026.json';
import playersBlob from '../src/lib/api/fixtures/players-trimmed.json';
import { draftSlotBoard, userHandleMap } from '../src/api/league';
import {
  slotAt, pickNoAt, pickCode, allCells, derivePlacement, keeperBoard,
  liveCells, keeperCells, livePicksFor, liveSequence, livePickCounts,
  fullyLiveRounds, keeperLedger, keptIds, keptNames, incompleteKeepers, liveSequenceMeta,
} from '../src/lib/engine/keepers';

const draft = drafts.find((d) => d && d.draft_order);
const ROUNDS = draft.settings.rounds;      // 15
const TEAMS = draft.settings.teams;        // 10
const uh = userHandleMap(users);
const sb = draftSlotBoard(draft, traded, users, rosters);
const rosterHandle = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
const nameOf = (id) => {
  const p = playersBlob[String(id)];
  return p ? { name: p.full_name, pos: p.position } : null;
};
const ledger = keeperLedger(rosters, uh, nameOf);
const board = keeperBoard(sb, ROUNDS, ledger, picks, rosterHandle);

describe('snake geometry', () => {
  it('walks left to right on odd rounds and back on even', () => {
    expect(slotAt(1, 0, 10)).toBe(1);
    expect(slotAt(1, 9, 10)).toBe(10);
    expect(slotAt(2, 0, 10)).toBe(10);
    expect(slotAt(2, 9, 10)).toBe(1);
    // Linear drafts don't turn around.
    expect(slotAt(2, 0, 10, 'linear')).toBe(1);
  });

  it('pickNoAt inverts slotAt for every cell of a 15x10 board', () => {
    for (let r = 1; r <= 15; r++) {
      for (let i = 0; i < 10; i++) {
        const slot = slotAt(r, i, 10);
        expect(pickNoAt(r, slot, 10)).toBe((r - 1) * 10 + i + 1);
      }
    }
  });

  it('reads a pick number back as a round and a pick', () => {
    expect(pickCode(1, 10)).toBe('1.01');
    expect(pickCode(4, 10)).toBe('1.04');
    expect(pickCode(117, 10)).toBe('12.07');
    expect(pickCode(150, 10)).toBe('15.10');
  });
});

describe('the captured 2026 board', () => {
  it('lays out all 150 picks', () => {
    expect(sb).not.toBeNull();
    expect(board).not.toBeNull();
    expect(board.cells).toHaveLength(ROUNDS * TEAMS);
    expect(board.teams).toBe(10);
    expect(board.rounds).toBe(15);
  });

  it('takes the keeper placement from Sleeper itself, not from our arithmetic', () => {
    expect(board.source).toBe('board');
  });

  it('30 picks are already spent on keepers, leaving 120 live', () => {
    expect(keeperCells(board)).toHaveLength(30);
    expect(liveCells(board)).toHaveLength(120);
    expect(liveSequence(board)).toHaveLength(120);
  });

  it('every manager keeps exactly three', () => {
    expect(incompleteKeepers(ledger, 3)).toEqual([]);
    expect(keptIds(ledger).size).toBe(30);
  });
});

describe('keepers at the BOTTOM — and what the bottom trades did to it', () => {
  it('rounds 1 to 11 are wholly live; the keepers sit in 12 to 15', () => {
    expect(fullyLiveRounds(board)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('round 12 is NOT clean — two managers sold their 15th, so a keeper rode up', () => {
    // This is the whole reason the live board cannot be "rounds 1-12". Ryan and
    // jpdonners each traded a 15th away, so their third keeper landed in round 12
    // and took a live pick off them that a naive truncation would hand back.
    const r12 = keeperCells(board).filter((c) => c.round === 12);
    expect(r12).toHaveLength(2);
    expect(r12.map((c) => c.handle).sort()).toEqual(['Ryan', 'jpdonners']);
    expect(r12.map((c) => c.pickNo).sort((a, b) => a - b)).toEqual([115, 117]);
  });

  it('and round 13 still has two LIVE picks — held by the men who bought those 15ths', () => {
    const live13 = liveCells(board).filter((c) => c.round === 13);
    expect(live13).toHaveLength(2);
    expect(live13.map((c) => c.handle).sort()).toEqual(['ImyHunter', 'JohnnyDuff']);
  });

  it('rounds 14 and 15 are entirely keepers', () => {
    expect(liveCells(board).filter((c) => c.round >= 14)).toHaveLength(0);
  });
});

describe('the derivation rule reproduces Sleeper exactly', () => {
  // The picks endpoint returns [] until the commissioner assigns keepers to the
  // board. When that happens the app must still know which picks are gone, so it
  // derives them: the N highest-numbered picks a manager still owns. Running that
  // rule against the real board is the only honest way to know it is right.
  it('derives the same 30 consumed picks the real board shows', () => {
    const cells = allCells(sb, ROUNDS);
    const counts = Object.fromEntries(Object.entries(ledger).map(([h, men]) => [h, men.length]));
    const derived = derivePlacement(cells, counts);
    const actual = new Set(keeperCells(board).map((c) => c.pickNo));
    expect([...derived].sort((a, b) => a - b)).toEqual([...actual].sort((a, b) => a - b));
  });

  it('falls back to the derived board when the picks endpoint is empty', () => {
    const fallback = keeperBoard(sb, ROUNDS, ledger, [], rosterHandle);
    expect(fallback.source).toBe('derived');
    expect(keeperCells(fallback)).toHaveLength(30);
    expect(liveCells(fallback)).toHaveLength(120);
    // And it agrees with the real thing pick for pick.
    expect(keeperCells(fallback).map((c) => c.pickNo).sort((a, b) => a - b))
      .toEqual(keeperCells(board).map((c) => c.pickNo).sort((a, b) => a - b));
  });

  it('gives a manager who is keeping nobody none of his picks back', () => {
    const cells = allCells(sb, ROUNDS);
    expect(derivePlacement(cells, {}).size).toBe(0);
    expect(derivePlacement(cells, { Ryan: 0 }).size).toBe(0);
  });

  it('never takes more picks than a manager actually holds', () => {
    const cells = allCells(sb, ROUNDS);
    const greedy = derivePlacement(cells, { JohnnyDuff: 99 });
    const duffPicks = cells.filter((c) => c.handle === 'JohnnyDuff').length;
    expect(greedy.size).toBe(duffPicks);
  });
});

describe("Ryan's live board", () => {
  const mine = livePicksFor(board, 'Ryan');

  it('is 13 picks, opening at 1.04', () => {
    expect(mine).toHaveLength(13);
    expect(pickCode(mine[0].pickNo, TEAMS)).toBe('1.04');
  });

  it('has NO second-round pick — it was traded away', () => {
    expect(mine.some((c) => c.round === 2)).toBe(false);
  });

  it('has three third-rounders, two of them bought', () => {
    const thirds = mine.filter((c) => c.round === 3);
    expect(thirds).toHaveLength(3);
    expect(thirds.filter((c) => c.via).map((c) => c.via).sort()).toEqual(['JShrimp341', 'JohnnyDuff']);
  });

  it('ends at 11.06 — his 12th is a keeper and his 15th belongs to JohnnyDuff', () => {
    expect(pickCode(mine[mine.length - 1].pickNo, TEAMS)).toBe('11.06');
    const duff = livePicksFor(board, 'JohnnyDuff');
    expect(duff.every((c) => c.pickNo !== 144)).toBe(true); // 144 is a keeper cell now
  });

  it('does NOT hold pick 1.02 — that one moved on to joshleota', () => {
    // data.js still claims two first-rounders. The board says one.
    const firsts = mine.filter((c) => c.round === 1);
    expect(firsts).toHaveLength(1);
    expect(board.cells.find((c) => c.pickNo === 2).handle).toBe('joshleota');
  });
});

describe('live pick counts across the league', () => {
  it('adds up to the 120 live picks', () => {
    const counts = livePickCounts(board);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(120);
  });

  it('ATorelli4 is the richest board in the league, jpdonners the poorest', () => {
    const counts = livePickCounts(board);
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    expect(ranked[0]).toEqual(['ATorelli4', 19]);
    expect(ranked[ranked.length - 1]).toEqual(['jpdonners', 6]);
  });

  it('does NOT come out even per manager — traded picks see to that', () => {
    // Worth stating as a test because it is counter-intuitive and it changes how
    // draft day actually goes. The LEAGUE balances (150 = 10 x 15) but no
    // individual does: ATorelli4 drafts 19 men into 15 spots and has to cut
    // seven, while jpdonners ends six short and lives on waivers. Anything in
    // this app that assumes "everyone fills a 15-man roster" is wrong.
    const counts = livePickCounts(board);
    const total = Object.entries(ledger).map(([h, men]) => [h, counts[h] + men.length]);
    expect(total.reduce((n, [, t]) => n + t, 0)).toBe(150);
    const byHandle = Object.fromEntries(total);
    expect(byHandle.ATorelli4).toBe(22);   // 7 over
    expect(byHandle.jpdonners).toBe(9);    // 6 short
    expect(byHandle.Ryan).toBe(16);        // 1 over — Ryan cuts one
    expect(total.filter(([, t]) => t === 15)).toHaveLength(0);
  });
});

describe('the keeper ledger', () => {
  it("reads each manager's three off the roster, resolved to names", () => {
    expect(ledger.Ryan.map((m) => m.name).sort())
      .toEqual(["Brock Bowers", "Ja'Marr Chase", 'Tetairoa McMillan']);
    expect(ledger.jpdonners.map((m) => m.name).sort())
      .toEqual(['CeeDee Lamb', 'Lamar Jackson', 'Zay Flowers']);
  });

  it('names the men who are OFF the board', () => {
    const names = keptNames(ledger);
    expect(names.has('Justin Jefferson')).toBe(true);   // ShaydenB kept him
    expect(names.has('Bijan Robinson')).toBe(true);
    // ...and does not name the ones who came back into it.
    expect(names.has('Drake London')).toBe(false);
    expect(names.has('Kyren Williams')).toBe(false);
    expect(names.has('Josh Allen')).toBe(false);
  });

  it('flags a manager who has not locked his full three', () => {
    const short = { Ryan: ledger.Ryan, jduddy9: [ledger.jduddy9[0]] };
    expect(incompleteKeepers(short, 3)).toEqual(['jduddy9']);
  });
});

describe('degrading rather than throwing', () => {
  it('returns null on a missing or malformed slot board', () => {
    expect(keeperBoard(null, 15, ledger, picks)).toBeNull();
    expect(keeperBoard({ slotHandles: [], overrides: [], type: 'snake' }, 15, ledger, picks)).toBeNull();
    expect(keeperBoard(sb, 0, ledger, picks)).toBeNull();
    expect(keeperBoard(sb, NaN, ledger, picks)).toBeNull();
  });

  it('says "none" when nobody has kept anyone yet, and leaves all 150 live', () => {
    const empty = keeperBoard(sb, ROUNDS, {}, []);
    expect(empty.source).toBe('none');
    expect(liveCells(empty)).toHaveLength(150);
  });

  it('survives a keeper pick for a player the blob has never heard of', () => {
    const odd = [{ round: 15, pick_no: 150, roster_id: 6, player_id: '999999', is_keeper: true, metadata: null }];
    const b = keeperBoard(sb, ROUNDS, ledger, odd, rosterHandle);
    const cell = b.cells.find((c) => c.pickNo === 150);
    expect(cell.keeper.playerId).toBe('999999');
    expect(cell.keeper.name).toBe('999999'); // falls back to the id rather than blank
  });

  it('handles a roster with no keepers array at all', () => {
    const stripped = rosters.map((r) => ({ ...r, keepers: null }));
    const l = keeperLedger(stripped, uh, nameOf);
    expect(Object.values(l).every((men) => men.length === 0)).toBe(true);
    expect(keptIds(l).size).toBe(0);
  });

  it('ignores rosters whose owner is not a known handle', () => {
    const l = keeperLedger([{ roster_id: 99, owner_id: 'nobody', keepers: ['1'] }], uh, nameOf);
    expect(l).toEqual({});
  });
});

// ---------------------------------------------------------------------------

import picks2025 from '../src/lib/api/fixtures/draft-picks-2025.json';
import picks2024 from '../src/lib/api/fixtures/draft-picks-2024.json';
import { keptInSeason, keeperOwners, contracts } from '../src/lib/engine/keepers';

const prior = keeperOwners(picks2025);
const handleOfRoster = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
const rosterOfHandle = Object.fromEntries(Object.entries(handleOfRoster).map(([id, h]) => [h, Number(id)]));

describe('the contract clock, derived rather than typed', () => {
  it('reads last season\'s keepers straight off the 2025 draft', () => {
    // data.js hand-types a 30-name KEPT2025 set. The 2025 draft already carries
    // the answer as thirty is_keeper picks.
    expect(keptInSeason(picks2025).size).toBe(30);
  });

  it('finds none in 2024 — the first draft this dynasty held', () => {
    expect(keptInSeason(picks2024).size).toBe(0);
    expect(keptInSeason(null).size).toBe(0);
    expect(keptInSeason(undefined).size).toBe(0);
  });

  it('roster ids are stable across the season change, so "same manager" means something', () => {
    expect(handleOfRoster[1]).toBe('Ryan');
    expect(handleOfRoster[8]).toBe('ATorelli4');
  });

  it('splits this year\'s thirty into 13 fresh, 13 on their last year, 4 that changed hands', () => {
    let fresh = 0; let repeat = 0; let moved = 0;
    for (const [h, men] of Object.entries(ledger)) {
      for (const c of contracts(men, prior, rosterOfHandle[h])) {
        if (!c.repeat) fresh++;
        else if (c.changedHands) moved++;
        else repeat++;
      }
    }
    expect(fresh).toBe(13);
    expect(repeat).toBe(13);
    expect(moved).toBe(4);
  });

  it("Ryan's own three: Chase is on his last year, Bowers and McMillan are fresh", () => {
    const cs = contracts(ledger.Ryan, prior, rosterOfHandle.Ryan);
    const by = Object.fromEntries(cs.map((c) => [c.name, c]));
    expect(by["Ja'Marr Chase"].yearsLeft).toBe(1);
    expect(by["Ja'Marr Chase"].repeat).toBe(true);
    expect(by['Brock Bowers'].yearsLeft).toBe(2);
    expect(by['Tetairoa McMillan'].yearsLeft).toBe(2);
  });

  it('the four who changed hands are exactly Achane, McCaffrey, Gibbs and Jefferson', () => {
    const moved = [];
    for (const [h, men] of Object.entries(ledger)) {
      for (const c of contracts(men, prior, rosterOfHandle[h])) if (c.changedHands) moved.push(c.name);
    }
    expect(moved.sort()).toEqual([
      'Christian McCaffrey', "De'Von Achane", 'Jahmyr Gibbs', 'Justin Jefferson',
    ]);
  });

  it('and the trade-reset rule is what decides their 2027 — it is worth two elite assets', () => {
    // Tenure follows the PLAYER by default, which is what this app has always
    // done: kept last season, so this is his last, whoever holds him now.
    const shayden = contracts(ledger.ShaydenB, prior, rosterOfHandle.ShaydenB);
    const jefferson = shayden.find((c) => c.name === 'Justin Jefferson');
    expect(jefferson.yearsLeft).toBe(1);
    expect(jefferson.changedHands).toBe(true);

    // If the league says a trade resets the clock, he has two years and the app
    // has been pricing him at replacement for 2027.
    const reset = contracts(ledger.ShaydenB, prior, rosterOfHandle.ShaydenB, { resetOnTrade: true });
    expect(reset.find((c) => c.name === 'Justin Jefferson').yearsLeft).toBe(2);
    // A man kept by the SAME manager is untouched by the rule either way.
    const taylor = reset.find((c) => c.name === 'Jonathan Taylor');
    expect(taylor.yearsLeft).toBe(1);
  });

  it('never returns fewer than one year left, whatever the history says', () => {
    const cs = contracts(ledger.Ryan, prior, rosterOfHandle.Ryan, { maxYears: 1 });
    expect(cs.every((c) => c.yearsLeft >= 1)).toBe(true);
  });

  it('says two years for a man nobody kept last season', () => {
    const cs = contracts([{ playerId: 'nobody', name: 'A Nobody', pos: 'WR' }], prior, 1);
    expect(cs[0]).toMatchObject({ yearsLeft: 2, repeat: false, changedHands: false });
  });

  it('handles an empty or missing keeper list', () => {
    expect(contracts([], prior, 1)).toEqual([]);
    expect(contracts(null, prior, 1)).toEqual([]);
  });
});

describe('the sequence carries its own coordinates', () => {
  // This is the guard against the bug the ragged board caused: 120 divides by
  // 10, so a board that recovers round and column from the sequence index draws
  // a plausible 12x10 grid and files round 13's two live picks under other
  // managers. The metadata is the only thing standing between us and that
  // returning, so it gets tested rather than trusted.
  const meta = liveSequenceMeta(board);

  it('runs parallel to the live sequence, pick for pick', () => {
    const seq = liveSequence(board);
    expect(meta).toHaveLength(seq.length);
    meta.forEach((m, i) => expect(m.handle).toBe(seq[i]));
  });

  it('spans FIFTEEN board rounds even though there are only 120 live picks', () => {
    expect(meta).toHaveLength(120);
    expect(Math.max(...meta.map((m) => m.round))).toBe(13);
    // ...which is exactly why 120/10 = 12 was the wrong answer.
    expect(meta.filter((m) => m.round === 13)).toHaveLength(2);
    expect(meta.filter((m) => m.round === 12)).toHaveLength(8);
  });

  it('never names a cell a keeper is already sitting on', () => {
    const spent = new Set(keeperCells(board).map((c) => c.pickNo));
    for (const m of meta) expect(spent.has(m.pickNo), `pick ${m.pickNo} is live`).toBe(false);
  });

  it('gives every entry a real coordinate', () => {
    for (const m of meta) {
      expect(m.round).toBeGreaterThanOrEqual(1);
      expect(m.slot).toBeGreaterThanOrEqual(1);
      expect(m.slot).toBeLessThanOrEqual(10);
      expect(pickNoAt(m.round, m.slot, 10)).toBe(m.pickNo);
    }
  });
});

describe('the column count comes from the DRAFT, not the order', () => {
  // This league's own 2025 draft_order carries NINE entries for a ten-team
  // draft. A missing top slot shortens the array without leaving a hole, so
  // nothing downstream can tell — and a board nine columns wide puts every pick
  // after the first round under the wrong manager.
  const short = { slotHandles: sb.slotHandles.slice(0, 9), overrides: [], type: 'snake', teams: 10 };

  it('lays out ten columns even when the order names nine', () => {
    const b = keeperBoard(short, 3, {}, []);
    expect(b.teams).toBe(10);
    expect(b.cells).toHaveLength(30);
    expect(new Set(b.cells.map((c) => c.slot))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  });

  it('names the empty seat instead of emitting undefined', () => {
    const b = keeperBoard(short, 1, {}, []);
    const orphan = b.cells.find((c) => c.slot === 10);
    expect(orphan.handle).toBe('slot 10');
    expect(b.cells.every((c) => typeof c.handle === 'string' && c.handle)).toBe(true);
  });

  it('falls back to the order length when the draft does not say', () => {
    const noTeams = { slotHandles: sb.slotHandles.slice(0, 9), overrides: [], type: 'snake' };
    expect(keeperBoard(noTeams, 1, {}, []).teams).toBe(9);
  });

  it('and the real 2026 board still comes out at ten', () => {
    expect(board.teams).toBe(10);
    expect(sb.teams).toBe(10);
    expect(sb.incomplete).toBe(false);
  });
});

describe('a HALF-assigned board is not the whole answer', () => {
  // The commissioner can place keepers a team at a time. One is_keeper pick used
  // to be enough to take the authoritative path, which reported nine managers as
  // keeping nobody and announced "3 spent, 147 live" as fact.
  const partial = picks.filter((p) => p.roster_id === 1);   // Ryan's three only

  it('takes the placements Sleeper made AND derives the rest', () => {
    const b = keeperBoard(sb, ROUNDS, ledger, partial, rosterHandle);
    expect(b.source).toBe('mixed');
    expect(keeperCells(b)).toHaveLength(30);
    expect(liveCells(b)).toHaveLength(120);
  });

  it('and lands on the same thirty picks the full board uses', () => {
    const b = keeperBoard(sb, ROUNDS, ledger, partial, rosterHandle);
    expect(keeperCells(b).map((c) => c.pickNo).sort((a, b2) => a - b2))
      .toEqual(keeperCells(board).map((c) => c.pickNo).sort((a, b2) => a - b2));
  });

  it('never hands a manager the same man twice', () => {
    const b = keeperBoard(sb, ROUNDS, ledger, partial, rosterHandle);
    const ids = keeperCells(b).map((c) => c.keeper.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('still calls a COMPLETE board complete', () => {
    expect(keeperBoard(sb, ROUNDS, ledger, picks, rosterHandle).source).toBe('board');
  });

  it('trusts the board outright when we hold no ledger to check it against', () => {
    const b = keeperBoard(sb, ROUNDS, {}, partial, rosterHandle);
    expect(b.source).toBe('board');
    expect(keeperCells(b)).toHaveLength(3);
  });
});
