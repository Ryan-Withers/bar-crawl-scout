// TRADES IN PRINCIPLE — reconciled against the real 2026 transaction log.
//
// The league allows a keeper to be traded before the draft on the understanding
// that it executes after it. Sleeper cannot express that, so the deal is put
// through and the commissioner then moves the players back, because a man must
// be on your roster for you to declare him as one of your three.
//
// Every number here is read off that log, not invented.
import { describe, it, expect } from 'vitest';
import txns from '../src/lib/api/fixtures/transactions-2026-1.json';
import users from '../src/lib/api/fixtures/users-2026.json';
import rosters from '../src/lib/api/fixtures/rosters-2026.json';
import playersBlob from '../src/lib/api/fixtures/players-trimmed.json';
import { userHandleMap } from '../src/api/league';
import {
  pendingMoves, pendingByPlayer, outgoingByRoster, incomingByRoster, settledKeepers,
} from '../src/lib/engine/principle';

const uh = userHandleMap(users);
const handleOf = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
const nameOf = (id) => (playersBlob[String(id)] || {}).full_name || `#${id}`;
const moves = pendingMoves(txns);
const named = moves.map((m) => ({
  player: nameOf(m.playerId), from: handleOf[m.fromRoster], to: handleOf[m.toRoster],
}));

describe('the real log', () => {
  it('finds exactly three men whose trade is agreed but not yet executed', () => {
    expect(named).toEqual([
      { player: 'Puka Nacua', from: 'joshleota', to: 'Ryan' },
      { player: 'CeeDee Lamb', from: 'jpdonners', to: 'ImyHunter' },
      { player: 'Zay Flowers', from: 'jpdonners', to: 'ImyHunter' },
    ]);
  });

  it('does NOT flag the trades that actually executed', () => {
    // Gibbs went to ATorelli4 and Henderson to joshleota; Jefferson went to
    // ShaydenB and DeVonta Smith to joshleota. Nobody moved those back, so they
    // are ordinary completed trades and the keepers already reflect them.
    const flagged = named.map((n) => n.player);
    for (const p of ['Jahmyr Gibbs', 'TreVeyon Henderson', 'Justin Jefferson', 'DeVonta Smith']) {
      expect(flagged, `${p} is not pending`).not.toContain(p);
    }
  });

  it('does not mistake a waiver drop for a deal', () => {
    // Six free-agent drops sit in the same log.
    for (const p of ['Jack Campbell', 'Kareem Hunt', 'Trey Benson', 'Raheim Sanders']) {
      expect(named.map((n) => n.player)).not.toContain(p);
    }
  });

  it('records when each was agreed and when it was put back', () => {
    for (const m of moves) {
      expect(m.revertedAt).toBeGreaterThan(m.agreedAt);
      expect(m.fromRoster).not.toBe(m.toRoster);
    }
  });
});

describe('what it means for each manager', () => {
  it("Ryan is really keeping FOUR: his three plus Nacua after the draft", () => {
    const inc = incomingByRoster(moves);
    const ryanRoster = Number(Object.keys(handleOf).find((k) => handleOf[k] === 'Ryan'));
    expect((inc[ryanRoster] || []).map((m) => nameOf(m.playerId))).toEqual(['Puka Nacua']);
  });

  it('jpdonners is really keeping ONE — Lamar — and owes the other two', () => {
    const out = outgoingByRoster(moves);
    const jp = Number(Object.keys(handleOf).find((k) => handleOf[k] === 'jpdonners'));
    expect((out[jp] || []).map((m) => nameOf(m.playerId)).sort())
      .toEqual(['CeeDee Lamb', 'Zay Flowers']);
  });

  it('ImyHunter ends up with FIVE, which no page said before', () => {
    const inc = incomingByRoster(moves);
    const imy = Number(Object.keys(handleOf).find((k) => handleOf[k] === 'ImyHunter'));
    expect((inc[imy] || []).length).toBe(2);
  });

  it('settles a roster into what it will actually be', () => {
    const jp = Number(Object.keys(handleOf).find((k) => handleOf[k] === 'jpdonners'));
    const keepers = (rosters.find((r) => r.roster_id === jp).keepers || []).map((id) => ({ playerId: String(id) }));
    const look = (id) => ({ playerId: String(id) });
    const { stays, leaving, arriving } = settledKeepers(keepers, jp, moves, look);
    expect(stays.map((k) => nameOf(k.playerId))).toEqual(['Lamar Jackson']);
    expect(leaving.map((k) => nameOf(k.playerId)).sort()).toEqual(['CeeDee Lamb', 'Zay Flowers']);
    expect(arriving).toEqual([]);
  });

  it('maps a player straight to where he is going', () => {
    const by = pendingByPlayer(moves);
    const nacua = moves.find((m) => nameOf(m.playerId) === 'Puka Nacua');
    expect(handleOf[by[nacua.playerId]]).toBe('Ryan');
  });
});

describe('the rule, in isolation', () => {
  const T = (type, at, from, to, id = 'p1') => ({
    type, status: 'complete', created: at, drops: { [id]: from }, adds: { [id]: to },
  });

  it('a trade with no reversal is just a trade', () => {
    expect(pendingMoves([T('trade', 1, 2, 3)])).toEqual([]);
  });

  it('a commissioner move that does NOT undo the trade is not an agreement', () => {
    // Moved on to a third roster, not back to the first.
    expect(pendingMoves([T('trade', 1, 2, 3), T('commissioner', 2, 3, 4)])).toEqual([]);
  });

  it('a later real trade supersedes an earlier pending one', () => {
    const out = pendingMoves([
      T('trade', 1, 2, 3), T('commissioner', 2, 3, 2),   // agreed 2 -> 3
      T('trade', 3, 2, 4),                               // then genuinely sold to 4
    ]);
    expect(out).toEqual([]);
  });

  it('reads the log in any order', () => {
    const a = pendingMoves([T('commissioner', 2, 3, 2), T('trade', 1, 2, 3)]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ fromRoster: 2, toRoster: 3 });
  });

  it('ignores incomplete transactions', () => {
    const bad = [{ ...T('trade', 1, 2, 3), status: 'failed' }, T('commissioner', 2, 3, 2)];
    expect(pendingMoves(bad)).toEqual([]);
  });

  it('ignores an add or a drop with no counterparty', () => {
    expect(pendingMoves([{ type: 'free_agent', status: 'complete', created: 1, drops: { p1: 3 } }])).toEqual([]);
    expect(pendingMoves([{ type: 'waiver', status: 'complete', created: 1, adds: { p1: 3 } }])).toEqual([]);
  });

  it('degrades on rubbish', () => {
    expect(pendingMoves(null)).toEqual([]);
    expect(pendingMoves(undefined)).toEqual([]);
    expect(pendingMoves([])).toEqual([]);
    expect(pendingMoves([{}])).toEqual([]);
  });
});
