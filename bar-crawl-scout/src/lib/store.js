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

// THE KEEPER STORE — two layers, and Sleeper wins.
//
// This used to be a single writable seeded from PROJ, a hand-guessed table, and
// persisted. That was right while keepers were a guess. They are locked now:
// Sleeper carries the answer on each roster and there is nothing left to guess.
//
// So the store keeps its SHAPE — { handle: [[name, conf], ...] }, which twenty-
// one components read — and swaps its SOURCE. The live layer, when present,
// overrides everything; the local layer stays underneath as the offline fallback
// and as somewhere the old sync path can still write without fighting the truth.
//
// Persistence is the reason this matters. Anyone who opened the app before the
// lock has a stale guess frozen in localStorage, and correcting data.js would
// never have reached them: initKS prefers the saved copy. The live layer is not
// persisted at all, so it cannot go stale — it is either fresh from Sleeper this
// session or it is not there.
function keeperStore() {
  const local = persisted('hq_keepers_v6', initKS(readJSON('hq_keepers_v6')));
  const live = writable(null);
  // Per-manager merge rather than a wholesale swap: Sleeper's answer wins for
  // everyone who has declared, and the projection is left standing only for
  // anyone who hasn't. Throwing away nine known answers to avoid admitting one
  // unknown was the wrong trade.
  //
  // PRESENCE is the contract, not content. The merge used to require a name in
  // the first row, which quietly meant a manager whose settled squad is empty —
  // possible now that a keeper can be sold before the draft — would have fallen
  // back to a projection saying he keeps three. The writer omits anyone who has
  // not declared; anyone it does list is answered for.
  const view = derived([live, local], ([$live, $local]) => {
    if (!$live) return $local;
    const out = { ...$local };
    for (const [h, rows] of Object.entries($live)) if (rows) out[h] = rows;
    return out;
  });
  return {
    subscribe: view.subscribe,
    set: local.set,
    update: local.update,
    /** Sleeper's answer. Pass null to fall back to the local layer. */
    setLive: live.set,
    live: { subscribe: live.subscribe },
  };
}
export const keepers = keeperStore();

// 'live' when every manager's keepers came off Sleeper, 'mixed' when some are
// still projections, 'projection' when none arrived. The UI says which, rather
// than presenting a guess as a fact.
export const keepersSource = derived(keepers.live, ($l) => {
  if (!$l) return 'projection';
  const declared = Object.keys($l).length;
  return declared >= TEAMS.length ? 'live' : 'mixed';
});

// WHERE A SETTLED KEEPER CAME FROM. { playerName: handleHeCameFrom }.
//
// The keeper store above carries SETTLED squads — a keeper traded in principle
// is listed under the manager who bought him, because that deal cannot be backed
// out of and the only reason he is on the seller's roster is that Sleeper needs
// him there to accept the declaration. That is the right squad to draft around,
// but it loses the fact that he was somebody else's declaration, so pages that
// want to say "via joshleota" read it from here.
//
// Empty until the transaction log arrives, and empty for every man who was not
// part of such a deal — which is 27 of the 30.
export const keeperFrom = writable({});

// PICK CAPITAL, live. Same argument as the keepers: data.js hand-counts who
// holds which early picks, and it had gone stale for four of the ten managers
// without anything noticing — Ryan is written down as holding two 2026 firsts
// and holds one. Sleeper's traded_picks settles it, for next year as well as
// this one. Shape: { '2026': { handle: Capital }, '2027': {...} }.
// Null until it arrives; every reader falls back to the hand-written CAPITAL.
export const capital = writable(null);
export const capitalSource = derived(capital, ($c) => ($c ? 'live' : 'hand-written'));

// Window mode is not persisted in the original app; it defaults to win-now.
export const mode = writable('winnow');

// Board: drafted list, custom ranking views, and tags.
function initBoard(existing) {
  const b = existing || {};
  return {
    drafted: Array.isArray(b.drafted) ? b.drafted : [],
    views: Array.isArray(b.views) ? b.views : [],
    tags: (b.tags && typeof b.tags === 'object') ? b.tags : {},
    // FAVOURITES and FREE-TEXT TAGS, both keyed by player name so they mean the
    // same thing on every page that reads them. Added to the existing board
    // record rather than a new key so one saved blob still carries everything a
    // draft is prepared with, and so an older saved board simply arrives with
    // both empty rather than undefined.
    favs: Array.isArray(b.favs) ? b.favs : [],
    custom: (b.custom && typeof b.custom === 'object') ? b.custom : {},
  };
}
export const board = persisted('hq_board_v3', initBoard(readJSON('hq_board_v3')));

// Live data pulled by sync (rosters) or the Worker auto-load.
export const rosters = writable(readJSON('hq_rosters_v2'));
export const draft = writable(readJSON('hq_draft_v1'));
export const faab = writable(readJSON('hq_faab_v1'));

// Persist the synced data when it changes. All three are READ from localStorage
// above, but only rosters was ever written back — so a FAAB or draft sync
// survived until the next reload and then vanished, and those two reads returned
// null forever. Faab.svelte and ManagerDossier then fell back to the
// hand-written FAAB_HIST constants as if no sync had ever run.
//
// This persists the SHAPE the sync already computed. It is Sleeper waiver-budget
// and draft data — nothing to do with the bar bankroll, which lives in bet.js
// and the Worker and is not touched here.
rosters.subscribe((val) => { if (val) writeJSON('hq_rosters_v2', val); });
draft.subscribe((val) => { if (val) writeJSON('hq_draft_v1', val); });
faab.subscribe((val) => { if (val) writeJSON('hq_faab_v1', val); });

// Name -> current owner handle, recomputed whenever rosters change.
export const rosterOwn = derived(rosters, ($r) => buildRosterOwn($r));

export const lastSync = writable((() => { try { return localStorage.getItem('hq_last_sync') || ''; } catch { return ''; } })());

// Local, per-manager scout notes (handle -> free text).
export const managerNotes = persisted('bcs_mgr_notes', readJSON('bcs_mgr_notes') || {});

// Local, per-player scout notes (player name -> free text).
export const playerNotes = persisted('bcs_player_notes', readJSON('bcs_player_notes') || {});

// A friendly profile name for your saved data (shown on the share code).
export const profileName = persisted('bcs_profile_name', readJSON('bcs_profile_name') || '');

// Commissioner unlock: when true, Ryan's (your own) files are no longer sealed,
// so you can weigh up your own trades, keepers and player values like anyone
// else's. Persisted locally per device. Toggled by the passcode below.
export const unlocked = persisted('bcs_commish_unlock', readJSON('bcs_commish_unlock') === true);
const PASSCODE = 'upupcronulla';
export function tryUnlock(code) {
  const ok = String(code || '').trim().toLowerCase() === PASSCODE;
  if (ok) unlocked.set(true);
  return ok;
}
export function relock() { unlocked.set(false); }

// Singleton hover-card state: { name, x, y } | null. A single HoverCard reads it.
export const hoverCard = writable(null);
