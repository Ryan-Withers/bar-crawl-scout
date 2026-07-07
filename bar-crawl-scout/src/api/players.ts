// The big /players/nfl blob (~5MB). Fetch at most once per day, cache the indexed
// map in IndexedDB, and never hold the raw blob in memory.
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { getRawPlayers } from './sleeper';
import type { SleeperPlayer, PlayerLite, IndexedPlayers } from './types';

const KEY = 'bcs_players_v1';
const DAY = 86_400_000;

// Pure: raw Sleeper player map -> compact { id: [name, pos, team] }. Unit-tested.
export function indexPlayers(raw: Record<string, SleeperPlayer>): Record<string, PlayerLite> {
  const byId: Record<string, PlayerLite> = {};
  for (const id in raw) {
    const v = raw[id];
    if (!v) continue;
    const nm = v.full_name || `${v.first_name || ''} ${v.last_name || ''}`.trim() || v.last_name || '';
    if (!nm) continue;
    byId[id] = [nm, v.position || '', v.team || 'FA'];
  }
  return byId;
}

// Load the indexed player map, preferring a day-fresh IndexedDB cache.
export async function loadPlayers(): Promise<Record<string, PlayerLite>> {
  try {
    const cached = await idbGet<IndexedPlayers>(KEY);
    if (cached && Date.now() - cached.t < DAY) return cached.byId;
  } catch {
    /* IndexedDB unavailable (private mode / SSR) — fall through to fetch */
  }
  const byId = indexPlayers(await getRawPlayers());
  try {
    await idbSet(KEY, { t: Date.now(), version: '1', byId } satisfies IndexedPlayers);
  } catch {
    /* cache write best-effort */
  }
  return byId;
}
