// Pure valuation + keeper models for the SPA.
// In the single-file app these read module-global KS/MODE; here they take the
// keeper map (ks) and window mode explicitly, so they are pure and unit-testable.
import {
  PLAYERS, TEAMS, KEPT2025, STAGE, MODES, PTS_BASE, POSRANK, GROWTH,
  CAPITAL, NEED_TGT, BYUNAME, FAAB_HIST, STAGE_FAAB, REPLACEMENT, RYAN,
  POS_DECAY, POS_DEV, POS_ROOKIE_Y1, nameKey, byName,
} from './data.js';

// ADP -> talent base. The anchor points are the tiers this board has always
// used; what changed is that we INTERPOLATE between them instead of stepping.
//
// As a staircase, every player from ADP 61 to ADP 110 scored an identical 48 —
// so a receiver going 71st and one going 110th were, to the model, the same
// player, and a single pick either side of a boundary swung the value 15-20.
// That flattening is what let a stage multiplier alone decide the order inside
// a tier. Straight-line interpolation keeps every anchor exactly where it was
// and just stops throwing away the resolution in between.
export const ADP_ANCHORS = [[1, 100], [12, 100], [30, 85], [60, 68], [110, 48], [160, 32], [200, 20], [260, 12]];
export function tierFromADP(a) {
  // Missing ADP means undrafted, not pick zero — clamp those apart.
  const n = Number(a);
  const x = Number.isFinite(n) ? Math.max(1, n) : 260;
  for (let i = 1; i < ADP_ANCHORS.length; i++) {
    const [x0, y0] = ADP_ANCHORS[i - 1];
    const [x1, y1] = ADP_ANCHORS[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return ADP_ANCHORS[ADP_ANCHORS.length - 1][1];
}
export const ELITE_BONUS = a => (a <= 4 ? 12 : a <= 8 ? 7 : a <= 12 ? 3 : 0);
// KEPT2025 is spelled our way ("Marvin Harrison Jr."); a name reaching this
// function may be spelled Sleeper's ("Marvin Harrison"). Match on the normalised
// key so a suffix cannot quietly hand a final-year keeper a second year — which
// is worth 60-odd points of 2027 value to him.
const KEPT2025_KEYS = new Set([...KEPT2025].map(nameKey));
export const yearsLeft = n => (KEPT2025.has(n) || KEPT2025_KEYS.has(nameKey(n)) ? 1 : 2);

// ks is the keeper map: { handle: [[name, conf], ...] }, conf in {VL, L, U}.
export function ownerOf(ks, name) {
  const ln = nameKey(name);
  for (const t of TEAMS) {
    for (const s of (ks[t[0]] || [])) {
      if (s[0] && nameKey(s[0]) === ln) return { owner: t[0], conf: s[1] || 'L' };
    }
  }
  return null;
}
export const isKept = (ks, name) => { const o = ownerOf(ks, name); return !!o && o.conf !== 'U'; };
// Keeper-based pool: rostered non-keepers stay available for mocks; live ownership is display-only.
export const isAvailable = (ks, name) => !isKept(ks, name);
export const isFinalYr = (ks, n) => isKept(ks, n) && yearsLeft(n) === 1;

// ROOKIE YEAR-ONE RISK, SCALED BY DRAFT CAPITAL.
//
// A flat discount was the wrong shape. It charged a consensus top-25 rookie —
// a first-round back walking into a starting job, already vetted hard by the
// market to go that early — exactly as much as a 150th-pick dart throw who may
// never see the field. That flat penalty could exceed the ADP gap it was
// applied over, which is how a top-25 rookie ended up behind a mid-round
// second-year player on a win-now board despite being 30 picks better.
//
// The market has already priced most of the risk into ADP; what's left to
// charge is the part ADP can't express — a rookie's floor is lower and his
// variance wider than a known quantity's, and a win-now roster is the one that
// can least afford that. How MUCH is left scales with capital: the earlier the
// consensus takes him, the more of the doubt it has already resolved.
export const ROOKIE_Y1 = [[1, 0.88], [150, 0.62]];
export function rookieYearOne(adp, pos) {
  const [[a0, m0], [a1, m1]] = ROOKIE_Y1;
  const n = Number(adp);
  const x = Number.isFinite(n) ? Math.min(a1, Math.max(a0, n)) : a1;
  const byCapital = m0 + ((x - a0) / (a1 - a0)) * (m1 - m0);
  // A rookie back contributes on day one far more reliably than a rookie
  // receiver does. Never let it reach 1 — year one is always a discount.
  return Math.min(0.97, byCapital * (POS_ROOKIE_Y1[pos] ?? 1));
}

/**
 * The 2027 multiplier, bent by position. A career phase does not move at the
 * same speed for a back and a receiver: DECAY scales how much of a declining
 * stage's loss actually lands, DEV scales how much of a developing stage's
 * gain is still to come. Flat stages stay flat under both.
 */
export function stageYear2(stage, pos) {
  const base = (STAGE[stage] || STAGE[''])[1];
  if (base >= 1) return 1 + (base - 1) * (POS_DEV[pos] ?? 1);
  return 1 - (1 - base) * (POS_DECAY[pos] ?? 1);
}

// [2026, 2027] multipliers for a player row.
export function stageMult(p) {
  const s = (p && p[6]) || '';
  const pos = (p && p[2]) || '';
  const y1 = s === 'rookie' ? rookieYearOne(p[5], pos) : (STAGE[s] || STAGE[''])[0];
  return [y1, stageYear2(s, pos)];
}

export function r26(p) { return Math.round(tierFromADP(p[5]) * stageMult(p)[0] + ELITE_BONUS(p[5])); }
export function r27(p, ks) {
  const years = isKept(ks, p[1]) ? yearsLeft(p[1]) : 2;
  if (years < 2) return REPLACEMENT;
  return Math.round(tierFromADP(p[5]) * stageMult(p)[1] + ELITE_BONUS(p[5]));
}
export function windowVal(p, ks, mode) { const w = MODES[mode]; return Math.round(r26(p) * w[0] + r27(p, ks) * w[1]); }

export function pts26(p) { const b = PTS_BASE[p[2]]; return Math.round(b[0] * Math.pow(b[1], (POSRANK[p[1]] || 30) - 1)); }
// The projected-POINTS growth gets the same positional lens as the value
// multiplier, so the P27 column can't tell a different story from R27.
export function growthYear2(stage, pos) {
  const base = GROWTH[stage] ?? GROWTH[''];
  if (base >= 1) return 1 + (base - 1) * (POS_DEV[pos] ?? 1);
  return 1 - (1 - base) * (POS_DECAY[pos] ?? 1);
}
export function pts27(p, ks) {
  const years = isKept(ks, p[1]) ? yearsLeft(p[1]) : 2;
  if (years < 2) return 0;
  return Math.round(pts26(p) * growthYear2(p[6] || '', p[2]));
}

export const warchest = h => { const c = CAPITAL[h] || [0, 0, 0]; return c[0] * 3 + c[1] * 1.5 + c[2]; };
export const chestTag = h => { const w = warchest(h); return w >= 10 ? 'LOADED' : w >= 5 ? 'SOLID' : w >= 2 ? 'LIGHT' : 'STRIPPED'; };
/**
 * How badly a manager still needs each position, 0-10, after his keepers.
 *
 * `targets` comes from the live lineup when the caller has it (see
 * league-config.needTargets); NEED_TGT is the offline fallback and the two agree
 * for this league by construction.
 *
 * The name lookup goes through byName, not a raw BYUNAME hit: Sleeper says
 * "Kenneth Walker" where the board says "Kenneth Walker III", so a raw compare
 * silently failed to count eighteen of the top 200 toward anybody's need.
 */
export function needScores(ks, h, targets = NEED_TGT) {
  const arr = ks[h] || [];
  const have = { QB: 0, RB: 0, WR: 0, TE: 0 };
  [0, 1, 2].forEach(i => { const s = arr[i]; if (s && s[0]) { const p = byName(s[0]); if (p && have[p[2]] != null) have[p[2]]++; } });
  const o = {};
  const tgt = targets && Object.keys(targets).length ? targets : NEED_TGT;
  for (const k in tgt) {
    const need = tgt[k] || 1;
    o[k] = Math.max(0, Math.min(10, Math.round((need - have[k]) / need * 10)));
  }
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
    (rosterStore.byHandle[h].players || []).forEach(pl => { if (pl && pl.n && !m[nameKey(pl.n)]) m[nameKey(pl.n)] = h; });
  }
  return m;
}
export const rosterOwner = (own, name) => (own ? (own[nameKey(name)] || null) : null);

// Redaction + trade helpers.
export const isRyanPlayer = (ks, name) => { const o = ownerOf(ks, name); return !!o && o.owner === RYAN; };
export const draftable = (ks) => PLAYERS.filter((p) => !isKept(ks, p[1]));
// The draftable board, best first — what a pick actually lands.
export const boardValues = (ks, mode) =>
  draftable(ks).map((p) => windowVal(p, ks, mode)).sort((a, b) => b - a);

/**
 * A pick is valued as the real player you would land with it.
 *
 * `slot` is the seat it belongs to and it matters: the draft snakes, so slot 4
 * in round 2 is the SEVENTH pick of that round. This used to hard-code slot 4
 * and a linear board, which meant the Trade page valued both sides of a deal as
 * if every pick were Ryan's, and the error changed sign every round.
 *
 * Pass `teams`/`type` from the live draft. With no seat named the price is taken
 * at the middle of the round — a stated average rather than somebody's seat.
 */
export function pickValue(season, round, ks, mode, opts = {}) {
  const pv = boardValues(ks, mode);
  const teams = opts.teams > 0 ? opts.teams : 10;
  const type = opts.type === 'linear' ? 'linear' : 'snake';
  const slot = Number.isFinite(opts.slot) ? opts.slot : Math.ceil(teams / 2);
  const idx = type === 'snake' && round % 2 === 0 ? teams - slot : slot - 1;
  const overall = (round - 1) * teams + idx + 1;
  if (overall > pv.length) return 0;             // nobody left to land
  let base = pv[overall - 1] || 0;
  const current = Number(opts.season || 2026);
  if (Number(season) > current) base = Math.round(base * 0.6);
  return Math.round(base);
}
