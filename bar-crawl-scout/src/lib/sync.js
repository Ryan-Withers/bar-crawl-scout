// Manual full Sync + live auto-load, ported from the single-file app.
// Writes into the reactive stores (which persist to the same localStorage keys),
// so the rest of the UI updates automatically when a sync finishes.
import { TEAMS, TEAMSHORT, ROSTER2025 } from './data.js';
import { computeFaab } from './models.js';
import { esc } from './util.js';
import { SYNC_URL, LG2026, LG2025, LG2024, jget, fetchLiveRosters } from './sleeper.js';
import { rosters, faab, draft, lastSync } from './store.js';

const now = () => new Date().toLocaleString();

// Read the Worker's cached rosters on page open; silent no-op if unreachable.
export async function autoLoad() {
  if (!SYNC_URL || typeof fetch !== 'function') return false;
  try {
    const store = await fetchLiveRosters();
    if (!store || !store.byHandle || !Object.keys(store.byHandle).length) return false;
    rosters.set(store);
    if (store.t) { try { lastSync.set(new Date(store.t).toLocaleString()); } catch { lastSync.set('live'); } }
    return true;
  } catch { return false; }
}

// Full manual sync: league, FAAB medians (17 weeks), live rosters + player dict,
// and 2024/2025 draft history. `status` is a callback that receives HTML strings.
export async function runSync(status) {
  status('<div class="out">Syncing from Sleeper... pulling the league, drafts and 17 weeks of transactions, this takes a few seconds.</div>');
  try {
    const league = await jget('https://api.sleeper.app/v1/league/' + LG2026);
    const users = await jget('https://api.sleeper.app/v1/league/' + LG2026 + '/users');
    const rs = await jget('https://api.sleeper.app/v1/league/' + LG2026 + '/rosters');
    const tp = await jget('https://api.sleeper.app/v1/league/' + LG2026 + '/traded_picks');
    let rid2name = Object.assign({}, ROSTER2025);
    try {
      const u25 = await jget('https://api.sleeper.app/v1/league/' + LG2025 + '/users');
      const r25 = await jget('https://api.sleeper.app/v1/league/' + LG2025 + '/rosters');
      if (Array.isArray(r25) && r25.length) {
        const byId = {}; u25.forEach((u) => (byId[u.user_id] = (u.display_name || u.user_id)));
        const norm = (dn) => { const l = String(dn).toLowerCase(); if (l.indexOf('wither') >= 0) return 'Ryan'; const hit = TEAMS.find((t) => t[0].toLowerCase() === l); return hit ? hit[0] : dn; };
        const m = {}; r25.forEach((r) => { m[r.roster_id] = norm(byId[r.owner_id] || ''); }); rid2name = m;
      }
    } catch { /* keep default rid map */ }
    const weeks = [];
    for (let w = 1; w <= 17; w++) { try { weeks.push(await jget('https://api.sleeper.app/v1/league/' + LG2025 + '/transactions/' + w)); } catch { /* skip week */ } }
    const fa = computeFaab(weeks, rid2name);
    const nbids = Object.values(fa).reduce((s, x) => s + x.count, 0);
    const ts = now();
    faab.set({ byManager: fa, weeks: weeks.length, ts });
    lastSync.set(ts);

    const cleanh = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const norm = (dn) => { const l = cleanh(dn); if (l.indexOf('wither') >= 0) return 'Ryan'; const hit = TEAMS.find((t) => cleanh(t[0]) === l); return hit ? hit[0] : dn; };
    const umap = {}; users.forEach((u) => (umap[u.user_id] = norm(u.display_name || u.user_id)));

    let rosterSummary = '';
    try {
      status('<div class="out">Syncing... loading live rosters and the Sleeper player list (large first time, cached after).</div>');
      let PLAYERMAP = null, fresh = false;
      try { const pm = localStorage.getItem('hq_players_v2'); if (pm) { const o = JSON.parse(pm); if (o && o.map && (Date.now() - (o.t || 0) < 86400000)) { PLAYERMAP = o.map; fresh = true; } } } catch { /* no cache */ }
      if (!PLAYERMAP || !fresh) {
        const all = await jget('https://api.sleeper.app/v1/players/nfl');
        const map = {};
        for (const id in all) { const v = all[id]; if (!v) continue; const nm = v.full_name || ((v.first_name || '') + ' ' + (v.last_name || '')).trim() || v.last_name || ''; if (!nm) continue; map[id] = [nm, v.position || '', v.team || 'FA']; }
        PLAYERMAP = map;
        try { localStorage.setItem('hq_players_v2', JSON.stringify({ t: Date.now(), map })); } catch { /* storage full */ }
      }
      const byHandle = {}; let totalP = 0; const unmatched = [];
      if (Array.isArray(rs)) rs.forEach((r) => {
        const handle = umap[r.owner_id];
        if (!handle || !TEAMS.some((t) => t[0] === handle)) { if (handle && unmatched.indexOf(handle) < 0) unmatched.push(handle); return; }
        const ids = r.players || [], starters = new Set(r.starters || []);
        const players = ids.map((id) => { const e = PLAYERMAP[id]; return e ? { n: e[0], p: e[1], t: e[2], s: starters.has(id) } : { n: String(id), p: '', t: '', s: starters.has(id) }; });
        byHandle[handle] = { players, count: ids.length }; totalP += ids.length;
      });
      rosters.set({ t: ts, byHandle });
      const u2name = {}; (users || []).forEach((u) => (u2name[u.user_id] = u.display_name || String(u.user_id)));
      const mapRows = (Array.isArray(rs) ? rs : []).slice().sort((a, b) => a.roster_id - b.roster_id).map((r) => { const dn = u2name[r.owner_id] || ('owner ' + r.owner_id); const h = umap[r.owner_id]; const matched = h && TEAMS.some((t) => t[0] === h); const cnt = (r.players || []).length; return 'roster ' + r.roster_id + ': Sleeper "' + esc(dn) + '" &rarr; ' + (matched ? '<b>' + esc(h) + '</b>' : '<span class="bd">UNMATCHED (' + esc(h || '?') + ')</span>') + ' &middot; ' + cnt + ' players'; }).join('<br>');
      rosterSummary = '<br>Live rosters: <span class="wk">' + Object.keys(byHandle).length + '/' + TEAMS.length + ' teams matched, ' + totalP + ' rostered players</span>' + (unmatched.length ? ' <span class="bd">- could not match: ' + unmatched.map(esc).join(', ') + ' (tell Ryan these Sleeper names)</span>' : ' - all teams matched.') + '<div class="pmeta" style="margin-top:8px;font-size:12px;line-height:1.7;border-top:1px solid var(--line);padding-top:6px">TEAM MAPPING (verify each Sleeper name maps to the right manager):<br>' + mapRows + '</div>';
    } catch (e) { rosterSummary = '<br><span class="pmeta">Roster pull failed (rest still synced): ' + esc(String(e.message || e)) + '</span>'; }

    let draftSummary = '';
    try {
      const draftedBy = {}, byManager = {};
      async function pullDraft(lgid, season) {
        try { const su = await jget('https://api.sleeper.app/v1/league/' + lgid + '/users'); su.forEach((u) => { if (!umap[u.user_id]) umap[u.user_id] = norm(u.display_name || u.user_id); }); } catch { /* users optional */ }
        const drafts = await jget('https://api.sleeper.app/v1/league/' + lgid + '/drafts');
        if (!Array.isArray(drafts) || !drafts.length) return 0;
        const picks = await jget('https://api.sleeper.app/v1/draft/' + drafts[0].draft_id + '/picks');
        if (!Array.isArray(picks)) return 0; let n = 0;
        picks.forEach((pk) => {
          const meta = pk.metadata || {}; const nm = ((meta.first_name || '') + ' ' + (meta.last_name || '')).trim(); if (!nm) return;
          const handle = umap[pk.picked_by]; if (!handle || !TEAMS.some((t) => t[0] === handle)) return;
          const b = byManager[handle] || (byManager[handle] = { p24: [], p25: [], repeat: [], pos: {} });
          (season === 2024 ? b.p24 : b.p25).push(nm); const ps = meta.position || ''; if (ps) b.pos[ps] = (b.pos[ps] || 0) + 1;
          (draftedBy[nm] = draftedBy[nm] || []).push([handle, season]); n++;
        });
        return n;
      }
      const n24 = await pullDraft(LG2024, 2024), n25 = await pullDraft(LG2025, 2025);
      for (const h in byManager) { const b = byManager[h]; const s = new Set(b.p24); b.repeat = b.p25.filter((x) => s.has(x)).filter((x, i, a) => a.indexOf(x) === i); }
      draft.set({ draftedBy, byManager, ts });
      const reps = Object.keys(byManager).reduce((s, h) => s + (byManager[h].repeat ? byManager[h].repeat.length : 0), 0);
      draftSummary = '<br>Drafts: <span class="wk">' + n24 + ' picks 2024, ' + n25 + ' picks 2025, ' + reps + ' repeat-pick affinities</span> - dossiers now show real history.';
    } catch (e) { draftSummary = '<br><span class="pmeta">Draft history pull failed (FAAB still synced): ' + esc(String(e.message || e)) + '</span>'; }

    const top = Object.keys(fa).map((h) => ({ h, m: fa[h].median, mx: fa[h].max, sp: fa[h].spent, c: fa[h].count })).sort((a, b) => b.sp - a.sp).slice(0, 5);
    const rows = top.map((x) => (TEAMSHORT[x.h] || x.h) + ': median $' + x.m + ', max $' + x.mx + ', spent $' + x.sp + ' over ' + x.c + ' bids').join('<br>');
    status('<div class="out"><div class="big">Synced</div>League: ' + esc(league.name) + '<br>Users ' + users.length + ' · Rosters ' + rs.length + ' · Traded picks ' + tp.length + '<br>FAAB: <span class="wk">' + weeks.length + ' weeks, ' + nbids + ' bids</span>' + rosterSummary + draftSummary + '<br>Last synced: <span class="wk">' + esc(ts) + '</span><br><br><b>Top FAAB spenders (real medians now live in the FAAB tab):</b><br>' + (rows || 'no waiver bids found') + '</div>');
  } catch (err) {
    status('<div class="out"><span class="bd">Could not reach Sleeper.</span><br>' + esc(String(err.message || err)) + '<br><br>If you are in the in-app preview the network is blocked. Open this site in Chrome or Safari and tap Sync. Everything else works offline.</div>');
  }
}
