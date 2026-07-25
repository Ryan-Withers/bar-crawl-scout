// THE TICKER — the league's transaction feed, normalised for display.
// Raw Sleeper transactions (adds/drops map player_id -> roster_id) become
// handle-attributed move rows, newest first. Pure + known-answer tested.

export interface RawTxn {
  type: string;
  status?: string;
  settings?: { waiver_bid?: number } | null;
  roster_ids?: number[];
  adds?: Record<string, number> | null;   // player_id -> roster_id that gained him
  drops?: Record<string, number> | null;  // player_id -> roster_id that shed him
  created?: number;
}

export interface MovePlayer { player: string; handle: string }
export interface TickerRow {
  created: number;
  week: number;
  type: string;                 // 'waiver' | 'free_agent' | 'trade' | ...
  bid: number | null;           // waiver bid, when it's a waiver
  parties: string[];            // handles involved (1 for waiver/FA, 2 for a trade)
  adds: MovePlayer[];
  drops: MovePlayer[];
}

const uniq = (xs: string[]): string[] => [...new Set(xs.filter(Boolean))];

// weeks: array indexed by (week-1) of that week's raw transactions.
// nameOf resolves a player_id to a display name (falls back to the id).
export function buildTicker(
  weeks: RawTxn[][],
  rosterHandle: Record<number, string>,
  nameOf: (playerId: string) => string,
  limit = 40,
): TickerRow[] {
  const rows: TickerRow[] = [];
  (weeks || []).forEach((txns, i) => {
    if (!Array.isArray(txns)) return;
    const week = i + 1;
    for (const t of txns) {
      if (t.status && t.status !== 'complete') continue;
      const moves = (map: Record<string, number> | null | undefined): MovePlayer[] =>
        Object.entries(map || {}).map(([pid, rid]) => ({ player: nameOf(pid), handle: rosterHandle[rid] || `roster ${rid}` }));
      const adds = moves(t.adds);
      const drops = moves(t.drops);
      if (!adds.length && !drops.length) continue; // nothing to show (e.g. pick-only trades)
      const parties = uniq([
        ...(t.roster_ids || []).map((rid) => rosterHandle[rid]),
        ...adds.map((a) => a.handle),
        ...drops.map((d) => d.handle),
      ]);
      rows.push({
        created: t.created || 0,
        week,
        type: t.type || 'move',
        bid: t.type === 'waiver' && t.settings?.waiver_bid != null ? t.settings.waiver_bid : null,
        parties,
        adds,
        drops,
      });
    }
  });
  rows.sort((a, b) => b.created - a.created || b.week - a.week);
  return rows.slice(0, limit);
}
