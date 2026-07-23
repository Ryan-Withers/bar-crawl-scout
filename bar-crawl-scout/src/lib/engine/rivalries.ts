// RIVALRIES — one manager's head-to-head ledger for the season, grouped by
// opponent from the same week-by-week results the Form panel already builds.
// Pure + known-answer tested.
import type { WeekResult } from './streaks';

export interface Rivalry {
  opp: string;
  meetings: number;
  wins: number;
  losses: number;
  ties: number;
  pf: number;         // total points scored vs this rival, 1 dp
  pa: number;         // total points allowed to them, 1 dp
  diff: number;       // pf - pa, 1 dp
  lastWeek: number;
  lastResult: 'W' | 'L' | 'T';
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// Most-played rivals first; ties broken by point differential, then name.
export function rivalryLedger(results: WeekResult[]): Rivalry[] {
  const by: Record<string, Rivalry> = {};
  for (const g of results || []) {
    const r = (by[g.opp] ||= {
      opp: g.opp, meetings: 0, wins: 0, losses: 0, ties: 0,
      pf: 0, pa: 0, diff: 0, lastWeek: 0, lastResult: 'T',
    });
    r.meetings += 1;
    r.pf += g.pts;
    r.pa += g.oppPts;
    if (g.tie) r.ties += 1;
    else if (g.won) r.wins += 1;
    else r.losses += 1;
    if (g.week >= r.lastWeek) {
      r.lastWeek = g.week;
      r.lastResult = g.tie ? 'T' : g.won ? 'W' : 'L';
    }
  }
  return Object.values(by)
    .map((r) => ({ ...r, pf: r1(r.pf), pa: r1(r.pa), diff: r1(r.pf - r.pa) }))
    .sort((a, b) => b.meetings - a.meetings || b.diff - a.diff || a.opp.localeCompare(b.opp));
}
