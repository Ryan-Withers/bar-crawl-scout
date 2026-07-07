// BYE RADAR — for your roster, which weeks bite. Groups your players by bye week
// and flags weeks where a starting position gets thin (2+ out at one spot).
// Pure + fixture-tested.

export interface ByePlayer {
  name: string;
  pos: string;
  bye: number;
  starter?: boolean;
}

export interface ByeWeek {
  week: number;
  players: ByePlayer[];
  byPos: Record<string, number>;  // pos -> count out that week
  thin: string[];                 // positions with 2+ out (a real hole)
}

export function byeOutlook(roster: ByePlayer[], fromWeek = 1, toWeek = 14): ByeWeek[] {
  const weeks: Record<number, ByePlayer[]> = {};
  for (const p of roster) {
    if (!p.bye || p.bye < fromWeek || p.bye > toWeek) continue;
    (weeks[p.bye] = weeks[p.bye] || []).push(p);
  }
  return Object.keys(weeks)
    .map(Number)
    .sort((a, b) => a - b)
    .map((week) => {
      const players = weeks[week].slice().sort((a, b) => a.pos.localeCompare(b.pos));
      const byPos: Record<string, number> = {};
      for (const p of players) byPos[p.pos] = (byPos[p.pos] || 0) + 1;
      const thin = Object.keys(byPos).filter((pos) => byPos[pos] >= 2).sort();
      return { week, players, byPos, thin };
    });
}
