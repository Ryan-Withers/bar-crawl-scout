// TanStack Query setup: one client, typed query-option factories with per-endpoint
// stale times (blueprint 2.3). Components call createQuery(leagueQuery()) etc.
import { QueryClient } from '@tanstack/svelte-query';
import * as S from './sleeper';
import { loadPlayers } from './players';

const MIN = 60_000;

// HOW LIVE IS LIVE.
//
// These were set for an idle off-season, and they showed: the draft board, the
// keepers and the traded picks all sat behind a THIRTY MINUTE stale time, so a
// trade agreed in the group chat took half an hour to reach the app even if you
// reloaded the page. It is draft week; that is the wrong trade to make.
//
// So the draft-critical endpoints now poll while you are actually looking at
// them. `refetchIntervalInBackground` is left off, which is the default, so a
// tab sitting behind another window costs nothing — the poll resumes the moment
// it comes forward, alongside the refetch-on-focus that was already there.
const LIVE = 30_000;        // the draft board, the keepers, the picks
const NEARLY = 60_000;      // rosters, transactions — the things a trade moves

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: NEARLY, refetchOnWindowFocus: true, retry: 2, gcTime: 60 * MIN },
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

export const leagueQuery = (leagueId: string = S.LEAGUE_ID) => ({ queryKey: [...qk.league, leagueId] as const, queryFn: () => S.getLeague(leagueId), staleTime: 5 * MIN });
export const usersQuery = (leagueId: string = S.LEAGUE_ID) => ({ queryKey: [...qk.users, leagueId] as const, queryFn: () => S.getUsers(leagueId), staleTime: 5 * MIN });
// The keepers live here, so this is the one a mid-week declaration moves.
export const rostersQuery = (leagueId: string = S.LEAGUE_ID) => ({ queryKey: [...qk.rosters, leagueId] as const, queryFn: () => S.getRosters(leagueId), staleTime: NEARLY, refetchInterval: NEARLY });
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
  // Trades in principle come down this feed, and the draft is a week away.
  staleTime: NEARLY,
  refetchInterval: NEARLY,
  queryFn: () => Promise.all(
    Array.from({ length: 17 }, (_, i) => S.getTransactions(i + 1).catch(() => [] as Awaited<ReturnType<typeof S.getTransactions>>)),
  ),
});

// The league's current draft, its traded picks AND its picks-so-far, in one shot
// (for the War Room's real slot board and the keeper board). Null when there's
// no draft with an assigned order yet.
//
// The picks are what carry the KEEPERS: once the commissioner assigns them they
// appear here with is_keeper set, sitting in the last picks each manager still
// owns. Before that the endpoint returns [] and the keeper board derives the
// placement instead — so an empty array is a normal state, not a failure.
export const realDraftQuery = (leagueId: string = S.LEAGUE_ID) => ({
  queryKey: ['realdraft', leagueId] as const,
  // Thirty minutes was the single worst offender: the draft order, the traded
  // picks AND the keeper placement all sat behind it.
  staleTime: LIVE,
  refetchInterval: LIVE,
  queryFn: async () => {
    // The league object names its own draft. Take that one rather than the first
    // with an order: this league's settings carry draft_rounds 3 as well as the
    // draft's own rounds 15, which is Sleeper's marker for a second, rookie
    // draft — and `.find` would take whichever came back first.
    const [drafts, league] = await Promise.all([
      S.getLeagueDrafts(leagueId),
      S.getLeague(leagueId).catch(() => null as Awaited<ReturnType<typeof S.getLeague>> | null),
    ]);
    const list = Array.isArray(drafts) ? drafts : [];
    const named = league && (league as { draft_id?: string }).draft_id;
    const draft = (named && list.find((d) => d && d.draft_id === named && d.draft_order))
      || list.find((d) => d && d.draft_order && (!league || d.season === league.season))
      || list.find((d) => d && d.draft_order)
      || null;
    if (!draft) return null;
    // League-scoped traded picks, not draft-scoped: the futures (2027) only
    // exist on the league endpoint, and the fixtures this is tested against come
    // from there. Fall back to the draft's own set if the league call fails.
    const [traded, picks] = await Promise.all([
      S.getLeagueTradedPicks(leagueId).catch(() => S.getTradedPicks(draft.draft_id).catch(() => [])),
      S.getDraftPicks(draft.draft_id).catch(() => []),
    ]);
    return { draft, traded, picks };
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

// THE DRAFT SHEET — everything it needs, in one refreshable shot. Season
// projections carry the IDP lines the weekly endpoint doesn't; prior-season
// stats backfill what Sleeper leaves out; the league object supplies the
// scoring rules and the real lineup, never transcribed.
// staleTime 0 on purpose: the Refresh button must actually re-pull.
export const draftSheetQuery = (leagueId: string = S.LEAGUE_ID) => ({
  // THE LEAGUE IS PART OF THE KEY, and it has to be. Two boards can be open in
  // one app; a bare ['draftsheet'] key would serve whichever league mounted
  // first to both of them, and the second board would quietly show the first
  // league's players, prices and picks under its own heading.
  queryKey: ['draftsheet', leagueId] as const,
  staleTime: 0,
  gcTime: 10 * MIN,
  // Refresh is the only thing that moves this board. A silent refetch on window
  // focus would reorder the sheet under your finger in the middle of a draft.
  refetchOnWindowFocus: false,
  queryFn: async () => {
    const state = await S.getState().catch(() => null);
    const season = (state && state.season) || String(new Date().getFullYear());
    const prior = String(Number(season) - 1);
    const [league, proj, priorStats, rosters, users, drafts] = await Promise.all([
      S.getLeague(leagueId),
      S.getSeasonProjections(season),
      S.getSeasonStats(prior).catch(() => ({} as Record<string, Record<string, number>>)),
      S.getRosters(leagueId).catch(() => []),
      S.getUsers(leagueId).catch(() => []),
      S.getLeagueDrafts(leagueId).catch(() => []),
    ]);
    // THE LIVE BOARD. On draft night the picks endpoint fills up as they happen,
    // so pulling it here is what turns this page from a pre-draft ranking into
    // the sheet you actually run the draft off: refresh, and everyone taken is
    // struck off with the pick they went at.
    //
    // Before the draft it comes back holding only the keepers, or empty, and
    // costs one request. Failure is not fatal — the board is still the board.
    const named = (league as { draft_id?: string } | null)?.draft_id;
    const list = Array.isArray(drafts) ? drafts : [];
    const draft = (named && list.find((d) => d && d.draft_id === named))
      || list.find((d) => d && d.season === season)
      || list[0] || null;
    const picks = draft ? await S.getDraftPicks(draft.draft_id).catch(() => []) : [];
    return { season, prior, league, proj, priorStats, rosters, users, draft, picks, pulledAt: Date.now() };
  },
});
