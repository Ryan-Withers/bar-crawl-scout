// TanStack Query setup: one client, typed query-option factories with per-endpoint
// stale times (blueprint 2.3). Components call createQuery(leagueQuery()) etc.
import { QueryClient } from '@tanstack/svelte-query';
import * as S from './sleeper';
import { loadPlayers } from './players';

const MIN = 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * MIN, refetchOnWindowFocus: true, retry: 2, gcTime: 60 * MIN },
  },
});

export const qk = {
  league: ['league'] as const,
  users: ['users'] as const,
  rosters: ['rosters'] as const,
  state: ['state'] as const,
  players: ['players'] as const,
  founding: ['founding'] as const,
  matchups: (w: number) => ['matchups', w] as const,
  transactions: (w: number) => ['transactions', w] as const,
  trendingAdds: ['trending', 'add'] as const,
};

export const leagueQuery = () => ({ queryKey: qk.league, queryFn: () => S.getLeague() });
export const usersQuery = () => ({ queryKey: qk.users, queryFn: () => S.getUsers() });
export const rostersQuery = () => ({ queryKey: qk.rosters, queryFn: () => S.getRosters(), staleTime: 5 * MIN });
export const stateQuery = () => ({ queryKey: qk.state, queryFn: () => S.getState(), staleTime: 30 * MIN });
export const playersQuery = () => ({ queryKey: qk.players, queryFn: loadPlayers, staleTime: 24 * 60 * MIN });
export const foundingQuery = () => ({ queryKey: qk.founding, queryFn: () => S.getFoundingSeason(), staleTime: Infinity, gcTime: Infinity });
export const matchupsQuery = (week: number) => ({ queryKey: qk.matchups(week), queryFn: () => S.getMatchups(week), staleTime: 30_000 });
export const transactionsQuery = (week: number) => ({ queryKey: qk.transactions(week), queryFn: () => S.getTransactions(week), staleTime: 2 * MIN });
export const weekProjectionsQuery = (season: string, week: number) => ({ queryKey: ['proj', season, week] as const, queryFn: () => S.getWeekProjections(season, week), staleTime: 30 * MIN });
export const trendingAddsQuery = () => ({ queryKey: qk.trendingAdds, queryFn: () => S.getTrendingAdds(25), staleTime: 30 * MIN });

// Every completed week's matchups in one cached shot (dossier form/records).
// Best-effort per week: a missing week never sinks the season.
export const seasonMatchupsQuery = () => ({
  queryKey: ['seasonMatchups'] as const,
  staleTime: 30 * MIN,
  queryFn: () => Promise.all(
    Array.from({ length: 17 }, (_, i) => S.getMatchups(i + 1).catch(() => [] as Awaited<ReturnType<typeof S.getMatchups>>)),
  ),
});

// Every week's transactions in one cached shot (the league Ticker).
// Best-effort per week: a missing week never sinks the feed.
export const seasonTransactionsQuery = () => ({
  queryKey: ['seasonTransactions'] as const,
  staleTime: 5 * MIN,
  queryFn: () => Promise.all(
    Array.from({ length: 17 }, (_, i) => S.getTransactions(i + 1).catch(() => [] as Awaited<ReturnType<typeof S.getTransactions>>)),
  ),
});

// The league's current draft + its traded picks, in one shot (for the War Room's
// real slot board). Null when there's no draft with an assigned order yet.
export const realDraftQuery = () => ({
  queryKey: ['realdraft'] as const,
  staleTime: 30 * MIN,
  queryFn: async () => {
    const drafts = await S.getLeagueDrafts();
    const draft = (Array.isArray(drafts) ? drafts : []).find((d) => d && d.draft_order) || null;
    if (!draft) return null;
    const traded = await S.getTradedPicks(draft.draft_id).catch(() => []);
    return { draft, traded };
  },
});
