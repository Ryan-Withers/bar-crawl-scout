import { describe, it, expect } from 'vitest';
import {
  createMock, makePick, simToUser, simToEnd, gradeMock, blendValue,
  needFactor, unfilledStarters, buildSequence, sequenceFromSlots, currentHandle, shuffle, shortName, recapText,
  pickCode, slugify, queueTop, autoPickName, toggleQueued, moveQueued, pruneQueue,
  pushSnapshot, undoLast, rewindToHandle, tierBreaks, tiersOf, clockPhase, fmtClock,
  personaPhrase, picksUntil, nextPickOverall, fillSlots,
  focusWindow, focusOf, flexPositions, needPositions, FOCUS_ORDER,
  isRookie, filterPool,
} from '../src/lib/engine/mockdraft';

const P = (name, pos, winnow, balanced, future, bye = 5) =>
  ({ name, pos, team: 'X', bye, v: { winnow, balanced, future } });

const SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX'];

// A pool with clear value tiers per position.
const pool = [
  P('QB1', 'QB', 90, 85, 80), P('QB2', 'QB', 70, 66, 60), P('QB3', 'QB', 50, 48, 44),
  P('RB1', 'RB', 100, 95, 70), P('RB2', 'RB', 88, 84, 66), P('RB3', 'RB', 72, 70, 55), P('RB4', 'RB', 60, 58, 40), P('RB5', 'RB', 40, 39, 30),
  P('WR1', 'WR', 60, 92, 99), P('WR2', 'WR', 55, 82, 96), P('WR3', 'WR', 66, 68, 70), P('WR4', 'WR', 52, 55, 58), P('WR5', 'WR', 30, 34, 40),
  P('TE1', 'TE', 75, 72, 60), P('TE2', 'TE', 45, 44, 40), P('TE3', 'TE', 30, 30, 28),
  P('K1', 'K', 22, 22, 22), P('K2', 'K', 20, 20, 20),
  P('D1', 'DEF', 24, 24, 24), P('D2', 'DEF', 21, 21, 21),
];

const team = (handle, persona = { window: 50, chaos: 0 }, keepers = [], isUser = false) =>
  ({ handle, team: handle + ' FC', persona, keepers, isUser });

const cfg2 = (over = {}) => ({
  teams: [team('A'), team('B')],
  order: ['A', 'B'],
  slots: SLOTS,
  rosterSize: 8,
  seed: 42,
  pool,
  ...over,
});

describe('mock draft — pool & sequence', () => {
  it('keepers NEVER enter the pool', () => {
    const s = createMock(cfg2({ teams: [team('A', undefined, [pool[3]]), team('B')] })); // RB1 kept
    expect(s.pool.some((p) => p.name === 'RB1')).toBe(false);
    const done = simToEnd(s);
    expect(done.log.some((p) => p.player.name === 'RB1')).toBe(false);
    // ...but the keeper counts toward roster size: A drafts one fewer.
    expect(done.log.filter((p) => p.handle === 'A').length).toBe(7);
    expect(done.log.filter((p) => p.handle === 'B').length).toBe(8);
  });

  it('snakes the order every round', () => {
    const seq = buildSequence(cfg2({ rosterSize: 3 }));
    expect(seq).toEqual(['A', 'B', 'B', 'A', 'A', 'B']);
  });

  it('finishes with full, disjoint rosters and an empty overlap', () => {
    const done = simToEnd(createMock(cfg2()));
    expect(done.done).toBe(true);
    expect(done.rosters.A.length).toBe(8);
    expect(done.rosters.B.length).toBe(8);
    const names = done.log.map((p) => p.player.name);
    expect(new Set(names).size).toBe(names.length); // nobody drafted twice
  });
});

describe('mock draft — personalities', () => {
  it('window blends values: 0 = win-now, 50 = balanced, 100 = future', () => {
    const p = P('X', 'WR', 60, 80, 100);
    expect(blendValue(p, 0)).toBe(60);
    expect(blendValue(p, 50)).toBe(80);
    expect(blendValue(p, 100)).toBe(100);
    expect(blendValue(p, 25)).toBe(70);
  });

  it('a win-now bot and a future bot open with different picks', () => {
    // RB1 is the win-now king (100/95/70); WR1 is the future king (60/92/99).
    const winNow = simToEnd(createMock(cfg2({ teams: [team('A', { window: 0, chaos: 0 }), team('B')] })));
    const future = simToEnd(createMock(cfg2({ teams: [team('A', { window: 100, chaos: 0 }), team('B')] })));
    expect(winNow.log[0].player.name).toBe('RB1');
    expect(future.log[0].player.name).toBe('WR1');
  });

  it('chaos 0 is deterministic regardless of seed; chaos can deviate', () => {
    const a = simToEnd(createMock(cfg2({ seed: 1 })));
    const b = simToEnd(createMock(cfg2({ seed: 999 })));
    expect(a.log.map((p) => p.player.name)).toEqual(b.log.map((p) => p.player.name));
    // High chaos with different seeds should not always produce the same draft.
    const chaosTeams = () => [team('A', { window: 50, chaos: 100 }), team('B', { window: 50, chaos: 100 })];
    const c = simToEnd(createMock(cfg2({ teams: chaosTeams(), seed: 7 })));
    const d = simToEnd(createMock(cfg2({ teams: chaosTeams(), seed: 1234 })));
    expect(c.log.map((p) => p.player.name)).not.toEqual(d.log.map((p) => p.player.name));
  });

  it('same seed => identical draft (reproducible chaos)', () => {
    const mk = () => simToEnd(createMock(cfg2({ teams: [team('A', { window: 30, chaos: 70 }), team('B', { window: 80, chaos: 40 })], seed: 55 })));
    expect(mk().log.map((p) => p.player.name)).toEqual(mk().log.map((p) => p.player.name));
  });
});

describe('mock draft — roster sense', () => {
  it('suppresses K/DEF while core starters are unfilled', () => {
    expect(needFactor([], SLOTS, 'K')).toBeLessThan(0.1);
    expect(needFactor([], SLOTS, 'RB')).toBeGreaterThan(1);
  });

  it('discourages overstacking a position', () => {
    const fourRBs = [P('a', 'RB', 1, 1, 1), P('b', 'RB', 1, 1, 1), P('c', 'RB', 1, 1, 1), P('d', 'RB', 1, 1, 1), P('e', 'RB', 1, 1, 1)];
    expect(needFactor(fourRBs, SLOTS, 'RB')).toBeLessThan(0.1);
  });

  it('tracks unfilled dedicated starters', () => {
    expect(unfilledStarters([], SLOTS).sort()).toEqual(['QB', 'RB', 'RB', 'TE', 'WR', 'WR'].sort());
    expect(unfilledStarters([P('q', 'QB', 1, 1, 1)], SLOTS)).not.toContain('QB');
  });

  it('every finished team fields a legal starting lineup (even at chaos 100)', () => {
    const done = simToEnd(createMock(cfg2({
      teams: [team('A', { window: 50, chaos: 100 }), team('B', { window: 50, chaos: 100 })],
      seed: 31,
    })));
    for (const h of ['A', 'B']) {
      expect(unfilledStarters(done.rosters[h], SLOTS)).toEqual([]);
    }
  });
});

describe('mock draft — the user seat', () => {
  it('simToUser stops exactly on the user pick; manual pick works', () => {
    const s = createMock(cfg2({ teams: [team('A'), team('B', undefined, [], true)] }));
    const atUser = simToUser(s);
    expect(currentHandle(atUser)).toBe('B');
    expect(atUser.log.length).toBe(1); // A picked, B on the clock
    const after = makePick(atUser, 'TE1'); // the user goes rogue early-TE
    expect(after.log[1].player.name).toBe('TE1');
    expect(after.rosters.B.map((p) => p.name)).toContain('TE1');
  });

  it('ignores a manual pick of a drafted or kept player', () => {
    const s = createMock(cfg2({ teams: [team('A', undefined, [pool[0]]), team('B', undefined, [], true)] })); // QB1 kept by A
    const atUser = simToUser(s);
    const same = makePick(atUser, 'QB1');
    expect(same.log.length).toBe(atUser.log.length); // no-op
  });
});

describe('mock draft — the debrief', () => {
  it('grades rank by drafted value and mark the lean', () => {
    const done = simToEnd(createMock(cfg2({ teams: [team('A', { window: 0, chaos: 0 }), team('B', { window: 100, chaos: 0 })] })));
    const { rows } = gradeMock(done);
    expect(rows).toHaveLength(2);
    expect(rows[0].total).toBeGreaterThanOrEqual(rows[1].total);
    expect(rows[0].grade).toBe('A+');
    const a = rows.find((r) => r.handle === 'A');
    const b = rows.find((r) => r.handle === 'B');
    expect(a.winnow).toBeGreaterThan(a.future - 40); // win-now team skews winnow
    expect(b.future).toBeGreaterThan(b.winnow - 40);
  });

  it('flags steals (fell past board rank) and reaches', () => {
    // Force a reach: user drafts K1 (board rank ~17) at pick 2 overall.
    const s = createMock(cfg2({ teams: [team('A'), team('B', undefined, [], true)] }));
    const done = simToEnd(makePick(simToUser(s), 'K1'));
    const { reaches } = gradeMock(done);
    expect(reaches.some((r) => r.player.name === 'K1')).toBe(true);
  });
});

describe('mock draft — the real board (explicit sequence)', () => {
  it('snakes base slots and honors traded-pick overrides at (round, slot)', () => {
    // 3 slots, 2 rounds; B traded their 1.02 to A.
    const seq = sequenceFromSlots(['A', 'B', 'C'], [{ round: 1, slot: 2, handle: 'A' }], 2, 'snake');
    expect(seq).toEqual(['A', 'A', 'C', 'C', 'B', 'A']);
    // Linear boards repeat the slot order every round.
    expect(sequenceFromSlots(['A', 'B'], [], 2, 'linear')).toEqual(['A', 'B', 'A', 'B']);
  });

  it('an explicit sequence overrides the generated snake', () => {
    const sequence = ['A', 'A', 'B', 'B', 'A', 'B']; // A owns picks 1 AND 2 (a trade)
    const s = createMock(cfg2({ rosterSize: 3, sequence }));
    expect(s.seq).toEqual(sequence);
    const done = simToEnd(s);
    // Round 1 belongs to A twice — the exact "Ryan has picks 2 & 4" shape.
    expect(done.log[0].handle).toBe('A');
    expect(done.log[1].handle).toBe('A');
    expect(done.log[0].round).toBe(1);
    expect(done.log[1].round).toBe(1);
    expect(done.rosters.A.length).toBe(3);
    expect(done.rosters.B.length).toBe(3);
  });

  it('uneven pick counts from trades still end in legal lineups', () => {
    // A traded away picks: B drafts 9 of 14, A drafts 5 of 14 in a 7-round 2-team grid.
    const rounds = 7;
    const seq = sequenceFromSlots(['A', 'B'], [
      { round: 2, slot: 1, handle: 'B' }, { round: 5, slot: 1, handle: 'B' },
    ], rounds, 'snake');
    expect(seq.filter((h) => h === 'B').length).toBe(9);
    const done = simToEnd(createMock(cfg2({ rosterSize: 14, sequence: seq, seed: 3 })));
    expect(done.done).toBe(true);
    // The endgame guard counts remaining picks from the SEQUENCE, so even the
    // short-handed team fills every dedicated starting slot it can.
    expect(unfilledStarters(done.rosters.B, SLOTS)).toEqual([]);
    expect(done.rosters.A.length).toBe(5);
    expect(done.rosters.B.length).toBe(9);
  });
});

describe('mock draft — the group-chat recap', () => {
  it('builds paste-ready banter: podium, your haul, steal & reach, link', () => {
    // Force a reach so both flag lines render (K1 at pick 2 is board-rank ~17).
    const s = createMock(cfg2({ teams: [team('A'), team('B', undefined, [], true)] }));
    const done = simToEnd(makePick(simToUser(s), 'K1'));
    const g = gradeMock(done);
    const text = recapText(done, g, {
      nameOf: (h) => `Team ${h}`, seat: 'B', when: '22/10/2025', url: 'https://x.test/mock',
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('🏈 THE WAR ROOM — mock draft · 22/10/2025');
    expect(lines[1]).toContain('🥇 Team ' + g.rows[0].handle);
    expect(lines[1]).toContain(`(${g.rows[0].total})`);
    expect(text).toContain('MY HAUL (Team B');
    expect(text).toContain('🚨 Reach of the draft: K1 by Team B @ pick 2');
    expect(text).toContain('Run yours: https://x.test/mock');
    // Haul lists at most 5 names with an ellipsis when there are more.
    const haul = lines.find((l) => l.startsWith('MY HAUL'));
    expect(haul.split(',').length).toBeLessThanOrEqual(5);
    expect(haul.endsWith('…')).toBe(true);
  });

  it('spectate recap (no seat) skips the haul line; empty flags skip theirs', () => {
    const done = simToEnd(createMock(cfg2()));
    const g = gradeMock(done);
    const noFlags = { rows: g.rows, steals: [], reaches: [] };
    const text = recapText(done, noFlags, {});
    expect(text).not.toContain('MY HAUL');
    expect(text).not.toContain('💎');
    expect(text).not.toContain('🚨');
    expect(text).not.toContain('Run yours');
    expect(text.split('\n')).toHaveLength(2); // header + podium only
  });
});

describe('mock draft — board cell names', () => {
  it('keeps generational suffixes attached to the surname', () => {
    expect(shortName('Patrick Mahomes II')).toBe('Mahomes II');
    expect(shortName('Aaron Jones Sr.')).toBe('Jones Sr.');
    expect(shortName('Michael Penix Jr.')).toBe('Penix Jr.');
    expect(shortName('Ja\'Marr Chase')).toBe('Chase');
    expect(shortName('Bo Nix')).toBe('Nix');
    expect(shortName('II')).toBe('II'); // degenerate one-word name stays itself
    expect(shortName('')).toBe('');
  });
});

describe('mock draft — shuffle', () => {
  it('is a seeded permutation: same seed same order, contents preserved', () => {
    const arr = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffle(arr, 9)).toEqual(shuffle(arr, 9));
    expect(shuffle(arr, 9).slice().sort()).toEqual(arr.slice().sort());
    expect(shuffle(arr, 9)).not.toEqual(shuffle(arr, 10));
  });
});

// ===========================================================================
// THE DRAFT ROOM — the live-room helpers.
// ===========================================================================

describe('draft room — pick codes & slugs', () => {
  it('reads pick numbers the way a draft board does', () => {
    expect(pickCode(1, 10)).toBe('1.01');
    expect(pickCode(4, 10)).toBe('1.04');
    expect(pickCode(10, 10)).toBe('1.10');
    expect(pickCode(11, 10)).toBe('2.01');
    expect(pickCode(24, 12)).toBe('2.12');
    expect(pickCode(0, 10)).toBe('');       // no such pick
    expect(pickCode(7, 0)).toBe('7');       // unknown room size: bare overall
  });

  it('slugs names into stable ids', () => {
    expect(slugify("Ja'Marr Chase")).toBe('ja-marr-chase');
    expect(slugify('Patrick Mahomes II')).toBe('patrick-mahomes-ii');
    expect(slugify('Amon-Ra St. Brown')).toBe('amon-ra-st-brown');
    expect(slugify('')).toBe('');
  });
});

describe('draft room — MY QUEUE', () => {
  const pool3 = [P('A1', 'RB', 9, 9, 9), P('B2', 'WR', 8, 8, 8), P('C3', 'TE', 7, 7, 7)];

  it('takes the top queued player who is still available', () => {
    expect(queueTop(pool3, ['B2', 'A1'])).toBe('B2');
    expect(queueTop(pool3, ['GONE', 'C3'])).toBe('C3'); // skips the sniped one
    expect(queueTop(pool3, [])).toBe(null);
    expect(queueTop(pool3, ['NOBODY'])).toBe(null);
  });

  it('autopick prefers the queue, then falls back to best available', () => {
    const s = createMock(cfg2({ teams: [team('A'), team('B', undefined, [], true)] }));
    const atUser = simToUser(s);
    // TE1 is nowhere near the top of the board — the queue overrides that.
    expect(autoPickName(atUser, ['TE1'])).toBe('TE1');
    // Queue full of players already off the board => the room's own choice.
    const noQueue = autoPickName(atUser, []);
    expect(autoPickName(atUser, [atUser.log[0].player.name])).toBe(noQueue);
    expect(noQueue).toBe('WR1'); // balanced GM, RB1 already gone at 1.01
    // A finished draft has nothing to take.
    expect(autoPickName(simToEnd(atUser), ['TE1'])).toBe(null);
  });

  it('queues star, unstar, reorder and prune without mutating', () => {
    const q = ['A1', 'B2'];
    expect(toggleQueued(q, 'C3')).toEqual(['A1', 'B2', 'C3']);
    expect(toggleQueued(q, 'A1')).toEqual(['B2']);
    expect(q).toEqual(['A1', 'B2']); // untouched

    expect(moveQueued(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveQueued(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveQueued(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']); // off the top: no-op
    expect(moveQueued(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);  // off the bottom: no-op

    expect(pruneQueue(['A1', 'GONE', 'C3'], pool3)).toEqual(['A1', 'C3']);
  });
});

describe('draft room — UNDO', () => {
  it('snapshots rewind one pick at a time and stay bounded', () => {
    const s0 = createMock(cfg2({ teams: [team('A'), team('B', undefined, [], true)] }));
    const s1 = makePick(s0);
    let stack = pushSnapshot([], s0);
    stack = pushSnapshot(stack, s1);
    expect(stack).toHaveLength(2);

    const one = undoLast(stack);
    expect(one.state).toBe(s1);
    expect(one.stack).toHaveLength(1);
    expect(undoLast(one.stack).state).toBe(s0);
    expect(undoLast([]).state).toBe(null);

    // The stack never grows without bound.
    let big = [];
    for (let i = 0; i < 12; i++) big = pushSnapshot(big, s0, 5);
    expect(big).toHaveLength(5);
  });

  it('rewinds all the way back to your own turn', () => {
    // Snake with 2 teams: A B | B A. The stack holds the state BEFORE each pick,
    // exactly as the room records it, so the live state is never in the stack.
    const s0 = createMock(cfg2({ teams: [team('A'), team('B', undefined, [], true)] }));
    const s1 = makePick(s0);                 // A opened -> B (you) on the clock
    const s2 = makePick(s1, 'TE1');          // you picked -> you're up again
    const s3 = makePick(s2, 'TE2');          // you picked again -> A on the clock
    const stack = [s0, s1, s2];              // three picks made, three snapshots
    expect(currentHandle(s3)).toBe('A');

    const back = rewindToHandle(stack, 'B'); // "give me that pick back"
    expect(currentHandle(back.state)).toBe('B');
    expect(back.state).toBe(s2);
    expect(back.state.log).toHaveLength(2);  // A's opener + your first pick
    expect(back.stack).toEqual([s0, s1]);
    // Rewinding again walks back to your FIRST turn.
    expect(rewindToHandle(back.stack, 'B').state).toBe(s1);
    // A handle that was never on the clock in this stack leaves it alone.
    expect(rewindToHandle(stack, 'ZZ')).toEqual({ stack, state: null });
  });
});

describe('draft room — tier breaks', () => {
  it('breaks where the board falls off a cliff, not on every step', () => {
    //           0    1   2   3   4   5   -> one 26-point cliff before index 3
    const vals = [100, 98, 96, 70, 68, 66];
    expect(tierBreaks(vals)).toEqual([3]);
    expect(tiersOf(vals)).toEqual([1, 1, 1, 2, 2, 2]);
    // Two cliffs, three tiers.
    expect(tiersOf([90, 89, 60, 59, 30, 29])).toEqual([1, 1, 2, 2, 3, 3]);
    // A smooth board has no tiers at all.
    expect(tierBreaks([50, 45, 40, 35, 30])).toEqual([]);
    expect(tierBreaks([7])).toEqual([]);
    expect(tierBreaks([])).toEqual([]);
    // Tiny absolute gaps never count, however lopsided they are.
    expect(tierBreaks([10, 10, 10, 9])).toEqual([]);
  });
});

describe('draft room — the pick clock', () => {
  it('escalates calm -> amber -> red -> expired, and stays off when unset', () => {
    expect(clockPhase(60, 60)).toBe('calm');
    expect(clockPhase(16, 60)).toBe('calm');
    expect(clockPhase(15, 60)).toBe('warn');
    expect(clockPhase(6, 60)).toBe('warn');
    expect(clockPhase(5, 60)).toBe('urgent');
    expect(clockPhase(1, 60)).toBe('urgent');
    expect(clockPhase(0, 60)).toBe('expired');
    expect(clockPhase(-3, 60)).toBe('expired');
    expect(clockPhase(30, 0)).toBe('off');   // clock switched off in the lobby
  });

  it('formats m:ss and never shows a negative', () => {
    expect(fmtClock(90)).toBe('1:30');
    expect(fmtClock(60)).toBe('1:00');
    expect(fmtClock(9)).toBe('0:09');
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(-5)).toBe('0:00');
  });
});

describe('draft room — GM personality in plain English', () => {
  it('turns two dials into a phrase a human reads', () => {
    expect(personaPhrase({ window: 50, chaos: 50 })).toBe('Balanced · keeps you guessing');
    expect(personaPhrase({ window: 0, chaos: 0 })).toBe('Win-now · by the book');
    expect(personaPhrase({ window: 100, chaos: 100 })).toBe('Future-first · total chaos');
    expect(personaPhrase({ window: 30, chaos: 20 })).toBe('Lean win-now · mostly disciplined');
    expect(personaPhrase({ window: 75, chaos: 80 })).toBe('Lean future · unpredictable');
    expect(personaPhrase({})).toBe('Balanced · keeps you guessing'); // defaults
  });
});

describe('draft room — "you\'re up in N picks"', () => {
  it('counts the picks between now and your next turn', () => {
    const s = createMock(cfg2({ rosterSize: 3 })); // seq A B B A A B
    expect(picksUntil(s, 'A')).toBe(0);            // on the clock
    expect(nextPickOverall(s, 'A')).toBe(1);
    expect(picksUntil(s, 'B')).toBe(1);
    expect(nextPickOverall(s, 'B')).toBe(2);
    const s2 = makePick(makePick(makePick(s)));    // A, B, B gone
    expect(picksUntil(s2, 'B')).toBe(2);           // B waits out A's back-to-back
    expect(nextPickOverall(s2, 'B')).toBe(6);
    expect(picksUntil(simToEnd(s), 'A')).toBe(-1); // draft's over
    expect(nextPickOverall(simToEnd(s), 'A')).toBe(0);
  });
});

describe('draft room — the starting lineup', () => {
  it('fills dedicated slots first, then flex from the leftovers', () => {
    const roster = [
      P('RBa', 'RB', 95, 95, 95), P('RBb', 'RB', 84, 84, 84), P('RBc', 'RB', 70, 70, 70),
      P('WRa', 'WR', 92, 92, 92), P('QBa', 'QB', 85, 85, 85), P('TEa', 'TE', 72, 72, 72),
    ];
    const { starters, bench } = fillSlots(roster, SLOTS); // QB RB RB WR WR TE FLEX
    expect(starters.map((s) => s.slot)).toEqual(SLOTS);
    expect(starters.map((s) => s.player && s.player.name))
      .toEqual(['QBa', 'RBa', 'RBb', 'WRa', null, 'TEa', 'RBc']);
    expect(bench).toEqual([]);
  });

  it('benches the overflow and leaves holes honest', () => {
    const roster = [P('W1', 'WR', 90, 90, 90), P('W2', 'WR', 80, 80, 80), P('W3', 'WR', 70, 70, 70), P('W4', 'WR', 60, 60, 60)];
    const { starters, bench } = fillSlots(roster, SLOTS);
    expect(starters.filter((s) => s.player).map((s) => s.player.name)).toEqual(['W1', 'W2', 'W3']); // WR WR FLEX
    expect(starters.find((s) => s.slot === 'QB').player).toBe(null);
    expect(bench.map((p) => p.name)).toEqual(['W4']);
    expect(fillSlots([], SLOTS).starters.every((s) => s.player === null)).toBe(true);
  });
});

describe('focus <-> the window dial', () => {
  it('maps the three choices onto the dial the personas already use', () => {
    expect(FOCUS_ORDER).toEqual(['winnow', 'balanced', 'future']);
    expect(FOCUS_ORDER.map(focusWindow)).toEqual([0, 50, 100]);
  });

  it('round-trips, so a button press and a slider drag agree', () => {
    for (const f of FOCUS_ORDER) expect(focusOf(focusWindow(f))).toBe(f);
  });

  it('reads a dragged slider as the nearest of the three', () => {
    expect(focusOf(0)).toBe('winnow');
    expect(focusOf(33)).toBe('winnow');
    expect(focusOf(34)).toBe('balanced');
    expect(focusOf(66)).toBe('balanced');
    expect(focusOf(67)).toBe('future');
    expect(focusOf(100)).toBe('future');
  });

  it('treats a missing or out-of-range dial as balanced/clamped', () => {
    expect(focusOf(undefined)).toBe('balanced');
    expect(focusOf(-40)).toBe('winnow');
    expect(focusOf(900)).toBe('future');
    expect(focusWindow('nonsense')).toBe(50);
  });

  it('actually reorders the board: win-now and future disagree on WR1 vs RB1', () => {
    const rb1 = pool.find((p) => p.name === 'RB1');
    const wr1 = pool.find((p) => p.name === 'WR1');
    expect(blendValue(rb1, focusWindow('winnow'))).toBeGreaterThan(blendValue(wr1, focusWindow('winnow')));
    expect(blendValue(wr1, focusWindow('future'))).toBeGreaterThan(blendValue(rb1, focusWindow('future')));
  });
});

describe('flexPositions', () => {
  it('reads FLEX as RB/WR/TE, in core order', () => {
    expect(flexPositions(SLOTS)).toEqual(['RB', 'WR', 'TE']);
  });

  it('reads a superflex as including the QB', () => {
    expect(flexPositions(['QB', 'RB', 'WR', 'SUPER_FLEX'])).toEqual(['QB', 'RB', 'WR', 'TE']);
  });

  it('reads the narrower flexes Sleeper offers', () => {
    expect(flexPositions(['WRRB_FLEX'])).toEqual(['RB', 'WR']);
    expect(flexPositions(['REC_FLEX'])).toEqual(['WR', 'TE']);
  });

  it('is empty for a league with no flex seat at all', () => {
    expect(flexPositions(['QB', 'RB', 'RB', 'WR', 'WR', 'TE'])).toEqual([]);
    expect(flexPositions([])).toEqual([]);
  });

  it('never double-counts a position two flexes both accept', () => {
    expect(flexPositions(['FLEX', 'FLEX', 'REC_FLEX'])).toEqual(['RB', 'WR', 'TE']);
  });
});

describe('needPositions', () => {
  it('an empty roster needs every starting position', () => {
    // QB RB RB WR WR TE FLEX -> the flex opens RB/WR/TE, already all needed.
    expect(needPositions([], SLOTS)).toEqual(['QB', 'RB', 'WR', 'TE']);
  });

  it('drops a position once its dedicated seats are full', () => {
    const roster = [P('QBa', 'QB', 80, 80, 80), P('TEa', 'TE', 70, 70, 70)];
    const need = needPositions(roster, SLOTS);
    expect(need).not.toContain('QB');
    // TE is still listed: the FLEX seat is empty and a TE can fill it.
    expect(need).toEqual(['RB', 'WR', 'TE']);
  });

  it('opens the flex to everything eligible once the dedicated seats are done', () => {
    const roster = [
      P('QBa', 'QB', 80, 80, 80), P('RBa', 'RB', 80, 80, 80), P('RBb', 'RB', 79, 79, 79),
      P('WRa', 'WR', 80, 80, 80), P('WRb', 'WR', 79, 79, 79), P('TEa', 'TE', 70, 70, 70),
    ];
    expect(needPositions(roster, SLOTS)).toEqual(['RB', 'WR', 'TE']); // only the FLEX left
  });

  it('is empty when every starting seat is filled', () => {
    const roster = [
      P('QBa', 'QB', 80, 80, 80), P('RBa', 'RB', 80, 80, 80), P('RBb', 'RB', 79, 79, 79),
      P('WRa', 'WR', 80, 80, 80), P('WRb', 'WR', 79, 79, 79), P('TEa', 'TE', 70, 70, 70),
      P('RBc', 'RB', 60, 60, 60),
    ];
    expect(needPositions(roster, SLOTS)).toEqual([]);
  });

  it('agrees with fillSlots about what is still open', () => {
    const roster = [P('WRa', 'WR', 90, 90, 90), P('WRb', 'WR', 80, 80, 80)];
    const holes = fillSlots(roster, SLOTS).starters.filter((s) => !s.player).map((s) => s.slot);
    expect(holes).toEqual(['QB', 'RB', 'RB', 'TE', 'FLEX']);
    expect(needPositions(roster, SLOTS)).toEqual(['QB', 'RB', 'WR', 'TE']); // FLEX re-opens WR
  });
});

describe('isRookie', () => {
  it('reads the board stage the valuation model already prices off', () => {
    expect(isRookie({ name: 'A', pos: 'RB', team: 'X', bye: 5, stage: 'rookie', v: {} })).toBe(true);
    expect(isRookie({ name: 'B', pos: 'RB', team: 'X', bye: 5, stage: 'yr2', v: {} })).toBe(false);
    expect(isRookie({ name: 'C', pos: 'RB', team: 'X', bye: 5, stage: '', v: {} })).toBe(false);
  });

  it('is false, not a throw, for a player with no stage at all', () => {
    expect(isRookie({ name: 'D', pos: 'RB', team: 'X', bye: 5, v: {} })).toBe(false);
    expect(isRookie(undefined)).toBe(false);
  });
});

describe('filterPool', () => {
  const S = (name, pos, stage, team = 'BUF') =>
    ({ name, pos, team, bye: 5, stage, v: { winnow: 50, balanced: 50, future: 50 } });
  const POOL = [
    S('Rook Back', 'RB', 'rookie'), S('Vet Back', 'RB', 'prime'),
    S('Rook Wide', 'WR', 'rookie'), S('Vet Wide', 'WR', 'aging'),
    S('Rook Passer', 'QB', 'rookie'), S('Vet Passer', 'QB', 'prime'),
    S('Rook End', 'TE', 'rookie', 'MIA'),
  ];
  const names = (f) => filterPool(POOL, f).map((p) => p.name);

  it('returns everyone when asked for nothing', () => {
    expect(filterPool(POOL)).toHaveLength(POOL.length);
    expect(filterPool(POOL, { pos: 'ALL' })).toHaveLength(POOL.length);
  });

  it('filters to one position', () => {
    expect(names({ pos: 'RB' })).toEqual(['Rook Back', 'Vet Back']);
  });

  it('FLX takes the league\'s flex-eligible positions, and only those', () => {
    expect(names({ pos: 'FLX', flex: ['RB', 'WR', 'TE'] }))
      .toEqual(['Rook Back', 'Vet Back', 'Rook Wide', 'Vet Wide', 'Rook End']);
    // A superflex league lets the QB in.
    expect(names({ pos: 'FLX', flex: ['QB', 'RB', 'WR', 'TE'] })).toHaveLength(7);
    // No flex seat configured -> FLX matches nobody rather than everybody.
    expect(names({ pos: 'FLX', flex: [] })).toEqual([]);
  });

  it('filters to rookies', () => {
    expect(names({ rookiesOnly: true })).toEqual(['Rook Back', 'Rook Wide', 'Rook Passer', 'Rook End']);
  });

  it('composes rookies WITH a position — the whole point of separate controls', () => {
    expect(names({ pos: 'RB', rookiesOnly: true })).toEqual(['Rook Back']);
    expect(names({ pos: 'FLX', flex: ['RB', 'WR', 'TE'], rookiesOnly: true }))
      .toEqual(['Rook Back', 'Rook Wide', 'Rook End']);
  });

  it('composes rookies with needs', () => {
    expect(names({ rookiesOnly: true, onlyNeeds: true, needs: ['QB', 'TE'] }))
      .toEqual(['Rook Passer', 'Rook End']);
  });

  it('needs alone keeps every stage at those positions', () => {
    expect(names({ onlyNeeds: true, needs: ['QB'] })).toEqual(['Rook Passer', 'Vet Passer']);
  });

  it('needs with an empty list matches nobody (a filled roster shows nothing)', () => {
    expect(names({ onlyNeeds: true, needs: [] })).toEqual([]);
  });

  it('searches names loosely and teams exactly', () => {
    expect(names({ q: 'rook' })).toEqual(['Rook Back', 'Rook Wide', 'Rook Passer', 'Rook End']);
    expect(names({ q: 'MIA' })).toEqual(['Rook End']);
    expect(names({ q: '  vet back  ' })).toEqual(['Vet Back']);
  });

  it('no longer matches a position typed into search — the buttons do that', () => {
    expect(names({ q: 'RB' })).toEqual([]);
  });

  it('ANDs everything at once', () => {
    expect(names({ pos: 'WR', rookiesOnly: true, onlyNeeds: true, needs: ['WR'], q: 'wide' }))
      .toEqual(['Rook Wide']);
    // One contradictory clause empties it.
    expect(names({ pos: 'WR', rookiesOnly: true, onlyNeeds: true, needs: ['QB'] })).toEqual([]);
  });

  it('survives an empty or missing pool', () => {
    expect(filterPool([], { pos: 'RB' })).toEqual([]);
    expect(filterPool(undefined, { pos: 'RB' })).toEqual([]);
  });
});

