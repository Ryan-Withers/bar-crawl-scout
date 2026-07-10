import { describe, it, expect } from 'vitest';
import {
  createMock, makePick, simToUser, simToEnd, gradeMock, blendValue,
  needFactor, unfilledStarters, buildSequence, sequenceFromSlots, currentHandle, shuffle, shortName,
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
