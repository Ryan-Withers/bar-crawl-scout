// LIVE PROJECTIONS — turn Sleeper's weekly projection blob into name -> projected
// league points, using the league's own scoring. Feeds My Team / Matchup so
// in-season numbers are real weekly projections, not the board-value proxy.
// Pure + fixture-tested; the loader passes the raw blobs straight through.
import { scoreStats } from '../lib/engine/scoring';
import type { PlayerLite } from './types';

// projBlob: { player_id: {stat_key: value} }; byId: { player_id: [name,pos,team] }.
export function projMapFromBlob(
  projBlob: Record<string, Record<string, number>>,
  byId: Record<string, PlayerLite>,
  scoring: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pid in projBlob) {
    const info = byId[pid];
    if (!info || !info[0]) continue;
    const pts = scoreStats(projBlob[pid], scoring);
    if (pts) out[info[0].toLowerCase()] = Math.round(pts * 10) / 10;
  }
  return out;
}
