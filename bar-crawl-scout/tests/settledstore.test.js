// THE SETTLED SQUAD, as every page actually reads it.
//
// principle.test.js proves the engine moves the right men. This proves the app
// hands that result to the twenty-one components that read the keeper store —
// which is a separate claim, and the one Ryan can see: his mock team should
// start on four, not three.
//
// The pipeline reproduced here is LiveKeepers.svelte's: declared ledger ->
// settleLedger -> the store's [[name, conf], ...] shape -> keptRows.
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import txns from '../src/lib/api/fixtures/transactions-2026-1.json';
import users from '../src/lib/api/fixtures/users-2026.json';
import rosters from '../src/lib/api/fixtures/rosters-2026.json';
import playersBlob from '../src/lib/api/fixtures/players-trimmed.json';
import { userHandleMap } from '../src/api/league';
import { keeperLedger } from '../src/lib/engine/keepers';
import { pendingMoves, settleLedger } from '../src/lib/engine/principle';
import { keptRows, watchName, needScores, isKept, ownerOf } from '../src/lib/models.js';
import { TEAMS, NEED_TGT } from '../src/lib/data.js';

const HANDLES = new Set(TEAMS.map(([h]) => h));
const uh = userHandleMap(users);
const handleOf = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
const nameOf = (id) => {
  const p = playersBlob[String(id)];
  return p ? { name: p.full_name, pos: p.position } : null;
};

const declared = keeperLedger(rosters, uh, nameOf);
const settled = settleLedger(declared, pendingMoves(txns), handleOf);

// Exactly what LiveKeepers.toStoreShape does.
function toStoreShape(ledger) {
  const out = {};
  for (const [handle, men] of Object.entries(ledger)) {
    if (!HANDLES.has(handle)) continue;
    const rows = men.map((m) => [m.name, 'VL']);
    while (rows.length < 4) rows.push(['', '']);
    out[handle] = rows;
  }
  return out;
}
const ks = toStoreShape(settled);
const names = (h) => keptRows(ks, h).map((s) => s[0]).sort();

describe('the store carries the squad each manager will really have', () => {
  it('starts Ryan on FOUR, Nacua among them', () => {
    // The one Ryan photographed: the mock said MY TEAM 3/15 while a fourth man
    // was already bought and paid for.
    expect(names('Ryan')).toEqual(['Brock Bowers', "Ja'Marr Chase", 'Puka Nacua', 'Tetairoa McMillan']);
    expect(keptRows(ks, 'Ryan')).toHaveLength(4);
  });

  it('starts ImyHunter on five and jpdonners on one', () => {
    expect(names('ImyHunter')).toEqual(['Bijan Robinson', 'CeeDee Lamb', 'Emeka Egbuka', 'Malik Nabers', 'Zay Flowers']);
    expect(names('jpdonners')).toEqual(['Lamar Jackson']);
  });

  it('takes the sold men OFF the selling squads', () => {
    expect(names('joshleota')).not.toContain('Puka Nacua');
    expect(names('jpdonners')).not.toContain('CeeDee Lamb');
  });

  it('still has thirty men kept, and every one of them out of the pool', () => {
    const all = TEAMS.flatMap(([h]) => names(h));
    expect(all).toHaveLength(30);
    expect(new Set(all).size).toBe(30);
    for (const n of all) expect(isKept(ks, n), `${n} is kept`).toBe(true);
  });

  it('names the NEW owner when asked who has a settled man', () => {
    expect(ownerOf(ks, 'Puka Nacua').owner).toBe('Ryan');
    expect(ownerOf(ks, 'CeeDee Lamb').owner).toBe('ImyHunter');
  });

  it('reads no watch slot off a live squad, whatever its length', () => {
    for (const [h] of TEAMS) expect(watchName(ks, h), `${h} has no watcher`).toBeNull();
  });
});

describe('roster need counts the settled squad', () => {
  it('counts Ryan\'s fourth man, so he needs one fewer receiver', () => {
    // Nacua is a WR. Counting three would have said Ryan still needs 3 WR when
    // he has two of them, and the mock would have chased the wrong position.
    const withHim = needScores(ks, 'Ryan', NEED_TGT);
    const withoutHim = needScores(toStoreShape(declared), 'Ryan', NEED_TGT);
    expect(withHim.WR).toBeLessThan(withoutHim.WR);
  });

  it('says jpdonners needs everything, because he has one man left', () => {
    const n = needScores(ks, 'jpdonners', NEED_TGT);
    expect(n.RB).toBe(10);
    expect(n.WR).toBe(10);
    // Lamar is his one keeper, so the QB seat is the only one he has filled.
    expect(n.QB).toBe(0);
  });

  it('does not read past a five-man squad or stop at three', () => {
    const n = needScores(ks, 'ImyHunter', NEED_TGT);
    const three = needScores(toStoreShape({ ImyHunter: settled.ImyHunter.slice(0, 3) }), 'ImyHunter', NEED_TGT);
    expect(n.WR).toBeLessThan(three.WR);
  });
});

describe('the wiring is actually in place', () => {
  it('LiveKeepers settles the ledger before it reaches the store', async () => {
    // A behavioural test can only prove the engine works; this proves the app
    // calls it. The pipeline above is a copy, and a copy proves nothing on its
    // own.
    const src = await readFile('src/components/LiveKeepers.svelte', 'utf8');
    expect(src).toContain('settleLedger');
    expect(src).toContain('pendingMoves');
    // And it must NOT go back to cutting the squad down to three.
    expect(src).not.toMatch(/slice\(0,\s*3\)/);
  });

  it('the draft board is left alone', async () => {
    // Ownership of the man and ownership of the pick are different things:
    // joshleota declared Nacua, so the keeper still sits on joshleota's 14.03
    // and costs him that round.
    const src = await readFile('src/components/DraftRoom.svelte', 'utf8');
    expect(src).not.toContain('settleLedger');
  });
});
