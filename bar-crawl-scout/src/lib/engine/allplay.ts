// THE LUCK INDEX — all-play record & expected wins from raw weekly scores.
// Each week, a team is scored against EVERY other team, not just its opponent:
// beat 7 of 9 => 7-2 that week. Sum across weeks => an all-play record whose
// win% * games = "expected wins". Actual wins minus expected = luck.
// Pure and fixture-testable: no fetching in here.

export interface RawMatchupRow { roster_id: number; matchup_id?: number | null; points?: number }

export interface AllPlayRow {
  handle: string;
  allWins: number;
  allLosses: number;
  allTies: number;
  allPct: number;     // (allWins + 0.5*allTies) / decisions
  weeks: number;      // weeks this team posted a score
  expWins: number;    // allPct * weeks — wins a fair schedule would've given
}

// weeks: array indexed by (week-1) of that week's matchup rows.
// A week counts only once at least two teams have posted a real (>0) score,
// so unplayed/future weeks (all zeros) are skipped.
export function allPlayTable(
  weeks: RawMatchupRow[][],
  rosterHandle: Record<number, string>,
): AllPlayRow[] {
  const acc: Record<string, { w: number; l: number; t: number; weeks: number }> = {};
  const touch = (h: string) => (acc[h] ||= { w: 0, l: 0, t: 0, weeks: 0 });

  for (const rows of weeks || []) {
    if (!Array.isArray(rows)) continue;
    // Every team's score this week (handle-resolved, actually played).
    const scores = rows
      .map((r) => ({ h: rosterHandle[r.roster_id], pts: r.points ?? 0 }))
      .filter((s) => s.h && s.pts > 0);
    if (scores.length < 2) continue; // nothing to all-play against yet

    for (const me of scores) {
      const a = touch(me.h);
      a.weeks += 1;
      for (const other of scores) {
        if (other === me) continue;
        if (me.pts > other.pts) a.w += 1;
        else if (me.pts < other.pts) a.l += 1;
        else a.t += 1;
      }
    }
  }

  return Object.entries(acc).map(([handle, a]) => {
    const decisions = a.w + a.l + a.t;
    const allPct = decisions ? (a.w + 0.5 * a.t) / decisions : 0;
    return {
      handle,
      allWins: a.w,
      allLosses: a.l,
      allTies: a.t,
      allPct,
      weeks: a.weeks,
      expWins: Math.round(allPct * a.weeks * 10) / 10,
    };
  });
}

// Join all-play expected wins against actual wins -> a luck delta per team.
// Positive = winning more than the scores deserve (lucky schedule).
export interface LuckRow extends AllPlayRow {
  actualWins: number;
  luck: number;       // actualWins - expWins, one decimal
}

export function luckBoard(
  table: AllPlayRow[],
  actualWins: Record<string, number>,
): LuckRow[] {
  return table
    .map((r) => ({
      ...r,
      actualWins: actualWins[r.handle] ?? 0,
      luck: Math.round(((actualWins[r.handle] ?? 0) - r.expWins) * 10) / 10,
    }))
    .sort((a, b) => b.luck - a.luck || b.allPct - a.allPct);
}
