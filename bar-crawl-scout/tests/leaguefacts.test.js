// THE HAND-WRITTEN LEAGUE FACTS, checked against the league.
//
// data.js carries a scouting report on the room: how much early capital each
// manager holds, who is buying this year and who is buying next. It is prose and
// a couple of constants, so nothing ever failed when it went stale — and it had,
// badly. Four of the ten capital rows were wrong, ATorelli4 was still described
// as "a known bluffer on his stated keepers" in a season where the keepers are
// locked and public, and joshleota was written down as the win-now buyer in the
// month he sold Justin Jefferson and Puka Nacua.
//
// These tests derive every claim from the captured fixtures. When the room
// changes again, this is what says so.
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import users from '../src/lib/api/fixtures/users-2026.json';
import rosters from '../src/lib/api/fixtures/rosters-2026.json';
import traded from '../src/lib/api/fixtures/traded_picks-2026.json';
import txns from '../src/lib/api/fixtures/transactions-2026-1.json';
import { userHandleMap } from '../src/api/league';
import { capitalFor } from '../src/lib/engine/picks';
import { CAPITAL, REBUILD, CONTEND, MGRS, PERSONA, TEAMS } from '../src/lib/data.js';

const uh = userHandleMap(users);
const rosterHandle = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
const now = capitalFor(2026, 15, traded, rosterHandle);
const next = capitalFor(2027, 15, traded, rosterHandle);
const handles = TEAMS.map(([h]) => h);

describe('CAPITAL is what Sleeper says it is', () => {
  it('matches the traded-pick ledger for all ten managers', () => {
    for (const h of handles) {
      expect(CAPITAL[h], `${h} has a capital row`).toBeTruthy();
      expect(CAPITAL[h], `${h}'s 2026 firsts/seconds/thirds`).toEqual(now[h].top3);
    }
  });

  it('has Ryan on ONE first, not two', () => {
    // He sent JShrimp341's first to joshleota for Puka Nacua. The constant was
    // written before that and still read [2, 0, 3].
    expect(CAPITAL.Ryan).toEqual([1, 0, 3]);
    expect(now.joshleota.top3[0]).toBe(1);
  });

  it('does not describe jpdonners as stripped', () => {
    // Selling Lamb and Flowers brought picks back the other way.
    expect(CAPITAL.jpdonners).toEqual([0, 1, 1]);
  });
});

describe('who is buying which year', () => {
  // A manager who has taken future capital in is rebuilding; one who has sent it
  // out to buy production now is contending. Baseline is one of each round.
  const futures = Object.fromEntries(handles.map((h) => [h, next[h].top3]));
  const firsts27 = (h) => futures[h][0];

  it('puts joshleota among the rebuilders, holding four 2027 firsts', () => {
    expect(firsts27('joshleota')).toBe(4);
    expect(REBUILD.has('joshleota')).toBe(true);
    expect(CONTEND.has('joshleota'), 'he is not the win-now buyer any more').toBe(false);
  });

  it('puts jpdonners with him, on three 2027 seconds and no first', () => {
    expect(futures.jpdonners).toEqual([0, 3, 1]);
    expect(REBUILD.has('jpdonners')).toBe(true);
  });

  it('takes ImyHunter and ShaydenB OUT of the rebuild — they spent it', () => {
    expect(firsts27('ImyHunter')).toBe(0);
    expect(firsts27('ShaydenB')).toBe(0);
    for (const h of ['ImyHunter', 'ShaydenB']) {
      expect(REBUILD.has(h), `${h} is not rebuilding`).toBe(false);
      expect(CONTEND.has(h), `${h} is contending`).toBe(true);
    }
  });

  it('never puts a manager in both camps', () => {
    for (const h of handles) expect(REBUILD.has(h) && CONTEND.has(h), h).toBe(false);
  });

  it('holds the rule it states, on the trade log itself', () => {
    // The rule: a manager who has sent PLAYERS out and taken 2027 capital IN is
    // rebuilding; one who has taken players in and sent 2027 capital out is
    // contending. The futures column alone does not separate them — ATorelli4
    // and jpdonners hold the same weight of 2027 picks and are doing opposite
    // things with them — so read both sides of the deals.
    const ledger = {};
    const bump = (h, k, n) => { (ledger[h] = ledger[h] || { men: 0, futures: 0 })[k] += n; };
    for (const t of txns) {
      if (t.type !== 'trade' || (t.status && t.status !== 'complete')) continue;
      for (const rid of Object.values(t.adds || {})) bump(rosterHandle[rid], 'men', 1);
      for (const rid of Object.values(t.drops || {})) bump(rosterHandle[rid], 'men', -1);
      for (const p of t.draft_picks || []) {
        if (String(p.season) !== '2027') continue;
        bump(rosterHandle[p.owner_id], 'futures', 1);
        bump(rosterHandle[p.previous_owner_id], 'futures', -1);
      }
    }
    for (const h of REBUILD) {
      expect(ledger[h], `${h} traded this off-season`).toBeTruthy();
      expect(ledger[h].men, `${h} sold players`).toBeLessThan(0);
      expect(ledger[h].futures, `${h} took 2027 capital in`).toBeGreaterThan(0);
    }
    // And the three who bought with next year's picks are the other way: they
    // paid in 2027 and came out of it no lighter in bodies. ShaydenB is exactly
    // level on men — he swapped DeVonta Smith out for Justin Jefferson — which
    // is an upgrade bought with a first, not a sale.
    for (const h of ['ImyHunter', 'ShaydenB', 'ATorelli4']) {
      expect(ledger[h].men, `${h} did not sell down`).toBeGreaterThanOrEqual(0);
      expect(ledger[h].futures, `${h} paid in 2027`).toBeLessThan(0);
      expect(CONTEND.has(h)).toBe(true);
    }
  });
});

describe('the scouting notes do not describe a season that is over', () => {
  it('says nothing about bluffing on stated keepers', async () => {
    // The keepers are locked and public. Whatever was true when a manager could
    // lie about them, it is not information now.
    const data = await readFile('src/lib/data.js', 'utf8');
    const intel = await readFile('src/components/Intel.svelte', 'utf8');
    expect(data.toLowerCase()).not.toContain('bluff');
    expect(intel.toLowerCase()).not.toContain('bluff');
  });

  it('covers every manager and nobody else', () => {
    expect(MGRS.map((m) => m.h).sort()).toEqual([...handles].sort());
  });

  it('gives everyone but Ryan a tendency and a note', () => {
    for (const m of MGRS) {
      if (m.h === 'Ryan') continue;              // sealed by the commissioner
      expect(m.tend.length, `${m.h} tendency`).toBeGreaterThan(20);
      expect(m.note.length, `${m.h} note`).toBeGreaterThan(20);
      expect(m.tags.length, `${m.h} tags`).toBeGreaterThan(0);
    }
  });
});

describe('the mock GMs draft like the men they are', () => {
  it('gives every manager a dial, and no two the same flat 50', () => {
    expect(Object.keys(PERSONA).sort()).toEqual([...handles].sort());
    const flat = handles.filter((h) => PERSONA[h].window === 50 && PERSONA[h].chaos === 50);
    // Only Ryan's, and only because it is his own seat.
    expect(flat).toEqual(['Ryan']);
  });

  it('puts every rebuilder on the future side of the dial', () => {
    for (const h of REBUILD) expect(PERSONA[h].window, `${h} drafts for next year`).toBeGreaterThan(60);
  });

  it('puts the three who spent their futures on the win-now side', () => {
    for (const h of ['ImyHunter', 'ShaydenB', 'ATorelli4']) {
      expect(PERSONA[h].window, `${h} drafts for this year`).toBeLessThan(50);
    }
  });

  it('has joshleota as the most future-facing GM in the room', () => {
    // He sold Jefferson and Nacua and holds four 2027 firsts. If anyone in this
    // league is drafting for next season it is him.
    const others = handles.filter((h) => h !== 'joshleota');
    for (const h of others) expect(PERSONA.joshleota.window, `vs ${h}`).toBeGreaterThan(PERSONA[h].window);
  });

  it('and ImyHunter as the most win-now', () => {
    const others = handles.filter((h) => h !== 'ImyHunter');
    for (const h of others) expect(PERSONA.ImyHunter.window, `vs ${h}`).toBeLessThan(PERSONA[h].window);
  });

  it('keeps every dial in range', () => {
    for (const h of handles) {
      expect(PERSONA[h].window).toBeGreaterThanOrEqual(0);
      expect(PERSONA[h].window).toBeLessThanOrEqual(100);
      expect(PERSONA[h].chaos).toBeGreaterThanOrEqual(0);
      expect(PERSONA[h].chaos).toBeLessThanOrEqual(100);
    }
  });
});
