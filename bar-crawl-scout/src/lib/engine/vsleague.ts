// VS THE LEAGUE — what a player averages against each manager. Every week his
// fantasy team faced someone; group his league-scored points by that opponent.
// Pure + fixture-tested; the data layer resolves matchups -> opponent handle.

export interface VsLine {
  opponent: string;   // manager handle he faced that week
  points: number;     // his league-scored points that week
}

export interface VsRow {
  opponent: string;
  games: number;
  avg: number;        // rounded 1dp
  best: number;       // his ceiling vs this manager
  total: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function vsLeague(lines: VsLine[]): VsRow[] {
  const by = new Map<string, { games: number; total: number; best: number }>();
  for (const l of lines) {
    if (!l.opponent) continue;
    const cur = by.get(l.opponent) || { games: 0, total: 0, best: -Infinity };
    cur.games += 1;
    cur.total += l.points;
    if (l.points > cur.best) cur.best = l.points;
    by.set(l.opponent, cur);
  }
  return [...by.entries()]
    .map(([opponent, v]) => ({ opponent, games: v.games, total: r1(v.total), avg: r1(v.total / v.games), best: r1(v.best) }))
    .sort((a, b) => b.avg - a.avg || a.opponent.localeCompare(b.opponent));
}
