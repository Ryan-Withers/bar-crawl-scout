// HISTORY RESOLVER — turn raw Sleeper shapes into what the engines eat.
// chainOfCustody() wants SeasonData[]; vsLeague() wants VsLine[]. Both need
// roster_id -> handle, which we build from rosters + the user->handle map.
// Pure + fixture-tested; the live queries pass the raw blobs straight through.
import type { SeasonData, DraftPick, Transaction, ChainEvent } from '../lib/engine/chain';
import type { VsLine, VsRow } from '../lib/engine/vsleague';
import { chainOfCustody } from '../lib/engine/chain';
import { vsLeague } from '../lib/engine/vsleague';
import * as S from './sleeper';
import { userHandleMap } from './league';
import type { PlayerLite } from './types';

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

// Our board is name-based; Sleeper is id-based. Resolve a name -> player_id.
export function resolvePlayerId(name: string, byId: Record<string, PlayerLite>): string | null {
  const want = name.toLowerCase();
  for (const id in byId) if ((byId[id][0] || '').toLowerCase() === want) return id;
  return null;
}

export interface PlayerHistory {
  chain: ChainEvent[];
  vs: VsRow[];
}

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const settle = <T>(p: Promise<T>, fallback: T): Promise<T> => p.then((x) => x, () => fallback);

// Orchestrate every season's drafts/txns/matchups into the custody chain + the
// vs-league table for one player. Browser-only (many live calls); each request
// is best-effort so a missing week or season never sinks the whole file.
export async function assemblePlayerHistory(
  name: string,
  byId: Record<string, PlayerLite>,
): Promise<PlayerHistory> {
  const pid = resolvePlayerId(name, byId);
  if (!pid) return { chain: [], vs: [] };

  const chainSeasons = await settle(S.getLeagueChain(), [] as Array<{ season: string; league_id: string }>);
  const seasonData: SeasonData[] = [];
  const vsLines: VsLine[] = [];

  for (const { season, league_id } of chainSeasons) {
    const [users, rosters, drafts] = await Promise.all([
      settle(S.getUsers(league_id), []),
      settle(S.getRosters(league_id), []),
      settle(S.getLeagueDrafts(league_id), [] as Array<{ draft_id: string; season: string }>),
    ]);
    const rh = rosterHandleMap(rosters as { roster_id: number; owner_id: string }[], userHandleMap(users));

    const pickLists = await Promise.all(drafts.map((d) => settle(S.getDraftPicks(d.draft_id), [])));
    const rawPicks = pickLists.flat() as unknown as Parameters<typeof buildSeasonData>[2];

    const txnWeeks = await Promise.all(WEEKS.map((w) => settle(S.getTransactions(w, league_id), [])));
    const rawTxns = txnWeeks.flat() as unknown as Parameters<typeof buildSeasonData>[3];

    seasonData.push(buildSeasonData(season, rh, rawPicks, rawTxns));

    const matchWeeks = await Promise.all(WEEKS.map((w) => settle(S.getMatchups(w, league_id), [])));
    vsLines.push(...vsLinesForPlayer(pid, matchWeeks as Parameters<typeof vsLinesForPlayer>[1], rh));
  }

  // Chain uses OUR player_id key; resolve draft/txn player_ids are Sleeper's -> use pid.
  return { chain: chainOfCustody(pid, seasonData), vs: vsLeague(vsLines) };
}
