import { describe, it, expect } from 'vitest';
import { validateBet, WEEKLY_SPEND_CAP, MULTI_CAP } from '../src/lib/bet.js';

const single = (stake, week = 1) => ({ week, kind: 'single', stake, odds: 1.9, legs: [{ label: 'x' }] });
const multi = (stake, legs = 2, week = 1) => ({ week, kind: 'multi', stake, odds: 3, legs: Array.from({ length: legs }, (_, i) => ({ label: 'l' + i })) });

describe('the book — bet gatekeeper', () => {
  it('accepts a normal single for a known bettor', () => {
    expect(validateBet([], 'Ryan', 1, single(20)).ok).toBe(true);
  });

  it('rejects an unknown bettor', () => {
    expect(validateBet([], 'NotAManager', 1, single(20)).ok).toBe(false);
  });

  it('enforces the weekly spend cap across all a bettor\'s bets', () => {
    const priors = [{ handle: 'Ryan', week: 1, stake: WEEKLY_SPEND_CAP - 10, kind: 'single' }];
    expect(validateBet(priors, 'Ryan', 1, single(10)).ok).toBe(true);   // exactly to the cap
    expect(validateBet(priors, 'Ryan', 1, single(11)).ok).toBe(false);  // one dollar over
  });

  it('counts only the same week toward the cap', () => {
    const priors = [{ handle: 'Ryan', week: 1, stake: WEEKLY_SPEND_CAP, kind: 'single' }];
    expect(validateBet(priors, 'Ryan', 2, single(50, 2)).ok).toBe(true);
  });

  it('caps the multi stake and allows only one multi per week', () => {
    expect(validateBet([], 'Ryan', 1, multi(MULTI_CAP + 1)).ok).toBe(false); // over $20
    const used = [{ handle: 'Ryan', week: 1, stake: 5, kind: 'multi', legs: [{}, {}] }];
    expect(validateBet(used, 'Ryan', 1, multi(5)).ok).toBe(false);           // second multi
  });

  it('rejects a multi with fewer than two legs', () => {
    expect(validateBet([], 'Ryan', 1, multi(5, 1)).ok).toBe(false);
  });
});
