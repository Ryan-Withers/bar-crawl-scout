// THE BRACKET — turn a Sleeper winners bracket into a round-by-round tree.
// Roster-id based and handle-agnostic (exactly like championFromBracket): the
// resolver in api/wall.ts maps ids -> handles. Pure + fixture-tested.
import type { BracketMatch } from './wall';

// The live bracket also carries the two seeds (t1/t2) per match.
export interface BracketSeed extends BracketMatch {
  t1?: number | null;
  t2?: number | null;
}

export interface TreeMatch {
  m: number;                              // match id
  t1: number | null;                      // participant roster ids (seeds)
  t2: number | null;
  winner: number | null;
  loser: number | null;
  place: 'Final' | 'Third' | null;        // what this game decides
}

export interface TreeRound {
  round: number;
  label: string;                          // Final / Semifinals / Quarterfinals / Round N
  matches: TreeMatch[];
}

// Semifinals/Quarterfinals count back from the last round; the title game is
// always the final round.
function roundLabel(r: number, maxR: number): string {
  const back = maxR - r;
  if (back === 0) return 'Final';
  if (back === 1) return 'Semifinals';
  if (back === 2) return 'Quarterfinals';
  return `Round ${r}`;
}

const placeRank = (p: 'Final' | 'Third' | null): number => (p === 'Final' ? 0 : p === 'Third' ? 1 : 2);

export function buildBracketTree(bracket: BracketSeed[]): TreeRound[] {
  if (!bracket || !bracket.length) return [];
  const rounds = [...new Set(bracket.map((b) => b.r || 0))].sort((a, b) => a - b);
  const maxR = Math.max(...rounds);
  return rounds.map((r) => {
    const matches: TreeMatch[] = bracket
      .filter((b) => (b.r || 0) === r)
      .map((b) => ({
        m: b.m,
        t1: b.t1 ?? null,
        t2: b.t2 ?? null,
        winner: b.w ?? null,
        loser: b.l ?? null,
        place: b.p === 1 ? 'Final' : b.p === 3 ? 'Third' : null,
      }))
      // Final before Third place before the rest; stable by match id within a tier.
      .sort((a, b) => placeRank(a.place) - placeRank(b.place) || a.m - b.m);
    return { round: r, label: roundLabel(r, maxR), matches };
  });
}

// Has any game actually been decided? (Used to show a recap only for played brackets.)
export function bracketPlayed(bracket: BracketSeed[]): boolean {
  return !!bracket && bracket.some((b) => b.w != null);
}
