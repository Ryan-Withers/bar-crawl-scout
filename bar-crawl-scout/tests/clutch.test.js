// CLUTCH — known answers for the one-score record.
import { describe, it, expect } from 'vitest';
import { clutchRecord } from '../src/lib/engine/clutch';

const g = (pts, oppPts) => ({ week: 1, opp: 'X', pts, oppPts, won: pts > oppPts, tie: pts === oppPts });

describe('clutchRecord', () => {
  it('splits close games from blowouts at the threshold', () => {
    const results = [
      g(100, 95),  // close win (margin 5)
      g(90, 99),   // close loss (margin 9)
      g(130, 80),  // blowout win (margin 50)
      g(70, 120),  // blowout loss
      g(101, 92),  // close win (margin 9)
    ];
    const c = clutchRecord(results, 10);
    expect(c).toMatchObject({ closeGames: 3, closeWins: 2, closeLosses: 1, blowoutWins: 1, blowoutLosses: 1 });
    expect(c.record).toBe('2-1');
    expect(c.rate).toBeCloseTo(2 / 3, 5);
  });

  it('treats a margin exactly on the threshold as close', () => {
    const c = clutchRecord([g(110, 100)], 10); // margin 10 -> close
    expect(c.closeGames).toBe(1);
    expect(c.closeWins).toBe(1);
  });

  it('excludes ties and honours a custom threshold', () => {
    const results = [g(100, 100), g(100, 96), g(100, 90)];
    // threshold 5: only the margin-4 game is close; the tie is excluded; margin-10 is a blowout.
    const c = clutchRecord(results, 5);
    expect(c.closeGames).toBe(1);
    expect(c.blowoutWins).toBe(1);
    expect(c.record).toBe('1-0');
  });

  it('is empty-safe: no games -> dash and null rate', () => {
    const c = clutchRecord([], 10);
    expect(c).toMatchObject({ closeGames: 0, record: '—', rate: null });
    expect(clutchRecord(undefined).closeGames).toBe(0);
  });
});
