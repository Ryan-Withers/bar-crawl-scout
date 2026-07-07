// USAGE — target / touch / snap share per week, off real box-score denominators.
// The resolver aggregates each week's blob into team totals; this turns those
// into shares via the derived formulas and rolls up a season summary + trend.
// Pure + fixture-tested.
import { targetShare, touchShare, snapShare, trend } from './derived';

export interface UsageInput {
  week: number;
  recTgt: number | null;      // his targets
  rushAtt: number | null;     // his carries
  offSnp: number | null;      // his offensive snaps
  tmOffSnp: number | null;    // team offensive snaps
  teamPassAtt: number | null; // team pass attempts (sum of team QBs)
  teamPlays: number | null;   // team pass att + rush att
}

export interface UsageRow {
  week: number;
  tgtShare: number | null;   // % of team pass attempts
  touch: number | null;      // % of team plays
  snap: number | null;       // % of team offensive snaps
  touches: number;           // raw carries + targets
}

export interface UsageSummary {
  weeks: UsageRow[];
  avgTgtShare: number | null;
  avgTouch: number | null;
  avgSnap: number | null;
  snapTrend: 'up' | 'down' | 'flat' | null;
}

const avg = (xs: Array<number | null>): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
};

export function usageRow(i: UsageInput): UsageRow {
  return {
    week: i.week,
    tgtShare: targetShare(i.recTgt, i.teamPassAtt),
    touch: touchShare(i.rushAtt, i.recTgt, i.teamPlays),
    snap: snapShare(i.offSnp, i.tmOffSnp),
    touches: Math.round((i.rushAtt || 0) + (i.recTgt || 0)),
  };
}

// Only weeks where he had a snap or a touch count toward the trend/averages.
export function buildUsage(inputs: UsageInput[]): UsageSummary {
  const weeks = inputs
    .slice()
    .sort((a, b) => a.week - b.week)
    .map(usageRow)
    .filter((r) => r.snap != null || r.touches > 0);
  return {
    weeks,
    avgTgtShare: avg(weeks.map((w) => w.tgtShare)),
    avgTouch: avg(weeks.map((w) => w.touch)),
    avgSnap: avg(weeks.map((w) => w.snap)),
    snapTrend: trend(weeks.map((w) => w.snap ?? 0)),
  };
}
