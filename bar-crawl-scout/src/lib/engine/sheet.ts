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
import { scoreStats, scoreStatsRaw } from './scoring';

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

/**
 * WHICH ADP SLEEPER IS ACTUALLY SHOWING YOU.
 *
 * Sleeper publishes a dozen average-draft-position columns and serves the one
 * that matches the league's FORMAT, so reading the wrong one shows a price no
 * manager in the room has ever seen. Ours starts an IDP_FLEX and exactly one
 * quarterback, and `adp_idp_1qb` reproduces the ADP column on our draft board
 * for every player checked — `adp_half_ppr`, the obvious guess, is out by four
 * to twenty places and would have invented a bargain on every row.
 *
 * Derived from the real roster_positions rather than hard-coded, so a format
 * change moves it. Falls back through the ordinary scoring families.
 */
export function adpKeyFor(rosterPositions: string[], scoring?: Record<string, number>): string {
  const slots = rosterPositions || [];
  const idp = slots.some((p) => SLOT_ELIGIBLE.IDP_FLEX?.includes(p) || p === 'IDP_FLEX');
  const superflex = slots.some((p) => p === 'SUPER_FLEX' || p === 'SUPERFLEX');
  const qbs = slots.filter((p) => p === 'QB').length;
  const twoQb = superflex || qbs > 1;
  if (idp) return twoQb ? 'adp_idp' : 'adp_idp_1qb';
  if (twoQb) return 'adp_2qb';
  const rec = scoring?.rec ?? 0.5;
  return rec >= 1 ? 'adp_ppr' : rec > 0 ? 'adp_half_ppr' : 'adp_std';
}


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
  /**
   * Where the market actually drafts him — Sleeper's `adp_half_ppr`. This is the
   * PRICE, and it is set by every league in the world rather than by ours, which
   * is the whole reason it can be wrong for us. Null/999 when unranked.
   */
  adp?: number | null;
  /**
   * The MAINSTREAM price — `adp_half_ppr`, the ADP the rest of the fantasy world
   * quotes. Not what our draft room shows, but the number every ranking, article
   * and mock you read outside Sleeper is talking about, so it is worth seeing
   * next to ours: the difference between the two is what our format alone does
   * to a man's price before anybody has scored a point.
   */
  adpMarket?: number | null;
  /** Full-PPR ADP. Our rules sit between the two, so both bracket the price. */
  adpPpr?: number | null;
  /**
   * A cross-site consensus ADP — FantasyPros, which aggregates ESPN, Yahoo, CBS
   * and NFL. Sleeper's API publishes only its own families, so this is the one
   * number on the board that is not Sleeper's opinion of itself.
   */
  adpConsensus?: number | null;
}

export interface SheetRow {
  id: string; name: string; pos: string; team: string;
  age: number | null; exp: number | null;
  games: number;

  // ---- the numbers the board is really about, all SEASON totals ----
  /**
   * SLEEPER'S OWN PROJECTION, league-scored — the exact number in the PTS
   * column of sleeper.com/draft. Sleeper applies the league's scoring_settings
   * itself, so this is not our interpretation of anything: it is what every
   * manager in the room is looking at, reproduced to the decimal.
   */
  sleeper: number;
  /**
   * The same player under STOCK half-PPR — Sleeper's published `pts_half_ppr`.
   * Nobody drafts off this in our room, but the whole market does, so it is
   * what ADP is built from and therefore what sets his price.
   */
  market: number;
  /** Where the market number came from — theirs, or ours when they publish none. */
  marketFrom: 'sleeper' | 'derived';
  /** sleeper - market. What our rulebook adds over the one ADP is priced on. */
  gap: number;
  /**
   * The part of that gain he does NOT share with everyone else. Our rules lift
   * the whole board about a quarter, so the raw gap is mostly tide; this is the
   * points he beats the tide by, and it is where ADP is actually wrong for us.
   */
  edgePts: number;
  /**
   * The one thing Sleeper's number CANNOT include: this league docks a point for
   * every fumble on top of the point for losing it, and no projection carries a
   * raw fumble count. Estimated from his own last season, always negative or
   * zero, and kept out of `sleeper` so that column stays exactly their number.
   */
  fumAdj: number;
  /** sleeper + fumAdj. The same board with that one rule put back. */
  adjusted: number;

  // ---- WHAT THE MARKET PAYS vs WHAT HE IS WORTH HERE ----
  /** Where he actually goes in OUR draft room's format. Null when unpriced. */
  adp: number | null;
  /** Where the mainstream half-PPR world drafts him. Null when unpriced. */
  adpMarket: number | null;
  /** Full-PPR ADP — the other side of the bracket our scoring sits inside. */
  adpPpr: number | null;
  /** FantasyPros consensus (ESPN/Yahoo/CBS/NFL). Null when he is off that board. */
  adpConsensus: number | null;
  /**
   * A 2026 rookie, from Sleeper's own `years_exp` rather than anybody's memory.
   * Checked against all twenty hand-tagged rookies on the board: twenty hits,
   * no false positives among the other hundred and eighty, and twenty-five more
   * the hand list had missed.
   */
  rookie: boolean;
  /** His rank by that price, among the men who have one. */
  adpRank: number | null;
  /** His rank by VORP, among the same men. */
  valueRank: number | null;
  /**
   * adpRank - valueRank. Positive means the market lets him last longer than he
   * is worth to us, which is the only kind of edge a draft board can actually
   * hand you: not a better projection, a cheaper price for the same one.
   */
  slip: number | null;
  /**
   * BY HOW MUCH, in points. At his price you are paying for the man the market
   * ranks alongside him; this is how much more VORP he actually gives you than
   * that man does. Positive means the pick wins you points, and it is the honest
   * size of the edge — a slip of forty places is worth nothing if the two men
   * are worth the same.
   */
  surplus: number | null;

  // ---- per game, and the internals the three numbers are built from ----
  ours: number;   // sleeper, per game — the rate behind the season total
  stock: number;  // ppg under the stock baseline (0 for defenders — no baseline exists)
  boost: number;  // sleeper/market - 1, or 0 when there is no baseline
  edge: number;   // boost measured against the league-wide median boost
  vorp: number;   // ppg over replacement level for his position
  vorpSeason: number; // that, across his projected games — the draft currency
  /** True when our own half-PPR re-score reproduces Sleeper's published total. */
  matchesSleeper: boolean;
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
  rows: Array<{ id?: string; pos: string; ours: number; partial?: boolean }>,
  rosterPositions: string[],
  teams: number,
  unavailable?: Set<string> | null,
): { levels: Record<string, number>; consumed: Record<string, number>; dry: string[] } {
  // Partial-season projections never set replacement — a 4-game line at a high
  // per-game rate would quietly move every VORP on the board.
  //
  // Neither do men who are already gone. This league keeps thirty, and they are
  // overwhelmingly backs and receivers, so the pool you are actually drafting
  // from is far thinner at those two positions than the world's is: RB and WR
  // replacement drop about 1.6 a game, a full 28 points across a season, while
  // QB and TE barely move because almost nobody keeps one. Filling the lineup
  // with players nobody can pick sets the bar where it would be in somebody
  // else's league and quietly understates every back and receiver on the board.
  const byPos: Record<string, number[]> = {};
  for (const r of rows) {
    if (r.partial) continue;
    if (unavailable && r.id && unavailable.has(r.id)) continue;
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
  unavailable?: Set<string> | null,
  adpCap = 300,
): { rows: SheetRow[]; levels: Record<string, number>; dry: string[]; medBoost: number; tide: number } {
  const scored = inputs.map((p) => {
    // SCORE THE RAW PROJECTION, exactly as Sleeper does.
    //
    // This used to score a BACKFILLED line — the projection with any scored stat
    // Sleeper omits filled in from the player's own last season — and that one
    // decision put the headline number out of step with the board every manager
    // in the league is actually looking at. Sleeper applies the league's
    // scoring_settings to its own projection and prints the result in the draft
    // room; scoring anything else means arguing with the number on the screen.
    // Josh Allen came out at 428 where his draft board says 435.3, and there was
    // no way to tell from the page which one to believe.
    //
    // So the headline is their line, their stats, the league's rules, and it
    // reproduces sleeper.com/draft to the decimal. See sheet-vs-sleeper.test.js,
    // which checks it against nine numbers read straight off that board.
    const sleeperSeason = scoreStatsRaw(p.proj || {}, scoring);
    const ours = p.games > 0 ? sleeperSeason / p.games : 0;
    const projPg = perGame(p.proj || {}, p.games);
    const stock = scoreStats(projPg, STOCK_SCORING);

    // THE ONE RULE NO PROJECTION CAN CARRY. This league docks a point for every
    // fumble as well as a point for losing it, and Sleeper projects only the
    // fumbles LOST — so its number quietly omits the rest of that penalty for
    // everybody. Estimated from the player's own last season at his projected
    // workload, kept in its own column, and never folded into the number above.
    const priorPg = p.prior && p.priorGames ? perGame(p.prior, p.priorGames) : null;
    const fumRate = priorPg && typeof priorPg.fum === 'number' ? priorPg.fum : 0;
    const fumAdj = Math.round(fumRate * p.games * (scoring.fum || 0) * 10) / 10;

    // WHAT THE MARKET IS PRICED ON. Sleeper's published half-PPR total, verbatim:
    // nobody in our room drafts off it, but every ADP in the world is built from
    // it, so it is what sets what a player costs.
    const published = Number(p.sleeperPts) > 0 ? Number(p.sleeperPts) : 0;
    const derived = Math.round(stock * p.games * 10) / 10;
    const market = published || derived;
    // toFixed, not Math.round: the sum lands on an exact half-tenth often enough
    // to matter, and rounding the binary approximation puts the last digit the
    // other way from the draft board on those. This reproduces all nine numbers
    // read off sleeper.com/draft.
    const sleeper = Number(sleeperSeason.toFixed(1));

    return {
      id: p.id, name: p.name, pos: p.pos, team: p.team,
      age: p.age ?? null, exp: p.exp ?? null,
      games: p.games, ours, stock, line: projPg, sleeper, market, fumAdj,
      // A PRICE, or nothing. Beyond the men who plausibly get drafted, Sleeper
      // fills the column with 600s, 700s and a flat 999 — placeholders, not
      // market reads. Ranking those alongside real prices handed the top of the
      // value list to players nobody has ever drafted: Rashod Bateman at "ADP
      // 700" came out two hundred places underpriced. The cap is twice the picks
      // in our own draft, which is past anywhere a real pick happens.
      adp: Number.isFinite(p.adp) && Number(p.adp) > 0 && Number(p.adp) <= adpCap ? Number(p.adp) : null,
      adpMarket: Number.isFinite(p.adpMarket) && Number(p.adpMarket) > 0 && Number(p.adpMarket) <= adpCap
        ? Number(p.adpMarket) : null,
      adpPpr: Number.isFinite(p.adpPpr) && Number(p.adpPpr) > 0 && Number(p.adpPpr) <= adpCap
        ? Number(p.adpPpr) : null,
      adpConsensus: Number.isFinite(p.adpConsensus) && Number(p.adpConsensus) > 0 ? Number(p.adpConsensus) : null,
      rookie: Number(p.exp) === 0,
      adjusted: Math.round((sleeper + fumAdj) * 10) / 10,
      marketFrom: (published ? 'sleeper' : 'derived') as 'sleeper' | 'derived',
      // Our half-PPR re-score should BE Sleeper's published one. Where it isn't,
      // the row says so rather than reporting a gap that is really a disagreement.
      matchesSleeper: !published || Math.abs(derived - published) <= 0.5,
      fd: Math.round(firstDownPoints(projPg, scoring) * 100) / 100,
      partial: p.games > 0 && p.games < fullGames * 0.75,
    };
  }).filter((r) => r.games > 0);

  // THE TIDE. Every player gains under this rulebook, so the median gain is the
  // thing to measure against — an edge is beating it, not merely having one.
  // Measured against what the league actually sees, so it is the same number
  // the Edge column is derived from. Defenders have no published baseline and
  // cannot set the tide.
  const withBase = scored.filter((r) => r.market > 0);
  const medBoost = median(withBase.map((r) => r.sleeper / r.market - 1));
  const tide = 1 + medBoost;

  const { levels, dry } = replacementLevels(scored, rosterPositions, teams, unavailable);

  const rows: SheetRow[] = scored.map((r) => {
    const vorp = r.ours - (levels[r.pos] ?? 0);
    return {
      ...r,
      gap: Math.round((r.sleeper - r.market) * 10) / 10,
      edgePts: edgePoints(r.sleeper, r.market, tide),
      boost: r.market > 0 ? r.sleeper / r.market - 1 : 0,
      edge: rulesEdge(r.sleeper, r.market, medBoost),
      vorp,
      // The draft currency. A man projected for nine games at a fine rate is
      // worth nine games of it, and the board has to rank him that way or it
      // sends you into round two chasing somebody who plays half a season.
      vorpSeason: Math.round(vorp * r.games * 10) / 10,
      posRank: 0, ovRank: 0, adpRank: null, valueRank: null, slip: null, surplus: null,
    };
  });

  rows.sort((a, b) => b.vorpSeason - a.vorpSeason);
  rows.forEach((r, i) => { r.ovRank = i + 1; });
  const seen: Record<string, number> = {};
  for (const r of rows) { seen[r.pos] = (seen[r.pos] || 0) + 1; r.posRank = seen[r.pos]; }

  // PRICE AGAINST VALUE. Both ranks are taken over the SAME set — the men the
  // market has a read on — because comparing a rank out of 300 with a rank out
  // of 500 would invent a slip for everybody in the lower half.
  const priced = rows.filter((r) => r.adp != null);
  priced.slice().sort((a, b) => (a.adp as number) - (b.adp as number))
    .forEach((r, i) => { r.adpRank = i + 1; });
  priced.slice().sort((a, b) => b.vorpSeason - a.vorpSeason)
    .forEach((r, i) => { r.valueRank = i + 1; });
  // What the market's price actually buys at that slot, so the gap can be stated
  // in points rather than in places.
  const valueOrder = priced.slice().sort((a, b) => b.vorpSeason - a.vorpSeason);
  for (const r of rows) {
    if (r.adpRank == null || r.valueRank == null) { r.slip = null; r.surplus = null; continue; }
    r.slip = r.adpRank - r.valueRank;
    const paidFor = valueOrder[r.adpRank - 1];
    r.surplus = paidFor ? Math.round((r.vorpSeason - paidFor.vorpSeason) * 10) / 10 : null;
  }
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
