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
