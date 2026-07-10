// Map live Sleeper users/rosters onto our fixed manager handles.
// Pure functions so they're unit-testable without hitting the network.
import type { SleeperUser, SleeperRoster } from './types';
import { TEAMS } from '../lib/data.js';

const HANDLES = (TEAMS as [string, string][]).map((t) => t[0]);
const clean = (x: string) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// A Sleeper display name -> our handle. The commissioner ("...wither...") -> Ryan.
export function normHandle(displayName: string): string {
  const l = clean(displayName);
  if (l.indexOf('wither') >= 0) return 'Ryan';
  const hit = HANDLES.find((h) => clean(h) === l);
  return hit || displayName;
}

// owner user_id -> handle
export function userHandleMap(users: SleeperUser[]): Record<string, string> {
  const m: Record<string, string> = {};
  if (!Array.isArray(users)) return m; // guarded degradation: bad shape -> empty, never a throw
  for (const u of users) m[u.user_id] = normHandle(u.display_name || u.user_id);
  return m;
}

export interface ManagerLive {
  handle: string;
  user_id: string;
  avatar: string | null;
  teamName?: string;
}

// handle -> live identity (avatar, team name) from /users
export function managersFromUsers(users: SleeperUser[]): Record<string, ManagerLive> {
  const out: Record<string, ManagerLive> = {};
  if (!Array.isArray(users)) return out;
  for (const u of users) {
    const h = normHandle(u.display_name || u.user_id);
    out[h] = { handle: h, user_id: u.user_id, avatar: u.avatar, teamName: u.metadata?.team_name };
  }
  return out;
}

export interface ManagerRecord {
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  faabUsed: number;
}

// handle -> record / points from /rosters (needs the user->handle map)
export function recordsFromRosters(
  rosters: SleeperRoster[],
  userHandle: Record<string, string>,
): Record<string, ManagerRecord> {
  const out: Record<string, ManagerRecord> = {};
  if (!Array.isArray(rosters)) return out;
  for (const r of rosters) {
    const h = userHandle[r.owner_id];
    if (!h) continue;
    const s = r.settings || ({} as SleeperRoster['settings']);
    out[h] = {
      wins: s.wins || 0,
      losses: s.losses || 0,
      ties: s.ties || 0,
      pf: (s.fpts || 0) + (s.fpts_decimal || 0) / 100,
      pa: (s.fpts_against || 0) + (s.fpts_against_decimal || 0) / 100,
      faabUsed: s.waiver_budget_used || 0,
    };
  }
  return out;
}
