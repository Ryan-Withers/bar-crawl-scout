// THE DRAFT SHEET ENGINE.
//
// The premise, borrowed from the IDP helper: this league's rulebook is
// distorted enough that a stock ranking is actively misleading. So re-score
// every player under our OWN scoring_settings — pulled live, never
// transcribed — and show how far each one moves against a stock baseline.
//
// Our two big distortions, straight off the league endpoint:
//   pass_td 6 (stock is 4)        -> quarterbacks are worth far more here
//   rush_fd / rec_fd 0.5          -> chain-movers and possession backs gain
//   plus fum -1 stacked on fum_lost -1, and a live IDP_FLEX slot with full
//   IDP scoring, which the rest of this app doesn't model at all.
//
// Everything here is per GAME, never a season total, because projected games
// played varies and a 9-game projection otherwise tops the board.
//
// Pure: no fetching, no DOM, no dates.
import { scoreStats } from './scoring';

/** A stock half-PPR rulebook, as the baseline every public ranking assumes. */
export const STOCK_SCORING: Record<string, number> = {
  pass_yd: 0.04, pass_td: 4, pass_int: -2, pass_2pt: 2,
  rush_yd: 0.1, rush_td: 6, rush_2pt: 2,
  rec: 0.5, rec_yd: 0.1, rec_td: 6, rec_2pt: 2,
  fum_lost: -2,
};

/** Who may fill each flex-type slot in this league. */
export const SLOT_ELIGIBLE: Record<string, string[]> = {
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
  IDP_FLEX: ['DL', 'LB', 'DB', 'DE', 'DT', 'NT', 'ILB', 'OLB', 'CB', 'S', 'SS', 'FS'],
};
const NON_SLOT = new Set(['BN', 'IR', 'TAXI']);

export interface SheetInput {
  id: string;
  name: string;
  pos: string;
  team: string;
  age?: number | null;
  exp?: number | null;
  games: number;                        // projected games played
  proj: Record<string, number>;         // SEASON projected stat line
  prior?: Record<string, number> | null; // prior season ACTUAL stat line
  priorGames?: number;
}

export interface SheetRow {
  id: string; name: string; pos: string; team: string;
  age: number | null; exp: number | null;
  games: number;
  ours: number;   // ppg under the league's rules
  stock: number;  // ppg under the stock baseline (0 for defenders — no baseline exists)
  boost: number;  // ours/stock - 1, or null-ish 0 when stock is 0
  edge: number;   // boost measured against the league-wide median boost
  vorp: number;   // ours - replacement level for his position
  posRank: number;
  ovRank: number;
  partial: boolean; // projected for less than a full season
  fd: number;       // ppg that comes purely from the first-down rules
  line: Record<string, number>; // the per-game line every number above came from
}

/** Points per game coming purely from the rules a stock ranking cannot see. */
export function firstDownPoints(line: Record<string, number>, scoring: Record<string, number>): number {
  return (line.rush_fd || 0) * (scoring.rush_fd || 0) + (line.rec_fd || 0) * (scoring.rec_fd || 0);
}

/** Divide a season stat line into a per-game one. Games of 0 yields nothing. */
export function perGame(stats: Record<string, number>, games: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!games || games <= 0) return out;
  for (const k in stats) {
    const v = stats[k];
    if (typeof v === 'number') out[k] = v / games;
  }
  return out;
}

/**
 * Fill the gaps Sleeper leaves, from the player's OWN prior-season per-game
 * rate — never a league average, which would invent production for someone who
 * has none. Only keys the league actually scores are worth filling.
 */
export function backfill(
  projPg: Record<string, number>,
  priorPg: Record<string, number> | null | undefined,
  scoring: Record<string, number>,
): { line: Record<string, number>; filled: string[] } {
  const line = { ...projPg };
  const filled: string[] = [];
  if (!priorPg) return { line, filled };
  for (const k in scoring) {
    if (!scoring[k]) continue;               // rule isn't worth points here
    if (line[k] !== undefined) continue;     // already projected
    const v = priorPg[k];
    if (typeof v === 'number' && v !== 0) { line[k] = v; filled.push(k); }
  }
  return { line, filled };
}

/**
 * League-wide starting slots by position, from the real roster_positions.
 * Dedicated slots are counted outright; flex slots are returned separately
 * because who fills them depends on who is actually on the board.
 */
export function slotDemand(rosterPositions: string[], teams: number): {
  dedicated: Record<string, number>;
  flexes: Array<{ slot: string; elig: string[]; n: number }>;
} {
  const dedicated: Record<string, number> = {};
  const flexCount: Record<string, number> = {};
  for (const p of rosterPositions || []) {
    if (NON_SLOT.has(p)) continue;
    if (SLOT_ELIGIBLE[p]) flexCount[p] = (flexCount[p] || 0) + 1;
    else dedicated[p] = (dedicated[p] || 0) + 1;
  }
  for (const k in dedicated) dedicated[k] *= teams;
  const flexes = Object.keys(flexCount).map((slot) => ({
    slot, elig: SLOT_ELIGIBLE[slot], n: flexCount[slot] * teams,
  }));
  return { dedicated, flexes };
}

/**
 * Replacement level per position: greedy fill of the league's real lineup
 * against the current board, then the NEXT man at each position is replacement.
 * Dedicated slots go first, then each flex seat takes the best eligible player
 * left anywhere — which is what actually happens in a draft.
 *
 * `dry` names any position whose pool ran out during the fill: its replacement
 * is then a floor rather than a real number, and the page says so.
 */
export function replacementLevels(
  rows: Array<{ pos: string; ours: number; partial?: boolean }>,
  rosterPositions: string[],
  teams: number,
): { levels: Record<string, number>; consumed: Record<string, number>; dry: string[] } {
  // Partial-season projections never set replacement — a 4-game line at a high
  // per-game rate would quietly move every VORP on the board.
  const byPos: Record<string, number[]> = {};
  for (const r of rows) {
    if (r.partial) continue;
    (byPos[r.pos] = byPos[r.pos] || []).push(r.ours);
  }
  for (const p in byPos) byPos[p].sort((a, b) => b - a);

  const used: Record<string, number> = {};
  const dry: string[] = [];
  const take = (pos: string, n: number) => {
    const pool = byPos[pos] || [];
    const from = used[pos] || 0;
    if (from + n > pool.length && !dry.includes(pos)) dry.push(pos);
    used[pos] = Math.min(pool.length, from + n);
  };

  const { dedicated, flexes } = slotDemand(rosterPositions, teams);
  for (const pos in dedicated) take(pos, dedicated[pos]);

  // Each flex seat, one at a time, to whichever eligible position has the best
  // man still on the board.
  for (const f of flexes) {
    for (let i = 0; i < f.n; i++) {
      let best: string | null = null;
      let bestVal = -Infinity;
      for (const pos of f.elig) {
        const pool = byPos[pos] || [];
        const next = pool[used[pos] || 0];
        if (next !== undefined && next > bestVal) { bestVal = next; best = pos; }
      }
      if (!best) { for (const pos of f.elig) if (!dry.includes(pos)) dry.push(pos); break; }
      take(best, 1);
    }
  }

  const levels: Record<string, number> = {};
  for (const pos in byPos) {
    const pool = byPos[pos];
    const idx = used[pos] || 0;
    levels[pos] = pool[idx] ?? pool[pool.length - 1] ?? 0;
  }
  return { levels, consumed: used, dry };
}

export const median = (xs: number[]): number => {
  const s = xs.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * The signature column. A raw boost is meaningless in isolation because this
 * rulebook inflates EVERYONE — so report the deviation from the median boost:
 * who gains more than the tide.
 */
export function rulesEdge(ours: number, stock: number, medBoost: number): number {
  if (!stock || stock <= 0) return 0;
  return (ours / stock) / (1 + medBoost) - 1;
}

/** Build the whole board. One pass, so every number on a row agrees. */
export function buildSheet(
  inputs: SheetInput[],
  scoring: Record<string, number>,
  rosterPositions: string[],
  teams: number,
  fullGames = 17,
): { rows: SheetRow[]; levels: Record<string, number>; dry: string[]; medBoost: number } {
  const scored = inputs.map((p) => {
    const projPg = perGame(p.proj || {}, p.games);
    const priorPg = p.prior && p.priorGames ? perGame(p.prior, p.priorGames) : null;
    const { line } = backfill(projPg, priorPg, scoring);
    const ours = scoreStats(line, scoring);
    const stock = scoreStats(line, STOCK_SCORING);
    return {
      id: p.id, name: p.name, pos: p.pos, team: p.team,
      age: p.age ?? null, exp: p.exp ?? null,
      games: p.games, ours, stock, line,
      fd: Math.round(firstDownPoints(line, scoring) * 100) / 100,
      partial: p.games > 0 && p.games < fullGames * 0.75,
    };
  }).filter((r) => r.games > 0);

  // Median boost across players who HAVE a stock baseline. Defenders don't —
  // no public ranking scores them at all — so they can't set the tide.
  const medBoost = median(scored.filter((r) => r.stock > 0).map((r) => r.ours / r.stock - 1));

  const { levels, dry } = replacementLevels(scored, rosterPositions, teams);

  const rows: SheetRow[] = scored.map((r) => ({
    ...r,
    boost: r.stock > 0 ? r.ours / r.stock - 1 : 0,
    edge: rulesEdge(r.ours, r.stock, medBoost),
    vorp: r.ours - (levels[r.pos] ?? 0),
    posRank: 0, ovRank: 0,
  }));

  rows.sort((a, b) => b.vorp - a.vorp);
  rows.forEach((r, i) => { r.ovRank = i + 1; });
  const seen: Record<string, number> = {};
  for (const r of rows) { seen[r.pos] = (seen[r.pos] || 0) + 1; r.posRank = seen[r.pos]; }
  return { rows, levels, dry, medBoost };
}

// ---- YOUR OWN LIST -------------------------------------------------------
// The board's order is the standard; a custom order is a list of ids laid over
// the top. Anyone not in the list keeps standard order behind those who are.

export function applyOrder<T extends { id: string }>(rows: T[], order: string[]): T[] {
  if (!order || !order.length) return rows;
  const rank = new Map(order.map((id, i) => [id, i]));
  return rows.slice().sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id)! : Infinity;
    return ra - rb;
  });
}

/** Move one id up (-1) or down (+1). Seeds the list from the shown order. */
export function moveInOrder(order: string[], shown: string[], id: string, delta: number): string[] {
  const base = order && order.length ? order.slice() : shown.slice();
  for (const s of shown) if (!base.includes(s)) base.push(s);
  const i = base.indexOf(id);
  if (i < 0) return base;
  const j = i + delta;
  if (j < 0 || j >= base.length) return base;
  [base[i], base[j]] = [base[j], base[i]];
  return base;
}

/** Which of the league's live scoring rules had NO projected stat behind them. */
export function coverage(
  scoring: Record<string, number>,
  lines: Array<Record<string, number>>,
): { scoredKeys: string[]; missing: string[] } {
  const seen = new Set<string>();
  for (const l of lines) for (const k in l) if (l[k]) seen.add(k);
  const scoredKeys = Object.keys(scoring).filter((k) => scoring[k]);
  return { scoredKeys, missing: scoredKeys.filter((k) => !seen.has(k)) };
}
