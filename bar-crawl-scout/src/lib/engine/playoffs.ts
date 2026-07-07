// PLAYOFF PICTURE — from the standings + games left, work out who's in, who's
// on the bubble, who's clinched, who's out, and each team's magic number to
// clinch a spot. Approximation for the picture (PF tiebreaks decide ties for
// real). Pure + fixture-tested.
import type { RankedRow } from './standings';

export type Zone = 'clinched' | 'in' | 'hunt' | 'out';

export interface PlayoffTeam extends RankedRow {
  zone: Zone;
  magic: number | null;   // wins+rival-losses needed to clinch; 0 = clinched
  seed: number | null;    // playoff seed if in a spot
}

export function playoffPicture(ranked: RankedRow[], spots: number, gamesLeft: number): PlayoffTeam[] {
  const firstOut = ranked[spots] || null;         // best team currently outside
  const lastIn = ranked[spots - 1] || null;        // worst team currently inside
  return ranked.map((r, i) => {
    const inSpot = i < spots;
    const maxWins = r.wins + gamesLeft;
    let zone: Zone;
    let magic: number | null = null;
    if (inSpot) {
      // Clinch when the best challenger can't catch you even winning out while you lose out.
      const challengerMax = firstOut ? firstOut.wins + gamesLeft : -1;
      magic = firstOut ? Math.max(0, challengerMax - r.wins + 1) : 0;
      zone = magic === 0 ? 'clinched' : 'in';
    } else {
      // Eliminated when even winning out you can't reach the last team already in.
      const eliminated = !!lastIn && maxWins < lastIn.wins;
      zone = eliminated ? 'out' : 'hunt';
    }
    return { ...r, zone, magic, seed: inSpot ? i + 1 : null };
  });
}
