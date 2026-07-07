// POWER RANKINGS — a blend of who's winning (record), who's scoring (points-for)
// and who's built (roster value on your board). Each metric is min-max normalized
// across the league, then weighted. Pure + fixture-tested.

export interface PowerInput {
  handle: string;
  team: string;
  winPct: number;    // 0..1
  pf: number;        // season points-for
  rosterVal: number; // sum of board values on the roster
}

export interface PowerRow extends PowerInput {
  rank: number;
  score: number;     // 0..100 blended
  parts: { record: number; scoring: number; roster: number }; // 0..100 each
}

const WEIGHTS = { record: 0.45, scoring: 0.3, roster: 0.25 };

function norm(vals: number[]): (v: number) => number {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo;
  return (v) => (span ? (v - lo) / span : 0.5);
}

export function powerRankings(teams: PowerInput[]): PowerRow[] {
  if (!teams.length) return [];
  const nW = norm(teams.map((t) => t.winPct));
  const nP = norm(teams.map((t) => t.pf));
  const nR = norm(teams.map((t) => t.rosterVal));
  const rows = teams.map((t) => {
    const record = nW(t.winPct) * 100;
    const scoring = nP(t.pf) * 100;
    const roster = nR(t.rosterVal) * 100;
    const score = Math.round((record * WEIGHTS.record + scoring * WEIGHTS.scoring + roster * WEIGHTS.roster) * 10) / 10;
    return { ...t, rank: 0, score, parts: { record: Math.round(record), scoring: Math.round(scoring), roster: Math.round(roster) } };
  });
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
