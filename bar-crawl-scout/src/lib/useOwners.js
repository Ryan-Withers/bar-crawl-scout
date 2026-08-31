// WHO ROSTERS WHOM, LIVE — name -> handle, straight off Sleeper.
//
// The app already has a rosterOwn store, but it is derived from the Worker sync
// blob, which only exists if somebody has run a sync on this device. After the
// draft the ownership map stops being decoration and starts deciding what the
// board is allowed to show, so it needs a source that is simply always there.
//
// The rosters query polls every sixty seconds, so a waiver claim or a trade
// shows up on its own.
import { derived } from 'svelte/store';
import { createQuery } from '@tanstack/svelte-query';
import { rostersQuery, usersQuery, playersQuery } from '../api/queries';
import { userHandleMap } from '../api/league';
import { nameKey } from './data.js';

export function useOwners(leagueId) {
  const rostersQ = createQuery(rostersQuery(leagueId));
  const usersQ = createQuery(usersQuery(leagueId));
  const playersQ = createQuery(playersQuery());

  return derived([rostersQ, usersQ, playersQ], ([$rosters, $users, $players]) => {
    if (!$rosters.data || !$users.data || !$players.data) return null;
    const uh = userHandleMap($users.data);
    const map = {};
    for (const r of $rosters.data) {
      const handle = uh[r.owner_id];
      if (!handle) continue;
      for (const pid of r.players || []) {
        const info = $players.data[String(pid)];
        // First writer wins: a man can only be on one roster, and if Sleeper
        // ever disagrees with itself the earlier roster is as good a guess as
        // any. What matters here is that he is owned at all.
        if (info && info[0]) {
          const k = nameKey(info[0]);
          if (!(k in map)) map[k] = handle;
        }
      }
    }
    // Null rather than {} so callers can tell "nobody owns anyone" (which never
    // happens) from "we don't know yet" (which happens on every cold load).
    return Object.keys(map).length ? map : null;
  });
}
