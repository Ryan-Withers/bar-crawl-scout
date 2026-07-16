// THE BRACKET — known answers first, then a pass over CAPTURED reality.
import { describe, it, expect } from 'vitest';
import { buildBracketTree, bracketPlayed } from '../src/lib/engine/brackettree';
import bracket2024 from '../src/lib/api/fixtures/winners_bracket-2024.json';
import bracket2025 from '../src/lib/api/fixtures/winners_bracket-2025.json';
import bracket2026 from '../src/lib/api/fixtures/winners_bracket-2026.json';

describe('buildBracketTree — known answers', () => {
  it('groups a 2-round bracket into Semifinals then Final, with placements resolved', () => {
    const tree = buildBracketTree(bracket2024); // champ 3 def 1; third 5 over 2
    expect(tree).toHaveLength(2);

    const [semis, finalRound] = tree;
    expect(semis.label).toBe('Semifinals');
    expect(semis.round).toBe(1);
    expect(semis.matches).toHaveLength(2);
    expect(semis.matches.every((m) => m.place === null)).toBe(true);

    expect(finalRound.label).toBe('Final');
    expect(finalRound.matches).toHaveLength(2);
    // Final ordered before Third place.
    expect(finalRound.matches.map((m) => m.place)).toEqual(['Final', 'Third']);

    const title = finalRound.matches[0];
    expect(title).toMatchObject({ place: 'Final', winner: 3, loser: 1, t1: 1, t2: 3 });
    const third = finalRound.matches[1];
    expect(third).toMatchObject({ place: 'Third', winner: 5, loser: 2 });
  });

  it('resolves the 2025 fixture (champ 6 def 4, third 7 over 2)', () => {
    const finalRound = buildBracketTree(bracket2025).at(-1);
    const title = finalRound.matches.find((m) => m.place === 'Final');
    const third = finalRound.matches.find((m) => m.place === 'Third');
    expect(title).toMatchObject({ winner: 6, loser: 4 });
    expect(third).toMatchObject({ winner: 7, loser: 2 });
  });

  it('handles an unplayed bracket: rounds render, winners are null, nothing decided', () => {
    const tree = buildBracketTree(bracket2026); // seeds set, no results yet
    expect(tree.length).toBeGreaterThan(0);
    expect(tree.flatMap((r) => r.matches).every((m) => m.winner === null)).toBe(true);
    expect(bracketPlayed(bracket2026)).toBe(false);
    // The completed seasons ARE flagged played.
    expect(bracketPlayed(bracket2024)).toBe(true);
    expect(bracketPlayed(bracket2025)).toBe(true);
  });

  it('labels deeper brackets Quarterfinals -> Semifinals -> Final', () => {
    const qf = buildBracketTree([
      { r: 1, m: 1, w: 1, l: 8, t1: 1, t2: 8 },
      { r: 1, m: 2, w: 4, l: 5, t1: 4, t2: 5 },
      { r: 2, m: 3, w: 1, l: 4, t1: 1, t2: 4 },
      { r: 3, m: 4, w: 1, l: 2, t1: 1, t2: 2, p: 1 },
    ]);
    expect(qf.map((r) => r.label)).toEqual(['Quarterfinals', 'Semifinals', 'Final']);
  });

  it('is null-safe on empty/missing input', () => {
    expect(buildBracketTree([])).toEqual([]);
    expect(buildBracketTree(null)).toEqual([]);
    expect(bracketPlayed([])).toBe(false);
  });
});
