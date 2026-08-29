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

/**
 * A stock half-PPR rulebook — the baseline every public ranking assumes, and
 * the one Sleeper's own published `pts_half_ppr` is computed under.
 *
 * pass_int is MINUS ONE and that is not a preference. It read -2 here, copied
 * across from our own league, and the error was invisible because it only bites
 * quarterbacks: every one of the forty-two projected QBs came out eight to
 * fourteen points light against the number Sleeper puts on his card, which made
 * their "boost" under our rules look bigger than it is. Solving Sleeper's
 * published total for the interception weight gives exactly -1.000 for all
 * forty-two, and with that one change this table reproduces their number to the
 * decimal for 299 of the 300 players who have one. See sheet-vs-sleeper.test.js,
 * which asserts that agreement against the captured projections rather than
 * trusting this comment.
 */
export const STOCK_SCORING: Record<string, number> = {
  pass_yd: 0.04, pass_td: 4, pass_int: -1, pass_2pt: 2,
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
  /**
   * Sleeper's OWN published half-PPR season total (`pts_half_ppr`), verbatim.
   * This is the number on the player's card — what everyone else in the league
   * is looking at — so it is carried through rather than re-derived. 0 or
   * undefined when Sleeper publishes none (retired players, mostly).
   */
  sleeperPts?: number | null;
}

export interface SheetRow {
  id: string; name: string; pos: string; team: string;
  age: number | null; exp: number | null;
  games: number;

  // ---- the three numbers the board is really about, all SEASON totals ----
  /** What everyone else sees: Sleeper's own published half-PPR season total. */
  theirs: number;
  /** Where it came from — Sleeper's number, or ours when they publish none. */
  theirsFrom: 'sleeper' | 'derived';
  /** What he is really worth: season points under THIS league's rulebook. */
  real: number;
  /** real - theirs. The raw points this rulebook hands him. */
  gap: number;
  /**
   * The part of that gap he does NOT share with everyone else. This rulebook
   * inflates the whole board, so the raw gap is mostly tide; this is the points
   * he beats the tide by, and it is the column worth sorting on.
   */
  edgePts: number;

  // ---- per game, and the internals the three numbers are built from ----
  ours: number;   // ppg under the league's rules
  stock: number;  // ppg under the stock baseline (0 for defenders — no baseline exists)
  boost: number;  // real/theirs - 1, or 0 when there is no baseline
  edge: number;   // boost measured against the league-wide median boost
  vorp: number;   // ppg over replacement level for his position
  vorpSeason: number; // that, across his projected games — the draft currency
  /** True when our own half-PPR re-score reproduces Sleeper's published total. */
  matchesSleeper: boolean;
  /** How many scored rules Sleeper omitted and we filled from his prior season. */
  filled: number;
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

/**
 * The same thing in POINTS, which is the form you can actually act on.
 *
 * Everyone gains from this rulebook, so `real - theirs` mostly measures the
 * tide. Multiply what the league sees by the tide to get what he was always
 * going to be worth here, and the remainder is what he beats the room by —
 * in the same units as every other number on the row.
 */
export function edgePoints(real: number, theirs: number, tide: number): number {
  if (!theirs || theirs <= 0) return 0;
  return Math.round((real - theirs * tide) * 10) / 10;
}

/** Build the whole board. One pass, so every number on a row agrees. */
export function buildSheet(
  inputs: SheetInput[],
  scoring: Record<string, number>,
  rosterPositions: string[],
  teams: number,
  fullGames = 17,
): { rows: SheetRow[]; levels: Record<string, number>; dry: string[]; medBoost: number; tide: number } {
  const scored = inputs.map((p) => {
    const projPg = perGame(p.proj || {}, p.games);
    const priorPg = p.prior && p.priorGames ? perGame(p.prior, p.priorGames) : null;
    const { line, filled } = backfill(projPg, priorPg, scoring);
    const ours = scoreStats(line, scoring);
    const stock = scoreStats(line, STOCK_SCORING);
    // The agreement check has to score the line Sleeper ACTUALLY scored — the
    // raw projection, before we fill any gap from last season. Comparing the
    // backfilled line instead measured our own backfill and reported a fifth of
    // the board as disagreeing with Sleeper when the baseline is exact.
    const stockRaw = scoreStats(projPg, STOCK_SCORING);

    // WHAT THE ROOM SEES. Sleeper's own published half-PPR total, verbatim,
    // because the whole point of the column is that it is THEIR number and not
    // a re-derivation of it. When they publish none — retired men, almost
    // always — fall back to our own half-PPR re-score and say so, rather than
    // showing a blank where a comparison should be.
    const published = Number(p.sleeperPts) > 0 ? Number(p.sleeperPts) : 0;
    const derived = Math.round(stock * p.games * 10) / 10;
    const theirs = published || derived;
    const real = Math.round(ours * p.games * 10) / 10;

    return {
      id: p.id, name: p.name, pos: p.pos, team: p.team,
      age: p.age ?? null, exp: p.exp ?? null,
      games: p.games, ours, stock, line, real, theirs,
      theirsFrom: (published ? 'sleeper' : 'derived') as 'sleeper' | 'derived',
      // Our baseline should BE their baseline. Where it isn't, the row says so
      // rather than quietly reporting an edge that is really a disagreement.
      matchesSleeper: !published || Math.abs(stockRaw * p.games - published) <= 0.5,
      // Which of the league's scored rules Sleeper left out of his projection
      // and we filled from his own prior season. It moves `real` and nothing
      // else, and the page says how many rows it touched.
      filled: filled.length,
      fd: Math.round(firstDownPoints(line, scoring) * 100) / 100,
      partial: p.games > 0 && p.games < fullGames * 0.75,
    };
  }).filter((r) => r.games > 0);

  // THE TIDE. Every player gains under this rulebook, so the median gain is the
  // thing to measure against — an edge is beating it, not merely having one.
  // Measured against what the league actually sees, so it is the same number
  // the Edge column is derived from. Defenders have no published baseline and
  // cannot set the tide.
  const withBase = scored.filter((r) => r.theirs > 0);
  const medBoost = median(withBase.map((r) => r.real / r.theirs - 1));
  const tide = 1 + medBoost;

  const { levels, dry } = replacementLevels(scored, rosterPositions, teams);

  const rows: SheetRow[] = scored.map((r) => {
    const vorp = r.ours - (levels[r.pos] ?? 0);
    return {
      ...r,
      gap: Math.round((r.real - r.theirs) * 10) / 10,
      edgePts: edgePoints(r.real, r.theirs, tide),
      boost: r.theirs > 0 ? r.real / r.theirs - 1 : 0,
      edge: rulesEdge(r.real, r.theirs, medBoost),
      vorp,
      // The draft currency. A man projected for nine games at a fine rate is
      // worth nine games of it, and the board has to rank him that way or it
      // sends you into round two chasing somebody who plays half a season.
      vorpSeason: Math.round(vorp * r.games * 10) / 10,
      posRank: 0, ovRank: 0,
    };
  });

  rows.sort((a, b) => b.vorpSeason - a.vorpSeason);
  rows.forEach((r, i) => { r.ovRank = i + 1; });
  const seen: Record<string, number> = {};
  for (const r of rows) { seen[r.pos] = (seen[r.pos] || 0) + 1; r.posRank = seen[r.pos]; }
  return { rows, levels, dry, medBoost, tide };
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
/**
 * Nudge one man up or down YOUR order.
 *
 * `all` is the whole board in its current order; `shown` is what is on screen
 * after the filters, in display order. Both are needed and for different reasons.
 *
 * Seeding the saved order from `shown` alone was the bug: tab to QB, nudge one
 * quarterback, and the order became the 42 visible QB ids — so applyOrder then
 * hoisted every quarterback above every back and receiver on the ALL board. The
 * user asked to move one player one row and re-ranked the entire draft.
 *
 * And a move on a filtered view swaps him with his neighbour AMONG THE SHOWN —
 * "up" on the QB tab means above the next quarterback, not above whoever happens
 * to sit one row up on the unfiltered board.
 */
export function moveInOrder(order: string[], all: string[], shown: string[], id: string, delta: number): string[] {
  const seed = order && order.length ? order.slice() : (all && all.length ? all.slice() : shown.slice());
  const base = seed.slice();
  for (const s of all || []) if (!base.includes(s)) base.push(s);
  for (const s of shown) if (!base.includes(s)) base.push(s);

  // The neighbour is the next VISIBLE man in that direction.
  const visible = shown.filter((x) => base.includes(x));
  const vi = visible.indexOf(id);
  if (vi < 0) return base;
  const vj = vi + delta;
  if (vj < 0 || vj >= visible.length) return base;

  const i = base.indexOf(id);
  const j = base.indexOf(visible[vj]);
  if (i < 0 || j < 0) return base;
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
