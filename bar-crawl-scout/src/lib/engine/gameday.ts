// GAMEDAY — pair a week's matchup rows into head-to-head cards. Sleeper gives one
// row per roster tagged with a shared matchup_id; we fold each pair together,
// order the higher score first, and sort the slate by the biggest total on top.
// Pure + fixture-tested.

export interface MatchupRow {
  roster_id: number;
  matchup_id: number | null;
  points?: number;
}

export interface Side {
  handle: string;
  team: string;
  points: number;
}

export interface Game {
  id: number;
  a: Side;
  b: Side | null;   // null = bye / unpaired
  margin: number;   // 0 until both sides in
  total: number;
}

export function pairMatchups(
  rows: MatchupRow[],
  rosterHandle: Record<number, string>,
  teamName: Record<string, string>,
): Game[] {
  const byId = new Map<number, Side[]>();
  for (const r of rows || []) {
    if (r.matchup_id == null) continue;
    const handle = rosterHandle[r.roster_id];
    if (!handle) continue;
    const side: Side = { handle, team: teamName[handle] || handle, points: Math.round((r.points || 0) * 10) / 10 };
    const arr = byId.get(r.matchup_id) || [];
    arr.push(side);
    byId.set(r.matchup_id, arr);
  }

  const games: Game[] = [];
  for (const [id, sides] of byId) {
    sides.sort((x, y) => y.points - x.points);
    const [a, b = null] = sides;
    games.push({ id, a, b, margin: b ? Math.round((a.points - b.points) * 10) / 10 : 0, total: a.points + (b ? b.points : 0) });
  }
  return games.sort((g, h) => h.total - g.total);
}
