// ROSTER DEPTH — known answers for the positional depth read.
import { describe, it, expect } from 'vitest';
import { rosterDepth } from '../src/lib/engine/rosterdepth';

const P = (pos, proj) => ({ pos, proj });
const SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX'];

describe('rosterDepth', () => {
  it('counts bodies against required starters and tags depth', () => {
    const roster = [
      P('QB', 20),                              // 1 QB, needs 1 -> THIN
      P('RB', 15), P('RB', 12), P('RB', 8),     // 3 RB, needs 2 -> OK
      P('WR', 14), P('WR', 11), P('WR', 9), P('WR', 6), // 4 WR, needs 2 -> DEEP
      P('TE', 7),                               // 1 TE, needs 1 -> THIN
    ];
    const d = rosterDepth(roster, SLOTS);
    const by = Object.fromEntries(d.map((r) => [r.pos, r]));
    expect(by.QB).toMatchObject({ count: 1, starters: 1, tag: 'THIN', value: 20 });
    expect(by.RB).toMatchObject({ count: 3, starters: 2, tag: 'OK', value: 35 });
    expect(by.WR).toMatchObject({ count: 4, starters: 2, tag: 'DEEP', value: 40 });
    expect(by.TE).toMatchObject({ count: 1, starters: 1, tag: 'THIN', value: 7 });
  });

  it('returns rows in canonical order for the positions in the slots', () => {
    const d = rosterDepth([P('QB', 1)], SLOTS);
    expect(d.map((r) => r.pos)).toEqual(['QB', 'RB', 'WR', 'TE']);
  });

  it('a zero-body position is THIN with no value', () => {
    const d = rosterDepth([P('QB', 18)], SLOTS);
    const te = d.find((r) => r.pos === 'TE');
    expect(te).toMatchObject({ count: 0, tag: 'THIN', value: 0 });
  });

  it('only reports positions present in the slots', () => {
    const d = rosterDepth([P('QB', 1), P('RB', 1)], ['QB', 'RB', 'RB']);
    expect(d.map((r) => r.pos)).toEqual(['QB', 'RB']);
  });

  it('is empty-safe', () => {
    expect(rosterDepth([], SLOTS).every((r) => r.count === 0 && r.tag === 'THIN')).toBe(true);
    expect(rosterDepth(undefined, undefined)).toEqual([]);
  });
});
