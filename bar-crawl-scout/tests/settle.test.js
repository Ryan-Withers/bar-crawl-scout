import { describe, it, expect } from 'vitest';
import { gradeLeg, gradeBet } from '../src/lib/engine/settle';

const prop = (player, side, line) => ({ pick: { kind: 'prop', player, side, line } });
const champ = (handle) => ({ pick: { kind: 'champ', handle } });
const finals = (handle) => ({ pick: { kind: 'finals', handle } });

describe('the book — settlement', () => {
  it('grades a prop over/under against real points', () => {
    const ctx = { points: { 'Rashee Rice': 18.4 } };
    expect(gradeLeg(prop('Rashee Rice', 'over', 12.5).pick, ctx)).toBe('won');
    expect(gradeLeg(prop('Rashee Rice', 'under', 12.5).pick, ctx)).toBe('lost');
  });

  it('pushes a prop that lands exactly on the line', () => {
    expect(gradeLeg(prop('X', 'over', 12).pick, { points: { X: 12 } })).toBe('push');
  });

  it('leaves a prop pending when the player has no score yet', () => {
    expect(gradeLeg(prop('X', 'over', 12).pick, { points: {} })).toBe('pending');
  });

  it('grades futures at season end', () => {
    expect(gradeLeg(champ('Ryan').pick, { champion: 'Ryan' })).toBe('won');
    expect(gradeLeg(champ('Ryan').pick, { champion: 'joshleota' })).toBe('lost');
    expect(gradeLeg(finals('Ryan').pick, { finalists: ['Ryan', 'jduddy9'] })).toBe('won');
    expect(gradeLeg(champ('Ryan').pick, {})).toBe('pending');
  });

  it('settles a single from its one leg', () => {
    const ctx = { points: { X: 20 } };
    expect(gradeBet({ kind: 'single', legs: [prop('X', 'over', 15)] }, ctx)).toBe('won');
    expect(gradeBet({ kind: 'single', legs: [prop('X', 'under', 15)] }, ctx)).toBe('lost');
  });

  it('voids a single that pushes', () => {
    expect(gradeBet({ kind: 'single', legs: [prop('X', 'over', 12)] }, { points: { X: 12 } })).toBe('void');
  });

  it('wins a multi only when every leg wins', () => {
    const ctx = { points: { A: 20, B: 20 } };
    expect(gradeBet({ kind: 'multi', legs: [prop('A', 'over', 10), prop('B', 'over', 10)] }, ctx)).toBe('won');
    expect(gradeBet({ kind: 'multi', legs: [prop('A', 'over', 10), prop('B', 'under', 10)] }, ctx)).toBe('lost');
  });

  it('keeps a bet open while any leg is pending', () => {
    const ctx = { points: { A: 20 } };
    expect(gradeBet({ kind: 'multi', legs: [prop('A', 'over', 10), prop('B', 'over', 10)] }, ctx)).toBe(null);
  });

  it('voids a multi that has a push but no loss', () => {
    const ctx = { points: { A: 20, B: 12 } };
    expect(gradeBet({ kind: 'multi', legs: [prop('A', 'over', 10), prop('B', 'over', 12)] }, ctx)).toBe('void');
  });
});
