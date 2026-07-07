import { describe, it, expect } from 'vitest';
import { buildUsage, usageRow } from '../src/lib/engine/usage';

describe('usage shares', () => {
  it('computes target/touch/snap share from team denominators', () => {
    const r = usageRow({ week: 1, recTgt: 8, rushAtt: 12, offSnp: 55, tmOffSnp: 66, teamPassAtt: 32, teamPlays: 64 });
    expect(r.tgtShare).toBe(25);   // 8 / 32
    expect(r.touch).toBeCloseTo(31.3, 1); // (12+8)/64 = 31.25 -> 31.3
    expect(r.snap).toBeCloseTo(83.3, 1);  // 55 / 66
    expect(r.touches).toBe(20);
  });

  it('nulls a share when its denominator is missing (never 0)', () => {
    const r = usageRow({ week: 2, recTgt: 5, rushAtt: 0, offSnp: null, tmOffSnp: null, teamPassAtt: null, teamPlays: 50 });
    expect(r.tgtShare).toBeNull();
    expect(r.snap).toBeNull();
    expect(r.touch).not.toBeNull();
  });

  it('averages only weeks with usage and reports a snap trend', () => {
    const s = buildUsage([
      { week: 1, recTgt: 4, rushAtt: 6, offSnp: 30, tmOffSnp: 60, teamPassAtt: 30, teamPlays: 60 },
      { week: 3, recTgt: 8, rushAtt: 10, offSnp: 54, tmOffSnp: 60, teamPassAtt: 30, teamPlays: 60 },
      { week: 2, recTgt: null, rushAtt: 0, offSnp: null, tmOffSnp: null, teamPassAtt: null, teamPlays: null }, // no usage -> dropped
    ]);
    expect(s.weeks.map((w) => w.week)).toEqual([1, 3]); // sorted, empty week dropped
    expect(s.avgSnap).toBe(70); // (50 + 90) / 2
    expect(s.snapTrend).toBe('up');
  });
});
