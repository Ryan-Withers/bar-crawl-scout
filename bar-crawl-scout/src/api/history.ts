// HISTORY RESOLVER — turn raw Sleeper shapes into what the engines eat.
// chainOfCustody() wants SeasonData[]; vsLeague() wants VsLine[]. Both need
// roster_id -> handle, which we build from rosters + the user->handle map.
// Pure + fixture-tested; the live queries pass the raw blobs straight through.
import type { SeasonData, DraftPick, Transaction } from '../lib/engine/chain';
import type { VsLine } from '../lib/engine/vsleague';

interface RosterLite { roster_id: number; owner_id: string }

// roster_id -> our manager handle, via owner_id -> handle.
export function rosterHandleMap(
  rosters: RosterLite[],
  userHandle: Record<string, string>,
): Record<number, string> {
  const m: Record<number, string> = {};
  for (const r of rosters) {
    const h = userHandle[r.owner_id];
    if (h) m[r.roster_id] = h;
  }
  return m;
}

interface RawPick { player_id: string; round: number; pick_no?: number; draft_slot?: number; roster_id?: number; picked_by?: string; is_keeper?: boolean | null }
interface RawTxn { type: string; status?: string; leg?: number; created?: number; settings?: { waiver_bid?: number } | null; adds?: Record<string, number> | null; drops?: Record<string, number> | null; roster_ids?: number[] }

// One season's raw draft + transaction blobs -> a SeasonData the chain can walk.
export function buildSeasonData(
  season: string,
  rosterHandle: Record<number, string>,
  rawPicks: RawPick[],
  rawTxns: RawTxn[],
): SeasonData {
  const picks: DraftPick[] = (rawPicks || []).map((p) => ({
    player_id: p.player_id,
    round: p.round,
    pick: p.pick_no != null ? p.pick_no : (p.draft_slot || 0), // pick-within-round; fall back to slot
    roster_id: p.roster_id != null ? p.roster_id : 0,
    is_keeper: !!p.is_keeper,
  }));
  const txns: Transaction[] = (rawTxns || [])
    .filter((t) => !t.status || t.status === 'complete')
    .map((t) => ({
      week: t.leg || 0,
      created: t.created || 0,
      type: t.type,
      settings: t.settings || null,
      adds: t.adds || null,
      drops: t.drops || null,
      roster_ids: t.roster_ids || [],
    }));
  return { season, rosterHandle, picks, txns };
}

interface RawMatchup { roster_id: number; matchup_id: number | null; points?: number; players_points?: Record<string, number> | null; players?: string[] | null }

// A player's per-week points bucketed by the manager he faced that week.
// weeks: array (index = week) of that week's matchup rows.
export function vsLinesForPlayer(
  playerId: string,
  weeks: RawMatchup[][],
  rosterHandle: Record<number, string>,
): VsLine[] {
  const lines: VsLine[] = [];
  for (const rows of weeks || []) {
    if (!rows) continue;
    // which roster had the player this week?
    const mine = rows.find((r) => (r.players || []).indexOf(playerId) >= 0);
    if (!mine || mine.matchup_id == null) continue;
    const opp = rows.find((r) => r.matchup_id === mine.matchup_id && r.roster_id !== mine.roster_id);
    if (!opp) continue;
    const handle = rosterHandle[opp.roster_id];
    if (!handle) continue;
    const pts = mine.players_points ? mine.players_points[playerId] : undefined;
    if (pts == null) continue;
    lines.push({ opponent: handle, points: pts });
  }
  return lines;
}
