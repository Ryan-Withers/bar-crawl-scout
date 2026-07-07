// HISTORY RESOLVER — turn raw Sleeper shapes into what the engines eat.
// chainOfCustody() wants SeasonData[]; vsLeague() wants VsLine[]. Both need
// roster_id -> handle, which we build from rosters + the user->handle map.
// Pure + fixture-tested; the live queries pass the raw blobs straight through.
import type { SeasonData, DraftPick, Transaction, ChainEvent } from '../lib/engine/chain';
import type { VsLine, VsRow } from '../lib/engine/vsleague';
import { chainOfCustody } from '../lib/engine/chain';
import { vsLeague } from '../lib/engine/vsleague';
import { buildGameLog, logTotals, bestWeek } from '../lib/engine/gamelog';
import type { GameRow, WeekStats } from '../lib/engine/gamelog';
import { scoreStats } from '../lib/engine/scoring';
import { projSummary } from '../lib/engine/projection';
import type { ProjSummary, ProjRow } from '../lib/engine/projection';
import { buildUsage } from '../lib/engine/usage';
import type { UsageSummary, UsageInput } from '../lib/engine/usage';
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

export interface CareerRow {
  season: string;
  games: number;
  points: number;
  ppg: number | null;
}

export interface PlayerHistory {
  chain: ChainEvent[];
  vs: VsRow[];
  gameLog: GameRow[];
  totals: { games: number; points: number; ppg: number | null };
  best: number | null;
  career: CareerRow[];
  proj: ProjSummary;
  usage: UsageSummary;
}

type WeekBlob = Record<string, Record<string, number>>;
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

// Per-week usage inputs: his own targets/carries/snaps + team denominators
// summed from the same weekly blob (every teammate's pass_att / rush_att).
export function usageInputs(
  pid: string,
  weeks: number[],
  weekBlobs: WeekBlob[],
  byId: Record<string, PlayerLite>,
): UsageInput[] {
  const team = byId[pid]?.[2] || '';
  if (!team || team === 'FA') return [];
  return weeks.map((week, i) => {
    const blob = weekBlobs[i] || {};
    const mine = blob[pid] || {};
    let teamPassAtt = 0;
    let teamRushAtt = 0;
    for (const id in blob) {
      if (byId[id]?.[2] !== team) continue;
      teamPassAtt += blob[id].pass_att || 0;
      teamRushAtt += blob[id].rush_att || 0;
    }
    const teamPlays = teamPassAtt + teamRushAtt;
    return {
      week,
      recTgt: num(mine.rec_tgt),
      rushAtt: num(mine.rush_att),
      offSnp: num(mine.off_snp),
      tmOffSnp: num(mine.tm_off_snp),
      teamPassAtt: teamPassAtt || null,
      teamPlays: teamPlays || null,
    };
  });
}

// Zip the (already league-scored) game log against weekly projections.
async function buildLiveProjection(
  pid: string,
  season: string,
  gameLog: GameRow[],
  scoring: Record<string, number>,
): Promise<ProjSummary> {
  if (!season || !gameLog.length) return { weeks: [], beatRate: null, avgDelta: null };
  const projByWeek = await Promise.all(
    gameLog.map((g) => settle(S.getWeekProjections(season, g.week), {} as Record<string, Record<string, number>>)),
  );
  const rows: ProjRow[] = gameLog.map((g, i) => {
    const ps = projByWeek[i][pid];
    return { week: g.week, proj: ps ? scoreStats(ps, scoring) : 0, actual: g.pts, dnp: g.dnp };
  });
  return projSummary(rows);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// Season-by-season league-scored totals across the dynasty's whole life.
async function buildLiveCareer(
  pid: string,
  seasons: string[],
  scoring: Record<string, number>,
): Promise<CareerRow[]> {
  const blobs = await Promise.all(seasons.map((s) => settle(S.getSeasonStats(s), {} as Record<string, Record<string, number>>)));
  const rows: CareerRow[] = [];
  seasons.forEach((season, i) => {
    const st = blobs[i][pid];
    if (!st) return;
    const games = Math.round(st.gp ?? st.gms_active ?? 0);
    const points = scoreStats(st, scoring);
    rows.push({ season, games, points: r1(points), ppg: games ? r1(points / games) : null });
  });
  return rows.sort((a, b) => Number(a.season) - Number(b.season));
}

// This season's per-week receipt from pre-fetched weekly blobs.
function gameLogFromBlobs(
  pid: string,
  position: string,
  weeks: number[],
  weekBlobs: WeekBlob[],
  scoring: Record<string, number>,
): GameRow[] {
  const ws: WeekStats[] = weeks.map((w, i) => ({ week: w, opp: '', stats: (weekBlobs[i] || {})[pid] || null }));
  return buildGameLog(ws, scoring, position);
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
  const emptyProj: ProjSummary = { weeks: [], beatRate: null, avgDelta: null };
  const emptyUsage: UsageSummary = { weeks: [], avgTgtShare: null, avgTouch: null, avgSnap: null, snapTrend: null };
  const empty: PlayerHistory = { chain: [], vs: [], gameLog: [], totals: { games: 0, points: 0, ppg: null }, best: null, career: [], proj: emptyProj, usage: emptyUsage };
  const pid = resolvePlayerId(name, byId);
  if (!pid) return empty;
  const position = byId[pid][1] || '';

  const [league, state] = await Promise.all([
    settle(S.getLeague(), null),
    settle(S.getState(), null),
  ]);
  const scoring = (league && (league as { scoring_settings?: Record<string, number> }).scoring_settings) || {};
  const st = state as { season?: string; week?: number; display_week?: number } | null;
  const curSeason = st?.season || (league as { season?: string } | null)?.season || '';
  const throughWeek = Math.max(0, (st?.week ?? st?.display_week ?? 0));

  // Fetch each current-season weekly blob ONCE; game log + usage both read it.
  const curWeeks = curSeason && throughWeek >= 1 ? Array.from({ length: throughWeek }, (_, i) => i + 1) : [];
  const weekBlobsP = Promise.all(curWeeks.map((w) => settle(S.getWeekStats(curSeason, w), {} as WeekBlob)));

  const chainSeasons = await settle(S.getLeagueChain(), [] as Array<{ season: string; league_id: string }>);
  const careerP = buildLiveCareer(pid, chainSeasons.map((c) => c.season), scoring);
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

  const [weekBlobs, career] = await Promise.all([weekBlobsP, careerP]);
  const gameLog = gameLogFromBlobs(pid, position, curWeeks, weekBlobs, scoring);
  const usage = buildUsage(usageInputs(pid, curWeeks, weekBlobs, byId));
  const proj = await buildLiveProjection(pid, curSeason, gameLog, scoring);
  // Chain/gamelog/career/proj/usage key off the Sleeper player_id resolved above.
  return {
    chain: chainOfCustody(pid, seasonData),
    vs: vsLeague(vsLines),
    gameLog,
    totals: logTotals(gameLog),
    best: bestWeek(gameLog),
    career,
    proj,
    usage,
  };
}
