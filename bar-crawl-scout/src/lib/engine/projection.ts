// PROJECTION vs REALITY — did he beat his weekly projection? Both sides are
// league-scored (projections run through the same scoring engine as actuals),
// so the delta is honest. Pure + fixture-tested.

export interface ProjRow {
  week: number;
  proj: number;
  actual: number;
  dnp: boolean;
}

export interface ProjSummary {
  weeks: ProjRow[];
  beatRate: number | null;  // % of played weeks he met or beat the number
  avgDelta: number | null;  // avg (actual - proj) over played weeks
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function projSummary(rows: ProjRow[]): ProjSummary {
  const played = rows.filter((r) => !r.dnp);
  if (!played.length) return { weeks: rows, beatRate: null, avgDelta: null };
  const beats = played.filter((r) => r.actual >= r.proj).length;
  const avgDelta = r1(played.reduce((s, r) => s + (r.actual - r.proj), 0) / played.length);
  return { weeks: rows, beatRate: Math.round((beats / played.length) * 100), avgDelta };
}
