// THE WALL resolver — for each season the dynasty has existed, pull the champion
// (from the playoff bracket) plus that season's points leader and best record.
// Browser-only (many live calls); each request is best-effort. Pure-ish glue over
// the tested championFromBracket engine.
import * as S from './sleeper';
import { userHandleMap } from './league';
import { rosterHandleMap } from './history';
import { championFromBracket } from '../lib/engine/wall';

const settle = <T>(p: Promise<T>, fallback: T): Promise<T> => p.then((x) => x, () => fallback);
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface SeasonBanner {
  season: string;
  current: boolean;
  champion: string | null;
  runnerUp: string | null;
  pointsLeader: { handle: string; pf: number } | null;
  bestRecord: { handle: string; wins: number; losses: number } | null;
}

interface RosterLite {
  roster_id: number;
  owner_id: string;
  settings?: { wins?: number; losses?: number; fpts?: number; fpts_decimal?: number };
}

export async function assembleWall(): Promise<SeasonBanner[]> {
  const chain = await settle(S.getLeagueChain(), [] as Array<{ season: string; league_id: string }>);
  if (!chain.length) return [];
  const currentSeason = chain[0].season;

  const banners = await Promise.all(chain.map(async ({ season, league_id }) => {
    const [users, rosters, bracket] = await Promise.all([
      settle(S.getUsers(league_id), []),
      settle(S.getRosters(league_id), [] as RosterLite[]),
      settle(S.getWinnersBracket(league_id), []),
    ]);
    const rh = rosterHandleMap(rosters as { roster_id: number; owner_id: string }[], userHandleMap(users));
    const { champion, runnerUp } = championFromBracket(bracket);

    let pointsLeader: SeasonBanner['pointsLeader'] = null;
    let bestRecord: SeasonBanner['bestRecord'] = null;
    for (const r of rosters) {
      const h = rh[r.roster_id];
      if (!h) continue;
      const s = r.settings || {};
      const pf = (s.fpts || 0) + (s.fpts_decimal || 0) / 100;
      if (!pointsLeader || pf > pointsLeader.pf) pointsLeader = { handle: h, pf: r1(pf) };
      if (!bestRecord || (s.wins || 0) > bestRecord.wins) bestRecord = { handle: h, wins: s.wins || 0, losses: s.losses || 0 };
    }

    return {
      season, current: season === currentSeason,
      champion: champion != null ? rh[champion] ?? null : null,
      runnerUp: runnerUp != null ? rh[runnerUp] ?? null : null,
      pointsLeader, bestRecord,
    };
  }));

  return banners.sort((a, b) => Number(b.season) - Number(a.season));
}
