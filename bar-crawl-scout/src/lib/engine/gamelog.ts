// Build a receipt-style game log: run each week's raw stats through the league
// scoring engine, auto-pick the notable stat line, mark DNP weeks.
import { scoreStats } from './scoring';

export interface WeekStats {
  week: number;
  opp: string;
  stats: Record<string, number> | null; // null / empty = did not play
}

export interface GameRow {
  week: number;
  opp: string;
  pts: number;
  line: string;
  dnp: boolean;
}

const played = (s: Record<string, number> | null) =>
  !!s && ((s.gms_active ?? s.gp ?? 1) > 0) &&
  Object.keys(s).some((k) => k !== 'gp' && k !== 'gms_active' && s[k] !== 0);

// Auto-pick the most interesting one-liner for the position.
export function keyLine(stats: Record<string, number>, position: string): string {
  const n = (k: string) => Math.round(stats[k] || 0);
  const td = (k: string) => (stats[k] ? `, ${n(k)} TD` : '');
  if (position === 'QB') {
    const base = `${n('pass_yd')} pass yd${td('pass_td')}`;
    const rush = n('rush_yd') >= 20 ? `, ${n('rush_yd')} rush` : '';
    const ints = stats.pass_int ? `, ${n('pass_int')} INT` : '';
    return base + rush + ints;
  }
  if (position === 'RB') {
    const rush = `${n('rush_att')} att, ${n('rush_yd')} yd${td('rush_td')}`;
    const rec = n('rec') ? ` · ${n('rec')} rec ${n('rec_yd')}${td('rec_td')}` : '';
    return rush + rec;
  }
  // WR / TE
  const rec = `${n('rec')} rec, ${n('rec_yd')} yd${td('rec_td')}`;
  const rush = n('rush_yd') >= 15 ? ` · ${n('rush_yd')} rush${td('rush_td')}` : '';
  return rec + rush;
}

export function buildGameLog(
  weeks: WeekStats[],
  scoring: Record<string, number>,
  position: string,
): GameRow[] {
  return weeks
    .slice()
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      if (!played(w.stats)) return { week: w.week, opp: w.opp, pts: 0, line: '', dnp: true };
      const pts = scoreStats(w.stats as Record<string, number>, scoring);
      return { week: w.week, opp: w.opp, pts, line: keyLine(w.stats as Record<string, number>, position), dnp: false };
    });
}

// Season totals from a game log.
export function logTotals(rows: GameRow[]): { games: number; points: number; ppg: number | null } {
  const active = rows.filter((r) => !r.dnp);
  const points = Math.round(active.reduce((s, r) => s + r.pts, 0) * 10) / 10;
  const games = active.length;
  return { games, points, ppg: games ? Math.round((points / games) * 10) / 10 : null };
}

// The best (highest-scoring) week — for the hand-drawn circle annotation.
export function bestWeek(rows: GameRow[]): number | null {
  const active = rows.filter((r) => !r.dnp);
  if (!active.length) return null;
  return active.reduce((best, r) => (r.pts > best.pts ? r : best), active[0]).week;
}
