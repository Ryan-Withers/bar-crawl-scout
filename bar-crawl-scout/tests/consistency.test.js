// CONSISTENCY — known answers for the floor/ceiling/volatility profile.
import { describe, it, expect } from 'vitest';
import { profileWeeks } from '../src/lib/engine/consistency';

describe('profileWeeks', () => {
  it('summarises a steady scorer (low relative volatility)', () => {
    // Tight cluster around 15: mean 15, std-dev small -> STEADY.
    const p = profileWeeks([14, 15, 16, 15, 14, 16]);
    expect(p.weeks).toBe(6);
    expect(p.mean).toBe(15);
    expect(p.floor).toBe(14);
    expect(p.ceiling).toBe(16);
    expect(p.cv).toBeLessThan(0.4);
    expect(p.verdict).toBe('STEADY');
    expect(p.boomPct).toBe(0); // nothing reaches 1.25x (18.75)
  });

  it('flags a boom-or-bust player as VOLATILE with real boom/bust weeks', () => {
    // mean 15, wild spread. 30 >= 18.75 (boom), 2 <= 9 (bust).
    const p = profileWeeks([2, 30, 4, 28, 3, 23]);
    expect(p.mean).toBe(15);
    expect(p.cv).toBeGreaterThan(0.65);
    expect(p.verdict).toBe('VOLATILE');
    expect(p.boomPct).toBe(50); // 30, 28, 23 all >= 18.75
    expect(p.bustPct).toBe(50); // 2, 4, 3 all <= 9
  });

  it('matches an exact hand-computed volatility', () => {
    // weekly [10,20,30]: mean 20, variance ((100+0+100)/3)=66.66, sd=8.16 -> 8.2
    const p = profileWeeks([10, 20, 30]);
    expect(p.mean).toBe(20);
    expect(p.vol).toBe(8.2);
    expect(p.cv).toBe(0.41); // 8.2/20 = 0.41
    expect(p.verdict).toBe('STREAKY');
  });

  it('needs at least three played weeks', () => {
    expect(profileWeeks([12, 18])).toBeNull();
    expect(profileWeeks([])).toBeNull();
    expect(profileWeeks(null)).toBeNull();
  });

  it('is safe when every week is a zero', () => {
    const p = profileWeeks([0, 0, 0, 0]);
    expect(p.mean).toBe(0);
    expect(p.cv).toBe(0);
    expect(p.verdict).toBe('STEADY');
  });
});
