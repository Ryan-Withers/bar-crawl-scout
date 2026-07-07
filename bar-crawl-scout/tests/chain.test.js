import { describe, it, expect } from 'vitest';
import { chainOfCustody } from '../src/lib/engine/chain';

// One player's real-shaped league history: drafted 2024 R3.02 by Mike ->
// dropped wk6 -> FAAB'd by Trevor $23 wk7 -> traded to Sarah 2025 wk2 -> kept 2026.
const seasons = [
  {
    season: '2024',
    rosterHandle: { 1: 'Mike', 2: 'Trevor', 3: 'Sarah' },
    picks: [{ player_id: 'X', round: 3, pick: 2, roster_id: 1 }],
    txns: [
      { week: 6, created: 1000, type: 'free_agent', drops: { X: 1 } },
      { week: 7, created: 2000, type: 'waiver', settings: { waiver_bid: 23 }, adds: { X: 2 } },
    ],
  },
  {
    season: '2025',
    rosterHandle: { 1: 'Mike', 2: 'Trevor', 3: 'Sarah' },
    txns: [{ week: 2, created: 3000, type: 'trade', adds: { X: 3 }, drops: { X: 2 }, roster_ids: [2, 3] }],
  },
  {
    season: '2026',
    rosterHandle: { 3: 'Sarah' },
    picks: [{ player_id: 'X', round: 3, pick: 2, roster_id: 3, is_keeper: true }],
  },
];

describe('chain of custody', () => {
  it('reconstructs the full custody chain in chronological order', () => {
    const ev = chainOfCustody('X', seasons);
    expect(ev.map((e) => e.kind)).toEqual(['draft', 'drop', 'faab', 'trade', 'keep']);
    expect(ev[0]).toMatchObject({ season: '2024', handle: 'Mike', detail: 'Drafted · R3.02' });
    expect(ev[1]).toMatchObject({ kind: 'drop', handle: 'Mike' });
    expect(ev[2]).toMatchObject({ kind: 'faab', handle: 'Trevor', detail: 'FAAB claim · $23' });
    expect(ev[3].detail).toBe('Traded from Trevor to Sarah');
    expect(ev[4]).toMatchObject({ kind: 'keep', handle: 'Sarah', detail: 'Kept · R3.02' });
  });

  it('returns nothing for a player with no history', () => {
    expect(chainOfCustody('Z', seasons)).toEqual([]);
  });
});
