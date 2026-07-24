// CLUTCH — a manager's record in the games that came down to the wire.
// Splits the season by margin: nail-biters (decided by <= threshold) vs
// blowouts. "5-1 in one-score games" separates the clutch from the fraudulent.
// Pure + known-answer tested. Reads the same WeekResult[] the Form panel builds.
import type { WeekResult } from './streaks';

export interface Clutch {
  closeGames: number;
  closeWins: number;
  closeLosses: number;   // ties are excluded from the W/L split
  blowoutWins: number;
  blowoutLosses: number;
  record: string;        // "W-L" in close games (or "—" if none)
  rate: number | null;   // close-game win rate 0..1, null if no close games
}

export function clutchRecord(results: WeekResult[], threshold = 10): Clutch {
  let closeWins = 0, closeLosses = 0, closeGames = 0;
  let blowoutWins = 0, blowoutLosses = 0;
  for (const g of results || []) {
    if (g.tie) continue;
    const margin = Math.abs(g.pts - g.oppPts);
    if (margin <= threshold) {
      closeGames += 1;
      if (g.won) closeWins += 1; else closeLosses += 1;
    } else if (g.won) blowoutWins += 1;
    else blowoutLosses += 1;
  }
  return {
    closeGames,
    closeWins,
    closeLosses,
    blowoutWins,
    blowoutLosses,
    record: closeGames ? `${closeWins}-${closeLosses}` : '—',
    rate: closeGames ? closeWins / closeGames : null,
  };
}
