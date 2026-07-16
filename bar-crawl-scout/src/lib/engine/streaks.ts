// STREAKS & RECORDS — one manager's season read week by week from raw
// Sleeper matchups. Pure and fixture-testable: no fetching in here.

export interface RawMatchupRow { roster_id: number; matchup_id: number | null; points?: number }
export interface WeekResult {
  week: number;
  pts: number;
  oppPts: number;
  opp: string;          // opponent's handle
  won: boolean;
  tie: boolean;
}

// weeks: array indexed by (week - 1) of that week's matchup rows.
// A 0–0 pairing is an unplayed week, not a game; byes/missing weeks are skipped.
export function weekResultsFor(
  handle: string,
  weeks: RawMatchupRow[][],
  rosterHandle: Record<number, string>,
): WeekResult[] {
  const out: WeekResult[] = [];
  const myRoster = Object.keys(rosterHandle).map(Number).find((rid) => rosterHandle[rid] === handle);
  if (myRoster == null) return out;
  (weeks || []).forEach((rows, i) => {
    if (!Array.isArray(rows)) return;
    const mine = rows.find((r) => r.roster_id === myRoster);
    if (!mine || mine.matchup_id == null) return;
    const opp = rows.find((r) => r.matchup_id === mine.matchup_id && r.roster_id !== mine.roster_id);
    if (!opp) return;
    const pts = mine.points ?? 0;
    const oppPts = opp.points ?? 0;
    if (pts === 0 && oppPts === 0) return;
    out.push({
      week: i + 1, pts, oppPts,
      opp: rosterHandle[opp.roster_id] || `roster ${opp.roster_id}`,
      won: pts > oppPts, tie: pts === oppPts,
    });
  });
  return out;
}

export interface StreakSummary {
  cur: { kind: 'W' | 'L' | 'T'; len: number } | null;  // the active run
  longestW: number;
  longestL: number;
  best: WeekResult | null;
  worst: WeekResult | null;
  last5: Array<'W' | 'L' | 'T'>;                        // oldest -> newest
}

export function streakSummary(results: WeekResult[]): StreakSummary {
  if (!results.length) return { cur: null, longestW: 0, longestL: 0, best: null, worst: null, last5: [] };
  const kindOf = (r: WeekResult): 'W' | 'L' | 'T' => (r.tie ? 'T' : r.won ? 'W' : 'L');
  let longestW = 0;
  let longestL = 0;
  let run = 0;
  let runKind: 'W' | 'L' | 'T' | '' = '';
  for (const r of results) {
    const k = kindOf(r);
    if (k === runKind) run += 1; else { runKind = k; run = 1; }
    if (k === 'W') longestW = Math.max(longestW, run);
    if (k === 'L') longestL = Math.max(longestL, run);
  }
  const best = results.reduce((a, b) => (b.pts > a.pts ? b : a));
  const worst = results.reduce((a, b) => (b.pts < a.pts ? b : a));
  return {
    cur: { kind: runKind as 'W' | 'L' | 'T', len: run },
    longestW, longestL, best, worst,
    last5: results.slice(-5).map(kindOf),
  };
}
