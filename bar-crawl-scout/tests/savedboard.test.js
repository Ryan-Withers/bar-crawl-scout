import { describe, it, expect } from 'vitest';
import { PLAYERS, nameKey } from '../src/lib/data.js';

// The Board's reconcile() is component-local, so this pins the RULE it now uses:
// a saved entry survives if the man is findable under any spelling, and comes
// back canonicalised to the board's own.
function reconcileLike(savedOrder, seed) {
  const canonical = new Map(PLAYERS.map((p) => [nameKey(p[1]), p[1]]));
  const ord = []; const have = new Set();
  for (const n of savedOrder) {
    const canon = canonical.get(nameKey(n));
    if (canon && !have.has(canon)) { ord.push(canon); have.add(canon); }
  }
  seed.forEach((n) => { if (!have.has(n)) ord.push(n); });
  return ord;
}

describe('a saved draft board survives a spelling change', () => {
  it('keeps a hand-ranked man Sleeper spells without his suffix', () => {
    // The old rule dropped him outright and re-appended him at the bottom from
    // the seed order — silently undoing the ranking the user had done by hand.
    const saved = ['Kenneth Walker', 'Brian Thomas', "Ja'Marr Chase"];
    const out = reconcileLike(saved, []);
    expect(out).toEqual(['Kenneth Walker III', 'Brian Thomas Jr.', "Ja'Marr Chase"]);
  });

  it('keeps him at the TOP where he was put, not at the bottom', () => {
    const seed = PLAYERS.map((p) => p[1]);
    const out = reconcileLike(['Kenneth Walker'], seed);
    expect(out[0]).toBe('Kenneth Walker III');
  });

  it('still drops a man who has genuinely left the board', () => {
    expect(reconcileLike(['Somebody Retired'], [])).toEqual([]);
  });

  it('never lists the same man twice under two spellings', () => {
    const out = reconcileLike(['Kenneth Walker', 'Kenneth Walker III'], []);
    expect(out).toEqual(['Kenneth Walker III']);
  });

  it('appends everyone the saved list never mentioned', () => {
    const out = reconcileLike(['Kenneth Walker'], ['Bijan Robinson', 'Kenneth Walker III']);
    expect(out).toEqual(['Kenneth Walker III', 'Bijan Robinson']);
  });
});
