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

// THE DRAFT VAULT — every completed draft this dynasty has ever held, plus the
// roster->handle map for the season it happened in (roster ids are stable when
// a league carries over, but we don't bet the page on it). Newest first.
// Cached hard: a finished draft never changes.
export const draftVaultQuery = () => ({
  queryKey: ['draftvault'] as const,
  staleTime: 6 * 60 * MIN,
  queryFn: async () => {
    const chain = await S.getLeagueChain();
    const seasons = await Promise.all(chain.map(async (c) => {
      const [drafts, users, rosters] = await Promise.all([
        S.getLeagueDrafts(c.league_id).catch(() => []),
        S.getUsers(c.league_id).catch(() => []),
        S.getRosters(c.league_id).catch(() => []),
      ]);
      const done = (Array.isArray(drafts) ? drafts : []).filter((d) => d && d.status === 'complete');
      if (!done.length) return null;
      // A season can technically hold more than one draft; the one with picks wins.
      const picksPerDraft = await Promise.all(
        done.map((d) => S.getDraftPicks(d.draft_id).catch(() => [])),
      );
      let best = 0;
      picksPerDraft.forEach((p, i) => { if ((p || []).length > (picksPerDraft[best] || []).length) best = i; });
      const picks = picksPerDraft[best] || [];
      if (!picks.length) return null;
      return { season: c.season, draftId: done[best].draft_id, picks, users, rosters };
    }));
    return seasons.filter(Boolean) as Array<{
      season: string; draftId: string;
      picks: Array<Record<string, unknown>>;
      users: Awaited<ReturnType<typeof S.getUsers>>;
      rosters: Awaited<ReturnType<typeof S.getRosters>>;
    }>;
  },
});
