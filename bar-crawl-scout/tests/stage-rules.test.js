// STAGE RULES — the audit that keeps the career-stage tags in data.js honest.
// The whole valuation model hangs off those tags, and they are hand-written, so
// the rules that police them need to be right.
import { describe, it, expect } from 'vitest';
import { checkStage, STAGES } from '../scripts/stage-rules.mjs';

const row = (stage, pos = 'WR', name = 'Test Man', adp = 70) => ({ name, pos, adp, stage });
const sl = (yearsExp, age = null) => ({ yearsExp, age });

describe('years_exp settles rookie status outright', () => {
  it('a first-year player MUST be tagged rookie', () => {
    for (const s of ['yr2', 'asc', 'prime', 'aging', 'fading', '']) {
      const { hard } = checkStage(row(s), sl(0));
      expect(hard).toHaveLength(1);
      expect(hard[0]).toMatch(/FIRST year/);
      expect(hard[0]).toMatch(/should be 'rookie'/);
    }
    expect(checkStage(row('rookie'), sl(0)).hard).toEqual([]);
  });

  it('a player with any experience must NOT be tagged rookie', () => {
    // This is the Jaxson Dart case: a 2025 draftee still carrying a 2026 rookie tag.
    for (const ye of [1, 2, 5, 12]) {
      const { hard } = checkStage(row('rookie'), sl(ye));
      expect(hard).toHaveLength(1);
      expect(hard[0]).toMatch(/tagged 'rookie' but years_exp/);
    }
  });

  it('a second-year player MUST be tagged yr2', () => {
    for (const s of ['asc', 'prime', 'aging', 'fading', '']) {
      const { hard } = checkStage(row(s), sl(1));
      expect(hard.some((h) => /SECOND year/.test(h))).toBe(true);
    }
    expect(checkStage(row('yr2'), sl(1)).hard).toEqual([]);
  });

  it('yr2 on a veteran is caught too', () => {
    expect(checkStage(row('yr2'), sl(4)).hard[0]).toMatch(/tagged 'yr2' but years_exp 4/);
    expect(checkStage(row('yr2'), sl(1)).hard).toEqual([]);
  });

  it('leaves the genuinely subjective stages alone once experience agrees', () => {
    // asc/prime/aging/fading are all legitimate for a 5-year player — that call
    // is an opinion, and the checker must not pretend otherwise.
    for (const s of ['asc', 'prime', 'aging', 'fading']) {
      expect(checkStage(row(s), sl(5)).hard).toEqual([]);
    }
  });

  it('says nothing hard when Sleeper has no years_exp for the player', () => {
    for (const s of [...STAGES, '']) {
      expect(checkStage(row(s), sl(null)).hard).toEqual([]);
    }
    expect(checkStage(row('rookie'), null).hard).toEqual([]);
  });

  it('rejects a stage string that is not a stage at all', () => {
    expect(checkStage(row('sophomore'), sl(1)).hard.some((h) => /not a known stage/.test(h))).toBe(true);
  });
});

describe('the soft observations', () => {
  it('flags an untagged player without failing the build', () => {
    const { hard, soft } = checkStage(row(''), sl(5));
    expect(hard).toEqual([]);
    expect(soft[0]).toMatch(/no stage tag at all/);
  });

  it('flags an old RB still called prime — the overselling this model had', () => {
    expect(checkStage(row('prime', 'RB'), sl(6, 29)).soft.some((s) => /RB aged 29/.test(s))).toBe(true);
    // Same age at receiver is unremarkable.
    expect(checkStage(row('prime', 'WR'), sl(6, 29)).soft).toEqual([]);
    // And an old RB correctly tagged is left alone.
    expect(checkStage(row('aging', 'RB'), sl(6, 29)).soft).toEqual([]);
  });

  it('flags a young player written off as aging', () => {
    expect(checkStage(row('fading', 'WR'), sl(2, 23)).soft.some((s) => /aged 23/.test(s))).toBe(true);
  });

  it('never turns a soft observation into a failure', () => {
    const { hard } = checkStage(row('prime', 'RB'), sl(6, 31));
    expect(hard).toEqual([]);
  });

  it('says nothing about age when Sleeper has no age', () => {
    expect(checkStage(row('prime', 'RB'), sl(6, null)).soft).toEqual([]);
  });
});
