// Typed Sleeper client. Public, keyless, CORS-open — call it directly from the client.
import type {
  SleeperUser, SleeperRoster, SleeperLeague, NflState,
  SleeperMatchup, SleeperTransaction, SleeperPlayer, TrendingPlayer,
} from './types';

// Single source of truth for the league.
export const LEAGUE_ID = '1311995695032467456';
const BASE = 'https://api.sleeper.app/v1';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`Sleeper ${path} -> ${r.status}`);
  return (await r.json()) as T;
}

export const getLeague = (id: string = LEAGUE_ID) => get<SleeperLeague>(`/league/${id}`);
export const getUsers = (id: string = LEAGUE_ID) => get<SleeperUser[]>(`/league/${id}/users`);
export const getRosters = (id: string = LEAGUE_ID) => get<SleeperRoster[]>(`/league/${id}/rosters`);
export const getState = () => get<NflState>(`/state/nfl`);
export const getMatchups = (week: number, id: string = LEAGUE_ID) =>
  get<SleeperMatchup[]>(`/league/${id}/matchups/${week}`);
export const getTransactions = (week: number, id: string = LEAGUE_ID) =>
  get<SleeperTransaction[]>(`/league/${id}/transactions/${week}`);
export const getTrendingAdds = (limit = 25) =>
  get<TrendingPlayer[]>(`/players/nfl/trending/add?limit=${limit}`);
export const getTrendingDrops = (limit = 25) =>
  get<TrendingPlayer[]>(`/players/nfl/trending/drop?limit=${limit}`);
export const getRawPlayers = () => get<Record<string, SleeperPlayer>>(`/players/nfl`);

// Drafts: a league's drafts, then that draft's picks (for the custody chain).
// The list entries carry the full draft object incl. draft_order (user_id -> slot).
export const getLeagueDrafts = (id: string = LEAGUE_ID) =>
  get<Array<{ draft_id: string; season: string; type?: string; status?: string; draft_order?: Record<string, number> | null }>>(`/league/${id}/drafts`);
export const getDraftPicks = (draftId: string) =>
  get<Array<Record<string, unknown>>>(`/draft/${draftId}/picks`);
// Traded picks: who ACTUALLY owns each (round, original-roster) pick.
export const getTradedPicks = (draftId: string) =>
  get<Array<{ season: string; round: number; roster_id: number; owner_id: number; previous_owner_id: number | null }>>(`/draft/${draftId}/traded_picks`);

// Playoff bracket — the final match's winner is that season's champion.
export const getWinnersBracket = (id: string = LEAGUE_ID) =>
  get<Array<{ r: number; m: number; w?: number | null; l?: number | null; t1?: number | null; t2?: number | null }>>(`/league/${id}/winners_bracket`);

// Walk previous_league_id -> [{season, league_id}] newest-first, so we can pull
// draft/txn/matchup history across every season the dynasty has existed.
export async function getLeagueChain(id: string = LEAGUE_ID): Promise<Array<{ season: string; league_id: string }>> {
  const out: Array<{ season: string; league_id: string }> = [];
  let cur: SleeperLeague | null = await getLeague(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.league_id)) {
    seen.add(cur.league_id);
    out.push({ season: cur.season, league_id: cur.league_id });
    if (!cur.previous_league_id) break;
    try { cur = await getLeague(cur.previous_league_id); } catch { break; }
  }
  return out;
}

// Stats + projections (undocumented but stable). Shape: { player_id: { stat_key: value } }.
export const getWeekStats = (season: string, week: number) =>
  get<Record<string, Record<string, number>>>(`/stats/nfl/regular/${season}/${week}`);
export const getSeasonStats = (season: string) =>
  get<Record<string, Record<string, number>>>(`/stats/nfl/regular/${season}`);
export const getWeekProjections = (season: string, week: number) =>
  get<Record<string, Record<string, number>>>(`/projections/nfl/regular/${season}/${week}`);
// SEASON-level projections — whole-season stat lines rather than one week. This
// is the set that carries IDP, which the weekly endpoint does not, and it's what
// the draft sheet re-scores under the league's own rulebook.
export const getSeasonProjections = (season: string) =>
  get<Record<string, Record<string, number>>>(`/projections/nfl/regular/${season}`);
// Sleeper-wide ownership: { player_id: { owned, started } }.
export const getResearch = (season: string, week: number) =>
  get<Record<string, { owned: number; started: number }>>(`/players/nfl/research/regular/${season}/${week}`);

// CDN helpers.
export const avatarUrl = (id: string | null | undefined, thumb = true) =>
  id ? `https://sleepercdn.com/avatars/${thumb ? 'thumbs/' : ''}${id}` : '';
export const headshotUrl = (playerId: string) =>
  `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
export const teamLogoUrl = (team: string) =>
  `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;

// Walk previous_league_id back to the founding season (powers "EST. [year]" + /history).
export async function getFoundingSeason(id: string = LEAGUE_ID): Promise<string> {
  let cur: SleeperLeague | null = await getLeague(id);
  let earliest = cur?.season ?? '';
  const seen = new Set<string>();
  while (cur && cur.previous_league_id && !seen.has(cur.previous_league_id)) {
    seen.add(cur.previous_league_id);
    try {
      cur = await getLeague(cur.previous_league_id);
      if (cur?.season) earliest = cur.season;
    } catch {
      break;
    }
  }
  return earliest;
}
