// THE TICKER — known answers for the normalised transaction feed.
import { describe, it, expect } from 'vitest';
import { buildTicker } from '../src/lib/engine/ticker';

const RH = { 1: 'A', 2: 'B', 3: 'C' };
const NAME = { '100': 'Star RB', '200': 'Bust WR', '300': 'Sleeper TE', '400': 'Kicker' };
const nameOf = (id) => NAME[id] || id;

describe('buildTicker', () => {
  it('normalises a waiver into a handle-attributed add/drop with the bid', () => {
    const weeks = [
      [{ type: 'waiver', status: 'complete', created: 10, roster_ids: [1], adds: { '100': 1 }, drops: { '200': 1 }, settings: { waiver_bid: 37 } }],
    ];
    const [row] = buildTicker(weeks, RH, nameOf);
    expect(row).toMatchObject({ week: 1, type: 'waiver', bid: 37, parties: ['A'] });
    expect(row.adds).toEqual([{ player: 'Star RB', handle: 'A' }]);
    expect(row.drops).toEqual([{ player: 'Bust WR', handle: 'A' }]);
  });

  it('attributes both sides of a trade', () => {
    const weeks = [
      [{ type: 'trade', status: 'complete', created: 20, roster_ids: [1, 2], adds: { '100': 2, '300': 1 }, drops: { '100': 1, '300': 2 } }],
    ];
    const [row] = buildTicker(weeks, RH, nameOf);
    expect(row.type).toBe('trade');
    expect(row.parties.sort()).toEqual(['A', 'B']);
    expect(row.bid).toBeNull();
    // Star RB went to B; Sleeper TE went to A.
    expect(row.adds).toContainEqual({ player: 'Star RB', handle: 'B' });
    expect(row.adds).toContainEqual({ player: 'Sleeper TE', handle: 'A' });
  });

  it('sorts newest-first across weeks and honours the limit', () => {
    const weeks = [
      [{ type: 'free_agent', status: 'complete', created: 5, roster_ids: [1], adds: { '100': 1 } }],
      [{ type: 'free_agent', status: 'complete', created: 50, roster_ids: [2], adds: { '200': 2 } }],
      [{ type: 'free_agent', status: 'complete', created: 30, roster_ids: [3], adds: { '300': 3 } }],
    ];
    const rows = buildTicker(weeks, RH, nameOf);
    expect(rows.map((r) => r.created)).toEqual([50, 30, 5]);
    expect(buildTicker(weeks, RH, nameOf, 2).map((r) => r.created)).toEqual([50, 30]);
  });

  it('skips incomplete transactions and pick-only trades, and resolves unknown ids/rosters', () => {
    const weeks = [
      [
        { type: 'waiver', status: 'failed', created: 1, roster_ids: [1], adds: { '100': 1 } }, // failed
        { type: 'trade', status: 'complete', created: 2, roster_ids: [1, 2] },                  // pick-only, no adds/drops
        { type: 'free_agent', status: 'complete', created: 3, roster_ids: [9], adds: { '999': 9 } }, // unknown
      ],
    ];
    const rows = buildTicker(weeks, RH, nameOf);
    expect(rows).toHaveLength(1);
    expect(rows[0].adds).toEqual([{ player: '999', handle: 'roster 9' }]);
  });

  it('is empty-safe', () => {
    expect(buildTicker([], RH, nameOf)).toEqual([]);
    expect(buildTicker(undefined, RH, nameOf)).toEqual([]);
  });
});
