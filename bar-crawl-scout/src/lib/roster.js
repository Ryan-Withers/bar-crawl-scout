// Shared roster enrichment — your live Sleeper roster + board value + bye week.
// Used by My Team, Bye Radar and the Matchup preview so the logic lives once.
import { PLAYERS, BYUNAME, RYAN } from './data.js';
import { windowVal } from './models.js';

// team -> bye, derived from the top-200 board (every teammate shares a bye).
export const TEAM_BYE = (() => {
  const m = {};
  for (const p of PLAYERS) if (p[3] && p[3] !== 'FA' && !(p[3] in m)) m[p[3]] = p[4];
  return m;
})();

const normPos = (p) => (p === 'DST' ? 'DEF' : p);
const posDefault = (p) => ({ QB: 8, RB: 6, WR: 6, TE: 5, K: 3, DEF: 3, DST: 3 }[p] || 4);

// One rostered Sleeper player {n,p,t,s} -> enriched {name,pos,team,proj,bye,starter,live}.
// `projByName` (optional): lowercase name -> live weekly projected points. When a
// player has a live projection it wins; otherwise fall back to board value.
export function enrichPlayer(pl, ks, md, projByName) {
  const key = (pl.n || '').toLowerCase();
  const row = BYUNAME[key];
  const live = projByName ? projByName[key] : undefined;
  const proj = live != null ? live : (row ? windowVal(row, ks, md) : posDefault(pl.p));
  const bye = row ? row[4] : (TEAM_BYE[pl.t] || 0);
  return { name: pl.n, pos: normPos(pl.p), team: pl.t, proj, bye, starter: pl.s, live: live != null };
}

// Any manager's enriched roster, or null if not synced yet.
export function rosterFor(rostersData, handle, ks, md, projByName) {
  const r = rostersData && rostersData.byHandle ? rostersData.byHandle[handle] : null;
  return r ? r.players.map((pl) => enrichPlayer(pl, ks, md, projByName)) : null;
}

// Your enriched roster (Ryan = you).
export function myRoster(rostersData, ks, md, projByName) {
  return rosterFor(rostersData, RYAN, ks, md, projByName);
}
