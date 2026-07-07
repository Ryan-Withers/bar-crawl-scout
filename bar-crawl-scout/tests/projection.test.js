import { describe, it, expect } from 'vitest';
import { projSummary } from '../src/lib/engine/projection';

const rows = [
  { week: 1, proj: 12, actual: 18, dnp: false }, // beat +6
  { week: 2, proj: 15, actual: 9, dnp: false },  // missed -6
  { week: 3, proj: 14, actual: 14, dnp: false }, // met (counts as beat) 0
  { week: 4, proj: 13, actual: 0, dnp: true },   // DNP -> excluded
];

describe('projection vs reality', () => {
  it('computes beat rate and average delta over played weeks only', () => {
    const s = projSummary(rows);
    expect(s.beatRate).toBe(67); // 2 of 3 played weeks met/beat
    expect(s.avgDelta).toBe(0);  // (+6 -6 +0)/3
    expect(s.weeks).toHaveLength(4);
  });

  it('returns nulls when he never played', () => {
    const s = projSummary([{ week: 1, proj: 10, actual: 0, dnp: true }]);
    expect(s.beatRate).toBeNull();
    expect(s.avgDelta).toBeNull();
  });
});
