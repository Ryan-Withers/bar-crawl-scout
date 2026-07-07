// THE TABLE — rank the league. Sort by wins, then points-for as the tiebreak
// (same order Sleeper shows). Games-back and win% are derived off the leader.
// Pure + fixture-tested; the page merges live records with the static fallback.

export interface TeamRow {
  handle: string;
  team: string;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
}

export interface RankedRow extends TeamRow {
  rank: number;
  pct: number;    // win% 0..1, rounded 3dp
  gb: number;     // games behind the leader (0 for the leader)
  diff: number;   // points-for minus points-against
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function rankStandings(rows: TeamRow[]): RankedRow[] {
  const sorted = rows.slice().sort((a, b) =>
    (b.wins - a.wins) || (b.pf - a.pf) || (a.losses - b.losses));
  const leader = sorted[0];
  return sorted.map((r, i) => {
    const games = r.wins + r.losses + r.ties;
    const pct = games ? r3((r.wins + r.ties / 2) / games) : 0;
    const gb = leader ? ((leader.wins - r.wins) + (r.losses - leader.losses)) / 2 : 0;
    return { ...r, rank: i + 1, pct, gb: Math.max(0, gb), diff: r1(r.pf - r.pa) };
  });
}
