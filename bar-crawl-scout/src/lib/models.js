// Pure valuation + keeper models for the SPA.
// In the single-file app these read module-global KS/MODE; here they take the
// keeper map (ks) and window mode explicitly, so they are pure and unit-testable.
import {
  TEAMS, KEPT2025, STAGE, MODES, PTS_BASE, POSRANK, GROWTH,
  CAPITAL, NEED_TGT, BYUNAME, FAAB_HIST, STAGE_FAAB, REPLACEMENT,
} from './data.js';

export const tierFromADP = a => (a <= 12 ? 100 : a <= 30 ? 85 : a <= 60 ? 68 : a <= 110 ? 48 : a <= 160 ? 32 : 20);
export const ELITE_BONUS = a => (a <= 4 ? 12 : a <= 8 ? 7 : a <= 12 ? 3 : 0);
export const yearsLeft = n => (KEPT2025.has(n) ? 1 : 2);

// ks is the keeper map: { handle: [[name, conf], ...] }, conf in {VL, L, U}.
export function ownerOf(ks, name) {
  const ln = name.toLowerCase();
  for (const t of TEAMS) {
    for (const s of (ks[t[0]] || [])) {
      if (s[0] && s[0].toLowerCase() === ln) return { owner: t[0], conf: s[1] || 'L' };
    }
  }
  return null;
}
export const isKept = (ks, name) => { const o = ownerOf(ks, name); return !!o && o.conf !== 'U'; };
// Keeper-based pool: rostered non-keepers stay available for mocks; live ownership is display-only.
export const isAvailable = (ks, name) => !isKept(ks, name);
export const isFinalYr = (ks, n) => isKept(ks, n) && yearsLeft(n) === 1;

export function r26(p) { return Math.round(tierFromADP(p[5]) * STAGE[p[6] || ''][0] + ELITE_BONUS(p[5])); }
export function r27(p, ks) {
  const years = isKept(ks, p[1]) ? yearsLeft(p[1]) : 2;
  if (years < 2) return REPLACEMENT;
  return Math.round(tierFromADP(p[5]) * STAGE[p[6] || ''][1] + ELITE_BONUS(p[5]));
}
export function windowVal(p, ks, mode) { const w = MODES[mode]; return Math.round(r26(p) * w[0] + r27(p, ks) * w[1]); }

export function pts26(p) { const b = PTS_BASE[p[2]]; return Math.round(b[0] * Math.pow(b[1], (POSRANK[p[1]] || 30) - 1)); }
export function pts27(p, ks) {
  const years = isKept(ks, p[1]) ? yearsLeft(p[1]) : 2;
  if (years < 2) return 0;
  return Math.round(pts26(p) * GROWTH[p[6] || '']);
}

export const warchest = h => { const c = CAPITAL[h] || [0, 0, 0]; return c[0] * 3 + c[1] * 1.5 + c[2]; };
export const chestTag = h => { const w = warchest(h); return w >= 10 ? 'LOADED' : w >= 5 ? 'SOLID' : w >= 2 ? 'LIGHT' : 'STRIPPED'; };
export function needScores(ks, h) {
  const arr = ks[h] || [];
  const have = { QB: 0, RB: 0, WR: 0, TE: 0 };
  [0, 1, 2].forEach(i => { const s = arr[i]; if (s && s[0]) { const p = BYUNAME[s[0].toLowerCase()]; if (p && have[p[2]] != null) have[p[2]]++; } });
  const o = {};
  for (const k in NEED_TGT) o[k] = Math.max(0, Math.min(10, Math.round((NEED_TGT[k] - have[k]) / NEED_TGT[k] * 10)));
  return o;
}

export const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
export function computeFaab(weeks, rid2name) {
  const by = {};
  for (const txns of weeks) {
    if (!Array.isArray(txns)) continue;
    for (const t of txns) {
      if (t && t.type === 'waiver' && t.settings && typeof t.settings.waiver_bid === 'number') {
        const rid = t.roster_ids && t.roster_ids[0];
        const nm = rid2name[rid] || ('roster' + rid);
        if (!by[nm]) by[nm] = { bids: [], spent: 0, count: 0, max: 0 };
        const bid = t.settings.waiver_bid;
        by[nm].bids.push(bid); by[nm].count++;
        if (bid > by[nm].max) by[nm].max = bid;
        if (t.status === 'complete') by[nm].spent += bid;
      }
    }
  }
  for (const nm in by) by[nm].median = median(by[nm].bids);
  return by;
}
export const aggrOf = (h, faabSynced) => {
  let v;
  if (faabSynced && faabSynced[h]) v = faabSynced[h].median || 0; else v = FAAB_HIST[h] || 0;
  return v >= 40 ? 3 : v >= 20 ? 2.5 : v >= 10 ? 2 : v >= 5 ? 1 : 0.5;
};
export function faabTalent(p) { if (!p) return 35; const adp = p[5] || 120; const m = STAGE_FAAB[p[6] || ''] || 1; return Math.max(4, Math.min(100, Math.round(108 * Math.pow(0.99, adp) * m))); }
export const makeOdd = n => { n = Math.max(1, Math.round(n)); return n % 2 === 0 ? n + 1 : n; };

// Live ownership from synced rosters ({t, byHandle}); returns a name->handle map.
export function buildRosterOwn(rosterStore) {
  if (!rosterStore || !rosterStore.byHandle) return null;
  const m = {};
  for (const h in rosterStore.byHandle) {
    (rosterStore.byHandle[h].players || []).forEach(pl => { if (pl && pl.n && !m[pl.n.toLowerCase()]) m[pl.n.toLowerCase()] = h; });
  }
  return m;
}
export const rosterOwner = (own, name) => (own ? (own[name.toLowerCase()] || null) : null);
