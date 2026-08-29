// PICK CAPITAL — reconciled against the captured traded-picks fixture.
//
// The point of this engine is that data.js's hand-counted CAPITAL had gone
// stale without anything noticing. So the tests assert what Sleeper says, and
// where the hand-written constant disagrees they assert the disagreement too —
// that is the finding, not a nuisance.
import { describe, it, expect } from 'vitest';
import traded from '../src/lib/api/fixtures/traded_picks-2026.json';
import users from '../src/lib/api/fixtures/users-2026.json';
import rosters from '../src/lib/api/fixtures/rosters-2026.json';
import drafts from '../src/lib/api/fixtures/drafts-2026.json';
import { userHandleMap, draftSlotBoard } from '../src/api/league';
import { capitalFor, chestValue, chestTagFor, firstRound, picksOf } from '../src/lib/engine/picks';
import { CAPITAL } from '../src/lib/data.js';

const uh = userHandleMap(users);
const rosterHandle = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
const draft = drafts.find((d) => d && d.draft_order);
const ROUNDS = draft.settings.rounds;
const cap26 = capitalFor('2026', ROUNDS, traded, rosterHandle);
const cap27 = capitalFor('2027', ROUNDS, traded, rosterHandle);

describe('2026 capital, straight off the traded picks', () => {
  it('accounts for every pick in the draft, once', () => {
    const total = Object.values(cap26).reduce((n, c) => n + c.total, 0);
    expect(total).toBe(ROUNDS * rosters.length);      // 150
    expect(Object.keys(cap26)).toHaveLength(10);
  });

  it('gives Ryan ONE first, NO second and THREE thirds', () => {
    const c = cap26.Ryan;
    expect(c.top3).toEqual([1, 0, 3]);
  });

  it('and data.js now says the same thing', () => {
    // This used to assert the opposite: the hand-written constant said two
    // firsts and the ledger said one, and the test existed to pin the drift
    // rather than hide it. The constant has since been corrected against these
    // same fixtures, so the assertion flips to agreement — which is the state
    // worth defending.
    expect(CAPITAL.Ryan).toEqual(cap26.Ryan.top3);
    expect(CAPITAL.Ryan[0]).toBe(1);
  });

  it('names where each bought pick came from', () => {
    const thirds = cap26.Ryan.picks.filter((p) => p.round === 3);
    expect(thirds).toHaveLength(3);
    expect(thirds.filter((p) => p.via).map((p) => p.via).sort()).toEqual(['JShrimp341', 'JohnnyDuff']);
    expect(thirds.filter((p) => !p.via)).toHaveLength(1);   // his own
  });

  it('ATorelli4 is the richest early board and JohnnyDuff the barest', () => {
    expect(cap26.ATorelli4.top3).toEqual([2, 3, 1]);
    expect(cap26.JohnnyDuff.top3).toEqual([0, 0, 0]);
    expect(chestTagFor(chestValue(cap26.ATorelli4))).toBe('LOADED');
    expect(chestTagFor(chestValue(cap26.JohnnyDuff))).toBe('STRIPPED');
  });

  it('agrees with the hand-written CAPITAL for all ten', () => {
    // Four of the ten used to disagree — Ryan, joshleota, jpdonners and
    // ImyHunter, every one of them moved by an August trade the constant was
    // written before. The offline fallback is the one people see when the
    // network is down, so it is worth keeping honest.
    const wrong = Object.keys(cap26).filter((h) => {
      const hand = CAPITAL[h];
      return hand && String(hand) !== String(cap26[h].top3);
    }).sort();
    expect(wrong).toEqual([]);
  });
});

describe('2027 futures — the column nothing in the app has ever shown', () => {
  it('counts a full future draft too', () => {
    expect(Object.values(cap27).reduce((n, c) => n + c.total, 0)).toBe(ROUNDS * rosters.length);
  });

  it('joshleota is sitting on FOUR 2027 firsts, three of them bought', () => {
    const c = cap27.joshleota;
    expect(c.top3[0]).toBe(4);
    const firsts = c.picks.filter((p) => p.round === 1);
    expect(firsts.filter((p) => p.via)).toHaveLength(3);
    expect(firsts.filter((p) => !p.via)).toHaveLength(1);
  });

  it('and the hand-written CAPITAL, which is 2026-only, says nothing about it', () => {
    // The constant covers this year alone, so it has one first for him and
    // cannot express the four he holds for next. That is a reason to read the
    // live capital store, not a reason to distrust either number.
    expect(CAPITAL.joshleota).toEqual(cap26.joshleota.top3);
    expect(CAPITAL.joshleota).toHaveLength(3);
  });

  it('nobody is left holding nothing at all', () => {
    for (const [h, c] of Object.entries(cap27)) expect(c.total, `${h} holds picks`).toBeGreaterThan(0);
  });
});

describe('round one, derived', () => {
  const sb = draftSlotBoard(draft, traded, users, rosters);
  const r1 = firstRound(cap26, sb.slotHandles, rosterHandle, traded, '2026');

  it('is ten slots in draft order', () => {
    expect(r1).toHaveLength(10);
    expect(r1.map((x) => x.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('puts Ryan at slot 4 on his own pick, and joshleota on JShrimp341\'s at slot 2', () => {
    expect(r1[3]).toEqual({ slot: 4, handle: 'Ryan', via: null });
    expect(r1[1]).toEqual({ slot: 2, handle: 'joshleota', via: 'JShrimp341' });
  });

  it('marks every traded slot with who it came from and leaves the rest clean', () => {
    for (const x of r1) {
      if (x.via) expect(x.via).not.toBe(x.handle);
    }
    expect(r1.filter((x) => x.via).length).toBeGreaterThan(0);
  });
});

describe('degrading rather than throwing', () => {
  it('survives no trades at all — everyone keeps what they were born with', () => {
    const clean = capitalFor('2026', ROUNDS, [], rosterHandle);
    for (const c of Object.values(clean)) {
      expect(c.total).toBe(ROUNDS);
      expect(c.top3).toEqual([1, 1, 1]);
      expect(c.picks.every((p) => p.via === null)).toBe(true);
    }
  });

  it('survives junk in place of the trade list', () => {
    expect(() => capitalFor('2026', ROUNDS, null, rosterHandle)).not.toThrow();
    expect(() => capitalFor('2026', ROUNDS, undefined, rosterHandle)).not.toThrow();
    expect(Object.keys(capitalFor('2026', ROUNDS, [], {}))).toHaveLength(0);
  });

  it('ignores a trade for a season it was not asked about', () => {
    const only27 = traded.filter((t) => t.season === '2027');
    const c = capitalFor('2026', ROUNDS, only27, rosterHandle);
    for (const x of Object.values(c)) expect(x.picks.every((p) => p.via === null)).toBe(true);
  });

  it('gathers one manager\'s picks across seasons', () => {
    const all = picksOf({ 2026: cap26, 2027: cap27 }, 'Ryan');
    expect(all.length).toBe(cap26.Ryan.total + cap27.Ryan.total);
    expect(new Set(all.map((p) => p.season))).toEqual(new Set(['2026', '2027']));
  });

  it('scores an empty chest at zero rather than blowing up', () => {
    expect(chestValue(null)).toBe(0);
    expect(chestValue(undefined)).toBe(0);
    expect(chestTagFor(0)).toBe('STRIPPED');
  });
});
