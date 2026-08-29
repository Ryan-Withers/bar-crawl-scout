// POSITIONAL EDGES — known answers for the where-it's-won breakdown.
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { positionalEdges, edgeHighlights } from '../src/lib/engine/edges';

const seat = (slot, proj) => ({ slot, player: { proj } });

describe('positionalEdges', () => {
  it('buckets by slot, sums projections, and diffs the two sides', () => {
    const mine = [seat('QB', 22), seat('RB', 15), seat('RB', 12), seat('WR', 10), seat('FLEX', 8)];
    const theirs = [seat('QB', 18), seat('RB', 9), seat('RB', 8), seat('WR', 20), seat('FLEX', 14)];
    const e = positionalEdges(mine, theirs);
    const byPos = Object.fromEntries(e.map((x) => [x.pos, x]));
    expect(byPos.QB).toMatchObject({ mine: 22, theirs: 18, edge: 4 });
    expect(byPos.RB).toMatchObject({ mine: 27, theirs: 17, edge: 10 });   // 15+12 vs 9+8
    expect(byPos.WR).toMatchObject({ mine: 10, theirs: 20, edge: -10 });
    expect(byPos.FLEX).toMatchObject({ edge: -6 });
  });

  it('orders slots canonically (QB, RB, WR, TE, FLEX, K, DEF)', () => {
    const mine = [seat('DEF', 8), seat('FLEX', 10), seat('QB', 20), seat('WR', 15)];
    const e = positionalEdges(mine, []);
    expect(e.map((x) => x.pos)).toEqual(['QB', 'WR', 'FLEX', 'DEF']);
  });

  it('treats a slot missing on one side as zero', () => {
    const e = positionalEdges([seat('QB', 21)], []);
    expect(e).toEqual([{ pos: 'QB', mine: 21, theirs: 0, edge: 21 }]);
    expect(positionalEdges([], [])).toEqual([]);
  });

  it('rounds cleanly to one decimal', () => {
    const e = positionalEdges([seat('RB', 10.05), seat('RB', 5.02)], [seat('RB', 3.33)]);
    expect(e[0]).toMatchObject({ mine: 15.1, theirs: 3.3, edge: 11.8 });
  });
});

describe('edgeHighlights', () => {
  it('finds the biggest swing for and against', () => {
    const edges = positionalEdges(
      [seat('QB', 22), seat('RB', 27), seat('WR', 10)],
      [seat('QB', 18), seat('RB', 17), seat('WR', 20)],
    );
    const { best, worst } = edgeHighlights(edges);
    expect(best.pos).toBe('RB');   // +10
    expect(worst.pos).toBe('WR');  // -10
  });

  it('is null-safe on empty input', () => {
    expect(edgeHighlights([])).toEqual({ best: null, worst: null });
  });
});

describe('the synced stores survive a reload', () => {
  it('writes back every key it reads from', async () => {
    // draft and faab were read at boot and never written, so a sync lasted until
    // the next reload and then the app fell back to hand-written constants as if
    // it had never run.
    const src = await readFile('src/lib/store.js', 'utf8');
    for (const key of ['hq_rosters_v2', 'hq_draft_v1', 'hq_faab_v1']) {
      const reads = src.includes(`readJSON('${key}')`);
      const writes = src.includes(`writeJSON('${key}'`);
      expect(reads, `${key} is read`).toBe(true);
      expect(writes, `${key} is written back`).toBe(true);
    }
  });
});
