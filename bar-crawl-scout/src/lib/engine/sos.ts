// STRENGTH OF SCHEDULE — how tough a road each team has actually walked.
// For every game played, take the opponent's season scoring average; a team's
// SOS is the mean of those. Toughest slate ranks #1. Pure + known-answer tested.

export interface RawMatchupRow { roster_id: number; matchup_id?: number | null; points?: number }

export interface SosRow {
  handle: string;
  games: number;      // games with a resolvable, scored opponent
  oppPpg: number;     // average opponent season points-per-game, 1 dp
  rank: number;       // 1 = toughest schedule faced
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function strengthOfSchedule(
  weeks: RawMatchupRow[][],
  rosterHandle: Record<number, string>,
  strengthByHandle: Record<string, number>,   // handle -> season ppg
): SosRow[] {
  const agg: Record<string, { sum: number; games: number }> = {};
  const touch = (h: string) => (agg[h] ||= { sum: 0, games: 0 });

  for (const rows of weeks || []) {
    if (!Array.isArray(rows)) continue;
    // Pair by matchup_id; both sides must have played (points > 0).
    const byMid: Record<string, Array<{ h: string; pts: number }>> = {};
    for (const r of rows) {
      const h = rosterHandle[r.roster_id];
      const pts = r.points ?? 0;
      if (!h || pts <= 0 || r.matchup_id == null) continue;
      (byMid[r.matchup_id] ||= []).push({ h, pts });
    }
    for (const mid in byMid) {
      const pair = byMid[mid];
      if (pair.length !== 2) continue;
      const [x, y] = pair;
      const sx = strengthByHandle[y.h];
      const sy = strengthByHandle[x.h];
      if (sx != null) { const a = touch(x.h); a.sum += sx; a.games += 1; }
      if (sy != null) { const b = touch(y.h); b.sum += sy; b.games += 1; }
    }
  }

  return Object.entries(agg)
    .map(([handle, a]) => ({ handle, games: a.games, oppPpg: a.games ? r1(a.sum / a.games) : 0 }))
    .sort((a, b) => b.oppPpg - a.oppPpg || a.handle.localeCompare(b.handle))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
