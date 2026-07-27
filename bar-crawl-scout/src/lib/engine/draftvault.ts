// THE DRAFT VAULT — what happened at every past draft, and what became of it.
//
// Sleeper keeps every completed draft's picks forever, and each pick carries
// the player's name in its metadata, so the whole vault renders without the
// 5MB player blob. The interesting layer isn't the board though — it's the
// FATE of each pick: cross the old picks against today's rosters and you get
// the only draft stat a keeper league actually argues about, which is who
// still owns what they took.
//
// Pure. No fetching, no Svelte, no dates.

export interface VaultPick {
  round: number;
  overall: number; // pick_no, 1-based across the whole draft
  slot: number; // draft_slot, 1..teams
  rosterId: number;
  playerId: string;
  name: string;
  pos: string;
  team: string;
  isKeeper: boolean;
}

export type Fate = 'kept' | 'poached' | 'gone';

export interface FatedPick extends VaultPick {
  fate: Fate;
  heldBy: number | null; // roster_id that owns him now, null if nobody does
}

interface RawPick {
  round?: number;
  pick_no?: number;
  draft_slot?: number;
  roster_id?: number | null;
  player_id?: string;
  is_keeper?: boolean | null;
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  } | null;
}

/** Sleeper's pick shape -> ours. Skips anything with no player attached. */
export function toVaultPicks(raw: RawPick[]): VaultPick[] {
  const out: VaultPick[] = [];
  for (const p of raw || []) {
    if (!p || !p.player_id) continue;
    const m = p.metadata || {};
    const name = [m.first_name, m.last_name].filter(Boolean).join(' ').trim();
    out.push({
      round: p.round || 0,
      overall: p.pick_no || 0,
      slot: p.draft_slot || 0,
      rosterId: p.roster_id != null ? p.roster_id : 0,
      playerId: String(p.player_id),
      name: name || String(p.player_id),
      pos: (m.position || '').toUpperCase(),
      team: (m.team || '').toUpperCase(),
      isKeeper: !!p.is_keeper,
    });
  }
  return out.sort((a, b) => a.overall - b.overall);
}

/** player_id -> the roster that holds him TODAY, from the live rosters blob. */
export function ownerNowMap(
  rosters: Array<{ roster_id: number; players?: string[] | null }>,
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rosters || []) {
    for (const pid of r.players || []) m[String(pid)] = r.roster_id;
  }
  return m;
}

/**
 * Stamp each pick with what became of the player.
 *   kept    — the manager who drafted him still has him
 *   poached — someone else in the league has him
 *   gone    — nobody in the league rosters him any more
 */
export function fatePicks(picks: VaultPick[], ownerNow: Record<string, number>): FatedPick[] {
  return picks.map((p) => {
    const held = ownerNow[p.playerId];
    const heldBy = held == null ? null : held;
    const fate: Fate = heldBy == null ? 'gone' : heldBy === p.rosterId ? 'kept' : 'poached';
    return { ...p, fate, heldBy };
  });
}

export interface VaultRow {
  rosterId: number;
  handle: string;
  picks: number;
  kept: number;
  poached: number;
  gone: number;
  keepRate: number; // 0-100, rounded
  best: FatedPick | null; // earliest-round pick they still hold
}

/**
 * One row per manager, best hold rate first. `best` is the pick they still own
 * that cost them the most — the thing they'd point at in the group chat.
 */
export function vaultRows(
  picks: FatedPick[],
  rosterHandle: Record<number, string>,
): VaultRow[] {
  const by: Record<number, FatedPick[]> = {};
  for (const p of picks) (by[p.rosterId] = by[p.rosterId] || []).push(p);

  const rows: VaultRow[] = Object.keys(by).map((k) => {
    const rid = Number(k);
    const mine = by[rid];
    const kept = mine.filter((p) => p.fate === 'kept');
    const poached = mine.filter((p) => p.fate === 'poached').length;
    const gone = mine.filter((p) => p.fate === 'gone').length;
    // Earliest overall pick still held — ties broken by pick order, which is
    // already how `mine` is sorted.
    const best = kept.length ? kept.reduce((a, b) => (b.overall < a.overall ? b : a)) : null;
    return {
      rosterId: rid,
      handle: rosterHandle[rid] || `roster ${rid}`,
      picks: mine.length,
      kept: kept.length,
      poached,
      gone,
      keepRate: mine.length ? Math.round((kept.length / mine.length) * 100) : 0,
      best,
    };
  });

  return rows.sort((a, b) => b.keepRate - a.keepRate || b.kept - a.kept || a.handle.localeCompare(b.handle));
}

export interface PoachLine {
  pick: FatedPick;
  from: string; // handle that drafted him
  to: string; // handle that holds him now
}

/**
 * Every player who changed hands since the draft, earliest pick first.
 * Two handle maps because the drafter is read off the season the draft
 * happened in, while the holder is read off today's rosters — pass the same
 * map twice when the league carried its roster ids over unchanged.
 */
export function poachLines(
  picks: FatedPick[],
  drafterHandle: Record<number, string>,
  holderHandle: Record<number, string> = drafterHandle,
  limit = 12,
): PoachLine[] {
  return picks
    .filter((p) => p.fate === 'poached' && p.heldBy != null)
    .sort((a, b) => a.overall - b.overall)
    .slice(0, limit)
    .map((p) => ({
      pick: p,
      from: drafterHandle[p.rosterId] || `roster ${p.rosterId}`,
      to: holderHandle[p.heldBy as number] || `roster ${p.heldBy}`,
    }));
}

/**
 * The board as a real draft board: one row per round, one cell per slot.
 * Missing cells stay null so a part-finished draft still renders square.
 */
export function vaultGrid(picks: VaultPick[], teams: number): Array<Array<VaultPick | null>> {
  if (teams < 1) return [];
  const rounds = picks.reduce((max, p) => Math.max(max, p.round), 0);
  const grid: Array<Array<VaultPick | null>> = [];
  for (let r = 0; r < rounds; r++) grid.push(new Array(teams).fill(null));
  for (const p of picks) {
    const r = p.round - 1;
    const c = p.slot - 1;
    if (r >= 0 && r < rounds && c >= 0 && c < teams) grid[r][c] = p;
  }
  return grid;
}

/** Round 1 in draft order — the slot list, so the board can label its columns. */
export function slotOrder(picks: VaultPick[], teams: number): Array<number | null> {
  const out: Array<number | null> = new Array(Math.max(0, teams)).fill(null);
  for (const p of picks) {
    if (p.round !== 1) continue;
    const c = p.slot - 1;
    if (c >= 0 && c < out.length && out[c] == null) out[c] = p.rosterId;
  }
  return out;
}

/** The one sentence worth putting at the top of the page. */
export function vaultHeadline(rows: VaultRow[], season: string): string {
  if (!rows.length) return 'No completed draft to look back on yet.';
  const picks = rows.reduce((n, r) => n + r.picks, 0);
  const kept = rows.reduce((n, r) => n + r.kept, 0);
  const pct = picks ? Math.round((kept / picks) * 100) : 0;
  const top = rows[0];
  return `${kept} of the ${picks} players taken in the ${season} draft are still with the manager who drafted them (${pct}%). ${top.handle} has held the most: ${top.kept} of ${top.picks}.`;
}
