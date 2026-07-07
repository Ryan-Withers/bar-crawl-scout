// Reactive app state for the SPA, backed by the same localStorage keys the
// single-file app used, so existing saved data (keeper edits, board views/tags,
// cached sync) carries over untouched.
import { writable, derived } from 'svelte/store';
import { PROJ, TEAMS } from './data.js';
import { buildRosterOwn } from './models.js';

const readJSON = (key) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
};
const writeJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage full/blocked */ } };

// A writable that mirrors itself into localStorage on every change.
function persisted(key, initial) {
  const store = writable(initial);
  store.subscribe((val) => writeJSON(key, val));
  return store;
}

// Keepers: start from the saved map or the projections, then pad every team to
// four slots and force the 4th (watch) slot to "U" — identical to the old init.
function initKS(existing) {
  const ks = existing || JSON.parse(JSON.stringify(PROJ));
  for (const t of TEAMS) {
    if (!ks[t[0]]) ks[t[0]] = [];
    while (ks[t[0]].length < 4) ks[t[0]].push(['', '']);
    if (ks[t[0]][3][0]) ks[t[0]][3] = [ks[t[0]][3][0], 'U'];
  }
  return ks;
}

export const keepers = persisted('hq_keepers_v6', initKS(readJSON('hq_keepers_v6')));

// Window mode is not persisted in the original app; it defaults to win-now.
export const mode = writable('winnow');

// Board: drafted list, custom ranking views, and tags.
function initBoard(existing) {
  const b = existing || {};
  return { drafted: Array.isArray(b.drafted) ? b.drafted : [], views: Array.isArray(b.views) ? b.views : [], tags: (b.tags && typeof b.tags === 'object') ? b.tags : {} };
}
export const board = persisted('hq_board_v3', initBoard(readJSON('hq_board_v3')));

// Live data pulled by sync (rosters) or the Worker auto-load.
export const rosters = writable(readJSON('hq_rosters_v2'));
export const draft = writable(readJSON('hq_draft_v1'));
export const faab = writable(readJSON('hq_faab_v1'));

// Persist rosters when they change (sync/auto-load update this store).
rosters.subscribe((val) => { if (val) writeJSON('hq_rosters_v2', val); });

// Name -> current owner handle, recomputed whenever rosters change.
export const rosterOwn = derived(rosters, ($r) => buildRosterOwn($r));

export const lastSync = writable((() => { try { return localStorage.getItem('hq_last_sync') || ''; } catch { return ''; } })());

// Local, per-manager scout notes (handle -> free text).
export const managerNotes = persisted('bcs_mgr_notes', readJSON('bcs_mgr_notes') || {});
