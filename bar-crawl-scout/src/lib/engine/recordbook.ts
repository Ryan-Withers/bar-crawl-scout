// THE RECORD BOOK — the season's extremes, straight off the weekly scores.
// Highest single-team week, lowest played week, biggest blowout, closest
// nail-biter, and the highest-combined shootout. Pure + known-answer tested.

export interface RawMatchupRow { roster_id: number; matchup_id?: number | null; points?: number }

export interface TeamWeek { handle: string; week: number; pts: number }
export interface GameLine {
  week: number;
  winner: string;
  loser: string;
  winPts: number;
  losePts: number;
  margin: number;
}
export interface Shootout { week: number; a: string; b: string; combined: number }

export interface RecordBook {
  topWeek: TeamWeek | null;
  lowWeek: TeamWeek | null;
  blowout: GameLine | null;
  nailbiter: GameLine | null;   // smallest non-tie margin
  shootout: Shootout | null;    // highest combined points in one game
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// weeks: array indexed by (week-1) of that week's matchup rows.
export function recordBook(
  weeks: RawMatchupRow[][],
  rosterHandle: Record<number, string>,
): RecordBook {
  let topWeek: TeamWeek | null = null;
  let lowWeek: TeamWeek | null = null;
  let blowout: GameLine | null = null;
  let nailbiter: GameLine | null = null;
  let shootout: Shootout | null = null;

  (weeks || []).forEach((rows, i) => {
    if (!Array.isArray(rows)) return;
    const week = i + 1;
    const scored = rows
      .map((r) => ({ h: rosterHandle[r.roster_id], pts: r.points ?? 0, mid: r.matchup_id }))
      .filter((s) => s.h && s.pts > 0);

    // Team-week extremes.
    for (const s of scored) {
      if (!topWeek || s.pts > topWeek.pts) topWeek = { handle: s.h, week, pts: r1(s.pts) };
      if (!lowWeek || s.pts < lowWeek.pts) lowWeek = { handle: s.h, week, pts: r1(s.pts) };
    }

    // Pair by matchup_id -> per-game extremes.
    const byMid: Record<string, typeof scored> = {};
    for (const s of scored) {
      if (s.mid == null) continue;
      (byMid[s.mid] ||= []).push(s);
    }
    for (const mid in byMid) {
      const pair = byMid[mid];
      if (pair.length !== 2) continue;
      const [x, y] = pair;
      const combined = r1(x.pts + y.pts);
      if (!shootout || combined > shootout.combined) shootout = { week, a: x.h, b: y.h, combined };

      const margin = r1(Math.abs(x.pts - y.pts));
      if (margin === 0) continue; // a tie isn't a blowout or a nail-biter
      const hi = x.pts >= y.pts ? x : y;
      const lo = x.pts >= y.pts ? y : x;
      const line: GameLine = { week, winner: hi.h, loser: lo.h, winPts: r1(hi.pts), losePts: r1(lo.pts), margin };
      if (!blowout || margin > blowout.margin) blowout = line;
      if (!nailbiter || margin < nailbiter.margin) nailbiter = line;
    }
  });

  return { topWeek, lowWeek, blowout, nailbiter, shootout };
}
