// THE WIRE — merge a player universe (top-200 or the full live blob) with your
// board values, live ownership and trending adds, then filter + rank for the
// waiver use case. Pure + fixture-tested; the component supplies the universe.

export interface WirePlayer { name: string; pos: string; team: string }
export interface WireCtx {
  valByName: Record<string, { val: number; bye: number; adp: number }>;
  own: Record<string, string>;          // lowercase name -> owner handle
  trend: Record<string, number>;        // lowercase name -> trending-add count
  ryan: string;
  pos: string;                          // 'ALL' or a position
  freeOnly: boolean;
  trendingOnly: boolean;
  q: string;
  limit?: number;
}

export interface WireRow {
  name: string; pos: string; team: string;
  val: number | null; bye: number; owner: string | null; trend: number;
}

export function buildWireRows(universe: WirePlayer[], ctx: WireCtx): WireRow[] {
  const q = ctx.q.trim().toLowerCase();
  const rows: WireRow[] = [];
  for (const p of universe) {
    if (ctx.pos !== 'ALL' && p.pos !== ctx.pos) continue;
    const key = p.name.toLowerCase();
    const owner = ctx.own[key] || null;
    if (ctx.freeOnly && owner) continue;
    const trend = ctx.trend[key] || 0;
    if (ctx.trendingOnly && !trend) continue;
    if (q && !key.includes(q)) continue;
    const v = ctx.valByName[key];
    rows.push({ name: p.name, pos: p.pos, team: p.team, val: v ? v.val : null, bye: v ? v.bye : 0, owner, trend });
  }
  // Rank: board value first (best available), then trending, then name.
  rows.sort((a, b) =>
    (b.val ?? -1) - (a.val ?? -1) || b.trend - a.trend || a.name.localeCompare(b.name));
  return rows.slice(0, ctx.limit || 150);
}
