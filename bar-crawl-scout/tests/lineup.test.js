import { describe, it, expect } from 'vitest';
import { optimalLineup, byeHoles } from '../src/lib/engine/lineup';

const P = (name, pos, proj, bye = 0) => ({ name, pos, team: 'X', proj, bye });

describe('lineup optimizer', () => {
  const slots = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX'];
  const roster = [
    P('QB1', 'QB', 25), P('RB1', 'RB', 22), P('RB2', 'RB', 18), P('RB3', 'RB', 15),
    P('WR1', 'WR', 20), P('WR2', 'WR', 17), P('WR3', 'WR', 9),
    P('TE1', 'TE', 12),
  ];

  it('fills dedicated slots then FLEX with the best leftover', () => {
    const { seats, bench } = optimalLineup(roster, slots);
    const byName = (s) => seats.find((x) => x.slot === s);
    expect(seats.find((s) => s.slot === 'QB').player.name).toBe('QB1');
    // FLEX should take RB3 (15) over WR3 (9) — the best remaining flex-eligible.
    expect(seats.find((s) => s.slot === 'FLEX').player.name).toBe('RB3');
    expect(bench.map((b) => b.name).sort()).toEqual(['WR3']);
  });

  it('suggests a start/sit when your current lineup differs from optimal', () => {
    // Current lineup wrongly benches RB1 (22) and starts WR3 (9) at FLEX.
    const r2 = roster.map((p) => {
      if (p.name === 'RB1') return { ...p, starter: false }; // benched but should start
      if (p.name === 'WR3') return { ...p, starter: true };  // starting but should sit
      return { ...p, starter: true };
    });
    const { moves } = optimalLineup(r2, slots);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0].in).toBe('RB1');   // start your stud
    expect(moves[0].out).toBe('WR3');  // over the scrub you're starting
    expect(moves[0].gain).toBe(13);    // 22 - 9
  });

  it('reports no moves when the current lineup is already optimal', () => {
    const opt = optimalLineup(roster, slots);
    const optNames = new Set(opt.seats.map((s) => s.player && s.player.name));
    const r = roster.map((p) => ({ ...p, starter: optNames.has(p.name) }));
    expect(optimalLineup(r, slots).moves).toEqual([]);
  });

  // Regression (Ryan's bug): moves used to zip should-start/should-sit by index
  // with no eligibility check, producing pairs like "TE over WR @ TE" — an
  // illegal Sleeper move. Same-position swaps must pair together; cross-position
  // leftovers pair at the flex, never at a dedicated slot.
  it('never suggests sitting a player at a slot their position cannot occupy', () => {
    const slots2 = ['WR', 'WR', 'TE', 'FLEX'];
    const r = [
      { ...P('WR_A', 'WR', 10), starter: true },
      { ...P('WR_B', 'WR', 9), starter: true },
      { ...P('TE_A', 'TE', 8), starter: true },
      { ...P('TE_B', 'TE', 7), starter: true },  // currently flexed
      { ...P('WR_C', 'WR', 12), starter: false }, // should start
      { ...P('TE_C', 'TE', 11), starter: false }, // should start
    ];
    const { moves } = optimalLineup(r, slots2);
    const ELIG = { WR: ['WR'], TE: ['TE'], FLEX: ['RB', 'WR', 'TE'] };
    for (const m of moves) {
      if (m.out === '(bench)') continue;
      const outPos = r.find((p) => p.name === m.out).pos;
      expect(ELIG[m.slot], `${m.in} over ${m.out} @ ${m.slot} is illegal`).toContain(outPos);
    }
    // The TE entering pairs with a TE (or a flex seat) — never "over a WR @ TE".
    const teMove = moves.find((m) => m.in === 'TE_C');
    expect(teMove.out).toBe('TE_B');
    expect(teMove.slot).toBe('TE');
    // The WR entering displaces the remaining TE via the flex chain.
    const wrMove = moves.find((m) => m.in === 'WR_C');
    expect(wrMove.out).toBe('TE_A');
    expect(wrMove.slot).toBe('FLEX');
  });

  it('flags bye-week holes among the starters', () => {
    const r = roster.map((p) => (p.name === 'RB1' ? { ...p, bye: 7 } : p));
    const { seats } = optimalLineup(r, slots);
    const holes = byeHoles(seats, 7);
    expect(holes.map((h) => h.name)).toContain('RB1');
    expect(byeHoles(seats, 3)).toEqual([]);
  });
});
