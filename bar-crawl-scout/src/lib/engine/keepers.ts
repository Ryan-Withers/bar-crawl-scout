// THE KEEPER BOARD — the real 2026 draft, as it actually stands.
//
// This league keeps THREE and redrafts the rest: 10 teams x 15 roster spots is
// 150 picks, 30 of which are already spent on keepers. So the live draft is 120
// picks, and the app's whole job is to know exactly WHICH 120.
//
// The commissioner placed the keepers at the BOTTOM of the board, and that is
// where this gets interesting. "The bottom" is not "rounds 13-15", because
// bottom-round picks get traded like any other. Sleeper fills a manager's
// keepers into the LATEST picks he still OWNS, working upward — so a manager who
// traded his 15th away has a keeper sitting in round 12 instead, and the man who
// bought it carries two keepers in round 15.
//
// That is not a footnote. It means the live board is NOT "rounds 1-12":
//   - rounds 1-11 are wholly live (110 picks)
//   - round 12 is live EXCEPT the two managers who sold their 15th
//   - round 13 has two live picks left, owned by the two who bought them
//   - rounds 14-15 are entirely keepers
// Truncating at 12 rounds — which is what the mock draft used to do — hands two
// managers a pick they do not have and takes one off two others.
//
// Two sources, in order of trust:
//   1. The draft's own picks with is_keeper set. This is Sleeper's answer and
//      it is right by construction.
//   2. Failing that (the picks endpoint is empty until the commissioner assigns
//      them), DERIVE it: each roster's keepers land on the N highest-numbered
//      picks it owns. Verified against the real 2026 board — the rule reproduces
//      Sleeper's placement exactly for all ten managers, both bottom-trades
//      included. See tests/keepers.test.js.
//
// Pure module: no fetch, no DOM, no stores. Everything comes in as arguments.

export interface KeptMan {
  playerId: string;
  name: string;
  pos: string;
}

export interface BoardCell {
  round: number;
  pickNo: number;          // 1-based overall
  slot: number;            // 1-based draft slot
  handle: string;          // who owns this pick NOW
  via: string | null;      // the ORIGINAL owner, when the pick was traded
  keeper: KptOrNull;
}
type KptOrNull = KeptMan | null;

export interface KeeperBoard {
  teams: number;
  rounds: number;
  type: 'snake' | 'linear';
  cells: BoardCell[];
  /**
   * Where the keeper placement came from. 'board' is Sleeper's own, complete
   * answer; 'mixed' means it has placed SOME and the rest is worked out from
   * ownership; 'derived' is entirely ours; 'none' means nobody has kept yet.
   */
  source: 'board' | 'mixed' | 'derived' | 'none';
}

export interface SlotBoardLike {
  slotHandles: string[];
  overrides: Array<{ round: number; slot: number; handle: string }>;
  type: 'snake' | 'linear';
  /**
   * How many teams the DRAFT says it has. Falls back to slotHandles.length, but
   * do not rely on that: this league's 2025 draft_order carries nine entries for
   * a ten-team draft, and a missing top slot shortens the array silently, so a
   * board built on the array length would run nine columns wide and put every
   * pick after the first round in the wrong place.
   */
  teams?: number;
}

/** The column count to do snake arithmetic with. */
export const teamsOf = (sb: SlotBoardLike): number =>
  (Number.isFinite(sb.teams) && (sb.teams as number) > 0 ? (sb.teams as number) : sb.slotHandles.length);

// ---- snake geometry ----

/** The draft slot picking at position `idx` (0-based) of `round`. */
export function slotAt(round: number, idx: number, teams: number, type: 'snake' | 'linear' = 'snake'): number {
  return type === 'snake' && round % 2 === 0 ? teams - idx : idx + 1;
}

/** The overall pick number for a (round, slot). Inverse of slotAt. */
export function pickNoAt(round: number, slot: number, teams: number, type: 'snake' | 'linear' = 'snake'): number {
  const idx = type === 'snake' && round % 2 === 0 ? teams - slot : slot - 1;
  return (round - 1) * teams + idx + 1;
}

/** Human pick code: 3.07 for round 3, seventh pick of that round. */
export function pickCode(pickNo: number, teams: number): string {
  const r = Math.floor((pickNo - 1) / teams) + 1;
  const p = ((pickNo - 1) % teams) + 1;
  return `${r}.${String(p).padStart(2, '0')}`;
}

// ---- the board ----

/**
 * Every cell of the full draft, with traded-pick ownership resolved. Keepers are
 * not applied here — `keeperBoard` does that.
 */
export function allCells(sb: SlotBoardLike, rounds: number): BoardCell[] {
  const teams = teamsOf(sb);
  const ov = new Map(sb.overrides.map((o) => [`${o.round}:${o.slot}`, o.handle]));
  const cells: BoardCell[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (let idx = 0; idx < teams; idx++) {
      const slot = slotAt(round, idx, teams, sb.type);
      // A short draft_order leaves a seat with nobody in it. Say so in the cell
      // rather than emitting `undefined` and letting it surface as the string
      // "undefined" three components downstream.
      const base = sb.slotHandles[slot - 1] || `slot ${slot}`;
      const traded = ov.get(`${round}:${slot}`);
      cells.push({
        round,
        pickNo: (round - 1) * teams + idx + 1,
        slot,
        handle: traded ?? base,
        via: traded && traded !== base ? base : null,
        keeper: null,
      });
    }
  }
  return cells;
}

/**
 * Which picks each manager's keepers consume, DERIVED rather than read: the N
 * highest-numbered picks he still owns, N being how many he is keeping.
 *
 * This is the fallback for before the commissioner assigns keepers to the board
 * (the picks endpoint returns [] until then), and it is also the check on the
 * real thing. It returns pick numbers only — WHICH keeper sits in WHICH of a
 * manager's own bottom picks is Sleeper's arbitrary choice and changes nothing
 * about the live board.
 */
export function derivePlacement(cells: BoardCell[], counts: Record<string, number>): Set<number> {
  const byHandle: Record<string, number[]> = {};
  for (const c of cells) (byHandle[c.handle] = byHandle[c.handle] || []).push(c.pickNo);
  const out = new Set<number>();
  for (const [handle, picks] of Object.entries(byHandle)) {
    const n = Math.max(0, Math.min(counts[handle] || 0, picks.length));
    picks.sort((a, b) => b - a);
    for (let i = 0; i < n; i++) out.add(picks[i]);
  }
  return out;
}

export interface DraftPickLike {
  round?: number;
  pick_no?: number;
  roster_id?: number;
  player_id?: string;
  is_keeper?: boolean | null;
  metadata?: { first_name?: string; last_name?: string; position?: string } | null;
}

/**
 * The real board. Keeper placement is read off the draft's own is_keeper picks
 * when they exist, and derived from ownership when they do not.
 *
 * `ledger` is handle -> the men he is keeping (from rosters[].keepers, resolved
 * to names). It supplies the counts for the derived path and the names for both.
 */
export function keeperBoard(
  sb: SlotBoardLike | null | undefined,
  rounds: number,
  ledger: Record<string, KeptMan[]>,
  picks: DraftPickLike[] | null | undefined,
  rosterHandle: Record<number, string> = {},
): KeeperBoard | null {
  if (!sb || !Array.isArray(sb.slotHandles) || !sb.slotHandles.length) return null;
  if (!Number.isFinite(rounds) || rounds < 1) return null;
  const teams = teamsOf(sb);
  const cells = allCells(sb, rounds);
  const byPick = new Map(cells.map((c) => [c.pickNo, c]));

  const expected = Object.values(ledger || {}).reduce((n, men) => n + men.length, 0);

  // 1. Sleeper's own answer — but only when it is the WHOLE answer.
  //
  // The commissioner can assign keepers a team at a time, and one is_keeper pick
  // used to be enough to take this path. That reported a half-filled board as
  // fact: nine managers got no placement at all, their bottom picks stayed live,
  // and the page announced "3 spent on keepers and 147 live" with a straight
  // face. If the board disagrees with the roster ledger about how many men are
  // kept, the board is partial — take what it gives, derive the rest.
  const kept = (Array.isArray(picks) ? picks : []).filter((p) => p && p.is_keeper && Number.isFinite(p.pick_no));
  if (kept.length && (!expected || kept.length === expected)) {
    for (const p of kept) {
      const cell = byPick.get(p.pick_no as number);
      if (!cell) continue;
      const md = p.metadata || {};
      const name = [md.first_name, md.last_name].filter(Boolean).join(' ').trim();
      cell.keeper = {
        playerId: String(p.player_id ?? ''),
        name: name || String(p.player_id ?? ''),
        pos: md.position || '',
      };
      // The board is the authority on ownership too: a keeper pick names the
      // roster that made it, which settles any disagreement with our own
      // traded-pick arithmetic.
      const h = rosterHandle[p.roster_id as number];
      if (h) { cell.via = h === cell.handle ? cell.via : cell.handle; cell.handle = h; }
    }
    return { teams, rounds, type: sb.type, cells, source: 'board' };
  }

  // 2. Derive. Either nothing is on the board yet, or only part of it is — in
  // which case honour the placements Sleeper HAS made and work the rest out.
  const counts: Record<string, number> = {};
  for (const [h, men] of Object.entries(ledger || {})) counts[h] = men.length;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return { teams, rounds, type: sb.type, cells, source: 'none' };

  const placed = new Set<string>();
  for (const p of kept) {
    const cell = byPick.get(p.pick_no as number);
    if (!cell) continue;
    const md = p.metadata || {};
    const name = [md.first_name, md.last_name].filter(Boolean).join(' ').trim();
    cell.keeper = { playerId: String(p.player_id ?? ''), name: name || String(p.player_id ?? ''), pos: md.position || '' };
    const h = rosterHandle[p.roster_id as number] || cell.handle;
    placed.add(`${h}:${cell.keeper.playerId}`);
    counts[h] = Math.max(0, (counts[h] || 0) - 1);
  }

  const consumed = derivePlacement(cells.filter((c) => !c.keeper), counts);
  // Hand each manager his own men, deepest pick first — the order within his own
  // bottom picks is cosmetic, so we just need it to be stable.
  const queue: Record<string, KeptMan[]> = {};
  for (const [h, men] of Object.entries(ledger || {})) {
    queue[h] = men.filter((m) => !placed.has(`${h}:${m.playerId}`));
  }
  for (const c of cells) {
    if (c.keeper || !consumed.has(c.pickNo)) continue;
    const men = queue[c.handle];
    if (men && men.length) c.keeper = men.shift() as KeptMan;
  }
  return { teams, rounds, type: sb.type, cells, source: kept.length ? 'mixed' : 'derived' };
}

// ---- reading the board ----

export const liveCells = (b: KeeperBoard): BoardCell[] => b.cells.filter((c) => !c.keeper);
export const keeperCells = (b: KeeperBoard): BoardCell[] => b.cells.filter((c) => !!c.keeper);

/** A manager's live picks, in order. */
export const livePicksFor = (b: KeeperBoard, handle: string): BoardCell[] =>
  b.cells.filter((c) => !c.keeper && c.handle === handle);

/**
 * The live pick sequence as handles — exactly what the mock draft needs for
 * MockConfig.sequence. This is the fix for truncating at N rounds: the keeper
 * picks are removed where they ACTUALLY fall, so a man who sold his 15th loses
 * his 12th and the man who bought it keeps his 13th.
 */
export const liveSequence = (b: KeeperBoard): string[] => liveCells(b).map((c) => c.handle);

/** handle -> how many live picks he holds. */
export function livePickCounts(b: KeeperBoard): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of b.cells) if (!c.keeper) out[c.handle] = (out[c.handle] || 0) + 1;
  return out;
}

/** The rounds in which every single pick is live — the "clean" part of the board. */
export function fullyLiveRounds(b: KeeperBoard): number[] {
  const dirty = new Set(keeperCells(b).map((c) => c.round));
  const out: number[] = [];
  for (let r = 1; r <= b.rounds; r++) if (!dirty.has(r)) out.push(r);
  return out;
}

// ---- the ledger ----

export interface RosterLike {
  roster_id: number;
  owner_id: string;
  keepers?: string[] | null;
  players?: string[] | null;
}

/**
 * handle -> the three men he has locked, from rosters[].keepers. This is the
 * source that is right by construction: it is what Sleeper will enforce on draft
 * day, not a guess about what somebody said in the group chat.
 */
export function keeperLedger(
  rosters: RosterLike[] | null | undefined,
  userHandle: Record<string, string>,
  nameOf: (playerId: string) => { name: string; pos: string } | null,
): Record<string, KeptMan[]> {
  const out: Record<string, KeptMan[]> = {};
  for (const r of Array.isArray(rosters) ? rosters : []) {
    const h = userHandle[r.owner_id];
    if (!h) continue;
    out[h] = (r.keepers || []).map((id) => {
      const hit = nameOf(String(id));
      return { playerId: String(id), name: hit?.name || String(id), pos: hit?.pos || '' };
    });
  }
  return out;
}

/** Every player id kept by anyone — the set that must not appear in the pool. */
export function keptIds(ledger: Record<string, KeptMan[]>): Set<string> {
  const s = new Set<string>();
  for (const men of Object.values(ledger || {})) for (const m of men) s.add(m.playerId);
  return s;
}

/** Every player id kept by anyone, by NAME — for boards that key on names. */
export function keptNames(ledger: Record<string, KeptMan[]>): Set<string> {
  const s = new Set<string>();
  for (const men of Object.values(ledger || {})) for (const m of men) if (m.name) s.add(m.name);
  return s;
}

/**
 * Managers who have not locked the full complement yet. Empty means the league
 * is settled and the board can be trusted; anything else is a warning the UI
 * should show rather than quietly rounding off.
 */
export function incompleteKeepers(ledger: Record<string, KeptMan[]>, max: number): string[] {
  return Object.entries(ledger || {})
    .filter(([, men]) => men.length !== max)
    .map(([h]) => h)
    .sort();
}

// ---- the contract clock ----

/**
 * Everyone kept in a given season, straight off that season's draft: the picks
 * flagged is_keeper. The 2025 draft carries thirty of them, which is where the
 * hand-written KEPT2025 set in data.js came from — and having derived it once,
 * there is no reason to keep typing it.
 */
export function keptInSeason(picks: DraftPickLike[] | null | undefined): Set<string> {
  const s = new Set<string>();
  for (const p of Array.isArray(picks) ? picks : []) {
    if (p && p.is_keeper && p.player_id != null) s.add(String(p.player_id));
  }
  return s;
}

/** Who kept whom last season: player_id -> the roster that kept him. */
export function keeperOwners(picks: DraftPickLike[] | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of Array.isArray(picks) ? picks : []) {
    if (p && p.is_keeper && p.player_id != null && p.roster_id != null) out[String(p.player_id)] = p.roster_id;
  }
  return out;
}

export interface TenureOpts {
  /** How many straight years a man may be kept. This league runs two. */
  maxYears?: number;
  /**
   * Does a trade reset his clock?
   *
   * FALSE (the default, and what this app has always done) — tenure follows the
   * PLAYER: he was kept last season, so this is his last one, whoever holds him.
   * TRUE — tenure follows the player-and-manager pair, so a man who changed hands
   * starts again with his new owner.
   *
   * It is a league rule, not something Sleeper records, and it is worth real
   * money here: FOUR of the thirty keepers changed hands between last season and
   * this one — Achane, McCaffrey, Gibbs and Jefferson. Under the default all four
   * are final-year men whose 2027 value collapses to replacement. If the clock
   * actually resets on a trade, the app is badly under-pricing two of the best
   * assets in the league.
   */
  resetOnTrade?: boolean;
}

export interface Contract {
  playerId: string;
  name: string;
  /** Seasons he can still be kept, counting this one. 1 = last call. */
  yearsLeft: number;
  /** Was he kept last season at all? */
  repeat: boolean;
  /** Kept last season by SOMEBODY ELSE — the case the league rule decides. */
  changedHands: boolean;
}

/**
 * Contract state for one manager's keepers. `priorOwners` is last season's
 * player_id -> roster_id map; pass the CURRENT roster_id to spot a man who
 * changed hands.
 */
export function contracts(
  men: KeptMan[],
  priorOwners: Record<string, number>,
  rosterId: number,
  opts: TenureOpts = {},
): Contract[] {
  const maxYears = opts.maxYears ?? 2;
  return (men || []).map((m) => {
    const prior = priorOwners[m.playerId];
    const repeat = prior != null;
    const changedHands = repeat && prior !== rosterId;
    const spent = !repeat || (changedHands && opts.resetOnTrade) ? 0 : 1;
    return { playerId: m.playerId, name: m.name, yearsLeft: Math.max(1, maxYears - spent), repeat, changedHands };
  });
}

/**
 * The live sequence with each pick's REAL coordinates attached.
 *
 * The War Room's board used to place a pick by index arithmetic — round is
 * index/teams, column snakes on even rounds — which is exact for a uniform grid
 * and wrong for this one. The live board is ragged: round 12 has eight picks and
 * round 13 has two. Feeding it a 120-long sequence, 120 % 10 === 0, drew a
 * plausible 12x10 grid that quietly filed the two round-13 picks under other
 * managers' columns and labelled them 12.09 and 12.10.
 *
 * So the coordinates travel WITH the sequence rather than being re-derived from
 * its length.
 */
export const liveSequenceMeta = (b: KeeperBoard): Array<{ round: number; slot: number; pickNo: number; handle: string }> =>
  liveCells(b).map((c) => ({ round: c.round, slot: c.slot, pickNo: c.pickNo, handle: c.handle }));
