// THE WAR ROOM — mock draft engine. Pure, seeded, fully tested.
// Keepers never enter the pool; every other spot is drafted by bots with
// per-team personalities:
//   window 0..100 — 0 = win-now, 50 = balanced, 100 = future (value blend)
//   chaos  0..100 — 0 = by the book (always the top pick), 100 = wild
// Chaos works as a softmax temperature over the bot's top candidates, so a
// chaotic GM *usually* picks well but genuinely can do something stupid.
// Seeded RNG (state carried explicitly) => same seed, same draft, testable.

export interface MockPlayer {
  name: string;
  pos: string;                 // QB/RB/WR/TE/K/DEF
  team: string;
  bye: number;
  v: { winnow: number; balanced: number; future: number };
  stage?: string;              // rookie | yr2 | asc | prime | aging | fading | ''
}
export interface Persona { window: number; chaos: number }
export interface MockTeam {
  handle: string;
  team: string;
  persona: Persona;
  keepers: MockPlayer[];
  isUser?: boolean;
}
export interface MockConfig {
  teams: MockTeam[];
  order: string[];             // round-1 handle order; snakes each round
  slots: string[];             // league starting slots (QB,RB,RB,WR,WR,TE,FLEX,...)
  rosterSize: number;          // total roster spots incl. keepers
  seed: number;
  pool: MockPlayer[];          // available players (keepers are excluded again defensively)
  sequence?: string[];         // explicit pick sequence (real slot ownership incl. traded picks)
}
export interface MockPick {
  overall: number;
  round: number;
  handle: string;
  player: MockPlayer;
  boardRank: number;           // 1-based rank on the balanced board at draft start
}
export interface MockState {
  cfg: MockConfig;
  pool: MockPlayer[];
  rosters: Record<string, MockPlayer[]>;  // keepers + drafted, per handle
  log: MockPick[];
  seq: string[];               // the full snaking pick sequence of handles
  cursor: number;              // index into seq
  rng: number;                 // explicit RNG state (mulberry32)
  done: boolean;
}

// ---- seeded rng (mulberry32, state passed explicitly so drafts serialize) ----
export function rngNext(state: number): [number, number] {
  let t = (state + 0x6D2B79F5) | 0;
  let x = Math.imul(t ^ (t >>> 15), 1 | t);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return [((x ^ (x >>> 14)) >>> 0) / 4294967296, t];
}

// Board-cell display name: the surname, keeping generational suffixes attached
// ("Patrick Mahomes II" -> "Mahomes II", never a bare "II"/"Jr.").
const NAME_SUFFIX = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
export function shortName(full: string): string {
  const parts = String(full || '').trim().split(/\s+/);
  let i = parts.length - 1;
  while (i > 0 && NAME_SUFFIX.has(parts[i].toLowerCase())) i--;
  return parts.slice(i).join(' ');
}

export function shuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    const [r, ns] = rngNext(s); s = ns;
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- personality value blend ----
export function blendValue(p: MockPlayer, window: number): number {
  const w = Math.max(0, Math.min(100, window));
  if (w <= 50) { const t = w / 50; return p.v.winnow * (1 - t) + p.v.balanced * t; }
  const t = (w - 50) / 50; return p.v.balanced * (1 - t) + p.v.future * t;
}

// ---- roster-need model ----
const FLEX_ELIG: Record<string, string[]> = {
  FLEX: ['RB', 'WR', 'TE'], WRRB_FLEX: ['WR', 'RB'], REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'], SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
};
const CORE = new Set(['QB', 'RB', 'WR', 'TE']);

export function dedicatedCount(slots: string[], pos: string): number {
  return slots.filter((s) => s === pos).length;
}
function flexCount(slots: string[], pos: string): number {
  return slots.filter((s) => (FLEX_ELIG[s] || []).includes(pos)).length;
}

// How much a team wants `pos` right now: fills empty dedicated starters first,
// tolerates flex/bench depth, and hard-suppresses gross overstacking + early K/DEF.
export function needFactor(roster: MockPlayer[], slots: string[], pos: string): number {
  const have = roster.filter((p) => p.pos === pos).length;
  const dedicated = dedicatedCount(slots, pos);
  const flexes = flexCount(slots, pos);
  const coreUnfilled = [...CORE].some((c) => roster.filter((p) => p.pos === c).length < dedicatedCount(slots, c));
  if ((pos === 'K' || pos === 'DEF') && coreUnfilled) return 0.02; // nobody drafts a K in round 2
  const cap = dedicated + (flexes > 0 ? 1 : 0) + (CORE.has(pos) ? 2 : 1); // starters + a flex share + bench depth
  if (have < dedicated) return 1.2;      // starting hole: prioritise
  if (have < dedicated + (flexes > 0 ? 1 : 0)) return 1.0;
  if (have < cap) return 0.7;            // bench depth: fine, discounted
  return 0.05;                            // overstacked: only a lunatic (high chaos) would
}

// Positions whose DEDICATED starting slots are still unfilled.
export function unfilledStarters(roster: MockPlayer[], slots: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of slots) {
    if (FLEX_ELIG[s] || seen.has(s)) continue;
    seen.add(s);
    const need = dedicatedCount(slots, s) - roster.filter((p) => p.pos === s).length;
    for (let i = 0; i < need; i++) out.push(s);
  }
  return out;
}

// ---- draft construction ----
// Real-board sequence: base slot owners (index 0 = slot 1) snaked each round,
// with traded picks overriding who's on the clock at a given (round, slot).
// A team can own several picks in one round — e.g. Ryan holding 1.02 AND 1.04.
export function sequenceFromSlots(
  slotHandles: string[],
  overrides: Array<{ round: number; slot: number; handle: string }>,
  rounds: number,
  type: 'snake' | 'linear' = 'snake',
): string[] {
  const N = slotHandles.length;
  const ov = new Map(overrides.map((o) => [`${o.round}:${o.slot}`, o.handle]));
  const seq: string[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < N; i++) {
      const slot = type === 'snake' && r % 2 === 0 ? N - i : i + 1;
      seq.push(ov.get(`${r}:${slot}`) ?? slotHandles[slot - 1]);
    }
  }
  return seq;
}

export function buildSequence(cfg: MockConfig): string[] {
  if (cfg.sequence?.length) return cfg.sequence.slice();
  // Per-team pick counts can differ (a team with fewer keepers drafts more).
  const remaining: Record<string, number> = {};
  for (const t of cfg.teams) remaining[t.handle] = Math.max(0, cfg.rosterSize - t.keepers.length);
  const seq: string[] = [];
  let round = 0;
  while (Object.values(remaining).some((n) => n > 0)) {
    const order = round % 2 === 0 ? cfg.order : cfg.order.slice().reverse();
    for (const h of order) if (remaining[h] > 0) { seq.push(h); remaining[h] -= 1; }
    round += 1;
    if (round > 40) break; // safety: malformed config can't loop forever
  }
  return seq;
}

export function createMock(cfg: MockConfig): MockState {
  const kept = new Set(cfg.teams.flatMap((t) => t.keepers.map((k) => k.name)));
  const pool = cfg.pool.filter((p) => !kept.has(p.name)); // keepers NEVER draftable
  const rosters: Record<string, MockPlayer[]> = {};
  for (const t of cfg.teams) rosters[t.handle] = t.keepers.slice();
  return { cfg, pool, rosters, log: [], seq: buildSequence(cfg), cursor: 0, rng: cfg.seed | 0, done: false };
}

export const currentHandle = (s: MockState): string | null => (s.done ? null : s.seq[s.cursor] ?? null);
export const roundOf = (s: MockState, cursor = s.cursor): number =>
  Math.floor(cursor / s.cfg.order.length) + 1;

// The bot's choice for the team on the clock (does not mutate state).
export function botChoice(s: MockState): MockPlayer {
  const h = currentHandle(s);
  const team = s.cfg.teams.find((t) => t.handle === h)!;
  const roster = s.rosters[h!];
  const { window, chaos } = team.persona;

  // Endgame guard: if remaining picks are only just enough to fill dedicated
  // starting holes, restrict to those positions (even a maniac fields a full team).
  // Counted from the sequence itself — traded picks make per-team counts uneven.
  let remainingPicks = 0;
  for (let i = s.cursor; i < s.seq.length; i++) if (s.seq[i] === h) remainingPicks++;
  const holes = unfilledStarters(roster, s.cfg.slots);
  let candidates = s.pool;
  if (holes.length >= remainingPicks && holes.length > 0) {
    const needSet = new Set(holes);
    const restricted = s.pool.filter((p) => needSet.has(p.pos));
    if (restricted.length) candidates = restricted;
  }

  const scored = candidates
    .map((p) => ({ p, score: blendValue(p, window) * needFactor(roster, s.cfg.slots, p.pos) }))
    .sort((a, b) => b.score - a.score);

  if (chaos <= 0 || scored.length === 1) return scored[0].p;

  // Softmax over the top-K by score; temperature grows with chaos.
  const K = Math.min(scored.length, 3 + Math.ceil(chaos / 8));
  const top = scored.slice(0, K);
  const T = 1 + chaos * 0.6;
  const weights = top.map((c) => Math.exp((c.score - top[0].score) / T));
  const sum = weights.reduce((a, b) => a + b, 0);
  const [r] = rngNext(s.rng);
  let acc = 0;
  for (let i = 0; i < top.length; i++) {
    acc += weights[i] / sum;
    if (r <= acc) return top[i].p;
  }
  return top[top.length - 1].p;
}

// Advance one pick. `playerName` = the user's manual pick; omitted = bot picks.
// Returns a NEW state object (Svelte-friendly). Board ranks come from the
// balanced ordering of the ORIGINAL pool, fixed at creation via closure order.
export function makePick(s: MockState, playerName?: string): MockState {
  if (s.done) return s;
  const h = currentHandle(s)!;
  let player: MockPlayer;
  let rng = s.rng;
  if (playerName) {
    const found = s.pool.find((p) => p.name === playerName);
    if (!found) return s; // not in pool (already drafted / kept) — no-op
    player = found;
  } else {
    player = botChoice(s);
    [, rng] = rngNext(s.rng); // consume one draw per bot pick, chaotic or not
  }
  const boardRank = s.cfg.pool
    .slice()
    .sort((a, b) => b.v.balanced - a.v.balanced)
    .findIndex((p) => p.name === player.name) + 1;
  const pick: MockPick = { overall: s.log.length + 1, round: roundOf(s), handle: h, player, boardRank };
  const next: MockState = {
    ...s,
    rng,
    pool: s.pool.filter((p) => p.name !== player.name),
    rosters: { ...s.rosters, [h]: [...s.rosters[h], player] },
    log: [...s.log, pick],
    cursor: s.cursor + 1,
  };
  next.done = next.cursor >= next.seq.length;
  return next;
}

// Fast-forward the bots until it's the user's turn (or the draft ends).
export function simToUser(s: MockState): MockState {
  const user = s.cfg.teams.find((t) => t.isUser)?.handle;
  let st = s;
  let guard = st.seq.length + 1;
  while (!st.done && currentHandle(st) !== user && guard-- > 0) st = makePick(st);
  return st;
}

export function simToEnd(s: MockState): MockState {
  let st = s;
  let guard = st.seq.length + 1;
  while (!st.done && guard-- > 0) st = makePick(st);
  return st;
}

// ---- the group-chat recap ----
// A finished mock condensed into paste-ready banter. Pure: names, date and
// url come in as options so tests stay deterministic.
export function recapText(
  s: MockState,
  g: { rows: GradeRow[]; steals: MockPick[]; reaches: MockPick[] },
  opts: { nameOf?: (h: string) => string; seat?: string; when?: string; url?: string } = {},
): string {
  const nm = opts.nameOf || ((h: string) => h);
  const lines: string[] = [];
  lines.push(`🏈 THE WAR ROOM — mock draft${opts.when ? ` · ${opts.when}` : ''}`);
  const medals = ['🥇', '🥈', '🥉'];
  lines.push(g.rows.slice(0, 3).map((r, i) => `${medals[i]} ${nm(r.handle)} ${r.grade} (${r.total})`).join(' · '));
  if (opts.seat) {
    const mine = g.rows.find((r) => r.handle === opts.seat);
    const haul = s.log.filter((p) => p.handle === opts.seat).slice(0, 5).map((p) => shortName(p.player.name));
    if (mine) lines.push(`MY HAUL (${nm(opts.seat)} · ${mine.grade}): ${haul.join(', ')}${s.log.filter((p) => p.handle === opts.seat).length > 5 ? '…' : ''}`);
  }
  if (g.steals[0]) lines.push(`💎 Steal of the draft: ${g.steals[0].player.name} to ${nm(g.steals[0].handle)} @ pick ${g.steals[0].overall} (board #${g.steals[0].boardRank})`);
  if (g.reaches[0]) lines.push(`🚨 Reach of the draft: ${g.reaches[0].player.name} by ${nm(g.reaches[0].handle)} @ pick ${g.reaches[0].overall} (board #${g.reaches[0].boardRank})`);
  if (opts.url) lines.push(`Run yours: ${opts.url}`);
  return lines.join('\n');
}

// ---- the debrief ----
export interface GradeRow {
  handle: string;
  team: string;
  total: number;        // balanced value of DRAFTED players (keepers excluded)
  winnow: number;
  future: number;
  lean: 'WIN-NOW' | 'FUTURE' | 'BALANCED';
  posCounts: Record<string, number>;
  grade: string;
}
const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'];

export function gradeMock(s: MockState): { rows: GradeRow[]; steals: MockPick[]; reaches: MockPick[] } {
  const rows: GradeRow[] = s.cfg.teams.map((t) => {
    const drafted = s.log.filter((p) => p.handle === t.handle).map((p) => p.player);
    const total = Math.round(drafted.reduce((a, p) => a + p.v.balanced, 0));
    const winnow = Math.round(drafted.reduce((a, p) => a + p.v.winnow, 0));
    const future = Math.round(drafted.reduce((a, p) => a + p.v.future, 0));
    const leanPct = winnow + future > 0 ? winnow / (winnow + future) : 0.5;
    const posCounts: Record<string, number> = {};
    for (const p of drafted) posCounts[p.pos] = (posCounts[p.pos] || 0) + 1;
    return {
      handle: t.handle, team: t.team, total, winnow, future,
      lean: leanPct > 0.56 ? 'WIN-NOW' : leanPct < 0.44 ? 'FUTURE' : 'BALANCED',
      posCounts, grade: '',
    };
  }).sort((a, b) => b.total - a.total);
  rows.forEach((r, i) => { r.grade = GRADES[Math.min(GRADES.length - 1, Math.floor((i / rows.length) * GRADES.length))]; });

  // Steal = drafted far later than his board rank; reach = far earlier.
  const withDelta = s.log.map((p) => ({ ...p, delta: p.overall - p.boardRank }));
  const steals = withDelta.filter((p) => p.delta >= 8).sort((a, b) => b.delta - a.delta).slice(0, 8);
  const reaches = withDelta.filter((p) => p.delta <= -8).sort((a, b) => a.delta - b.delta).slice(0, 8);
  return { rows, steals, reaches };
}

// ============================================================================
// THE DRAFT ROOM — pure helpers behind the live room (queue, undo, tiers,
// clock, lineup, pacing). Everything below is a pure function of its inputs so
// the room can be rebuilt, replayed and unit-tested without a browser.
// ============================================================================

// ---- pick codes: overall 4 in a 10-team room reads "1.04" ----
export function pickCode(overall: number, teams: number): string {
  if (!Number.isFinite(overall) || overall < 1) return '';
  if (!teams || teams < 1) return String(overall);
  const round = Math.floor((overall - 1) / teams) + 1;
  const slot = ((overall - 1) % teams) + 1;
  return `${round}.${String(slot).padStart(2, '0')}`;
}

// ---- stable DOM/test ids from player names ----
export function slugify(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ---- MY QUEUE ----------------------------------------------------------
// The queue is just an ordered list of names. Nothing is removed when a player
// gets sniped — resolution simply skips anyone no longer in the pool, so the
// user's ranking survives the draft chewing through it.
export function queueTop(pool: MockPlayer[], queue: string[]): string | null {
  const avail = new Set(pool.map((p) => p.name));
  for (const n of queue) if (avail.has(n)) return n;
  return null;
}

// What AUTOPICK (and an expired pick clock) actually takes: the top queued
// player still on the board, else the room's own best available for that seat.
export function autoPickName(s: MockState, queue: string[] = []): string | null {
  if (s.done || !s.pool.length) return null;
  return queueTop(s.pool, queue) ?? botChoice(s).name;
}

export function toggleQueued(queue: string[], name: string): string[] {
  return queue.includes(name) ? queue.filter((n) => n !== name) : [...queue, name];
}

export function moveQueued(queue: string[], index: number, delta: number): string[] {
  const j = index + delta;
  if (index < 0 || index >= queue.length || j < 0 || j >= queue.length) return queue;
  const out = queue.slice();
  [out[index], out[j]] = [out[j], out[index]];
  return out;
}

// Drop everyone already off the board (used by "tidy queue").
export function pruneQueue(queue: string[], pool: MockPlayer[]): string[] {
  const avail = new Set(pool.map((p) => p.name));
  return queue.filter((n) => avail.has(n));
}

// ---- UNDO — a mock is practice, so every pick is reversible -------------
// The component snapshots the state BEFORE each pick; undo just walks back.
export function pushSnapshot(stack: MockState[], s: MockState, limit = 400): MockState[] {
  const next = [...stack, s];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function undoLast(stack: MockState[]): { stack: MockState[]; state: MockState | null } {
  if (!stack.length) return { stack, state: null };
  return { stack: stack.slice(0, -1), state: stack[stack.length - 1] };
}

// Undo everything back to the last time `handle` was on the clock — the real
// "I want that pick back" after three bots have already fired.
export function rewindToHandle(stack: MockState[], handle: string): { stack: MockState[]; state: MockState | null } {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (currentHandle(stack[i]) === handle) return { stack: stack.slice(0, i), state: stack[i] };
  }
  return { stack, state: null };
}

// ---- TIER BREAKS — where the board falls off a cliff --------------------
// Indices that START a new tier: a gap that is both absolutely meaningful
// (>= minGap) and much bigger than the typical step (>= sensitivity x mean).
export function tierBreaks(values: number[], sensitivity = 1.7, minGap = 2): number[] {
  if (values.length < 2) return [];
  const gaps: number[] = [];
  for (let i = 1; i < values.length; i++) gaps.push(Math.max(0, values[i - 1] - values[i]));
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const g = values[i - 1] - values[i];
    if (g >= minGap && g >= sensitivity * avg) out.push(i);
  }
  return out;
}

// 1-based tier number for every row, derived from the same breaks.
export function tiersOf(values: number[], sensitivity = 1.7, minGap = 2): number[] {
  const breaks = new Set(tierBreaks(values, sensitivity, minGap));
  let t = 1;
  return values.map((_, i) => { if (breaks.has(i)) t += 1; return t; });
}

// ---- THE PICK CLOCK ----------------------------------------------------
export type ClockPhase = 'off' | 'calm' | 'warn' | 'urgent' | 'expired';
export function clockPhase(secondsLeft: number, len: number): ClockPhase {
  if (!len || len <= 0) return 'off';
  if (secondsLeft <= 0) return 'expired';
  if (secondsLeft <= 5) return 'urgent';
  if (secondsLeft <= 15) return 'warn';
  return 'calm';
}
export function fmtClock(s: number): string {
  const n = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

// ---- YOUR FOCUS — the win-now/future dial as three plain choices --------
// The persona `window` stays the single source of truth (0 = win-now,
// 50 = balanced, 100 = future) so the lobby slider and the three buttons can
// never disagree; these just translate between the two.
export type Focus = 'winnow' | 'balanced' | 'future';
export const FOCUS_ORDER: Focus[] = ['winnow', 'balanced', 'future'];
export const FOCUS_LABEL: Record<Focus, string> = { winnow: 'Win now', balanced: 'Balanced', future: 'Future' };
const FOCUS_W: Record<Focus, number> = { winnow: 0, balanced: 50, future: 100 };

export function focusWindow(f: string): number {
  return FOCUS_W[f as Focus] ?? 50;
}
/** Which of the three a given dial position reads as — a dragged slider still
 *  lights the right button. */
export function focusOf(window: number): Focus {
  const w = Math.max(0, Math.min(100, window ?? 50));
  return w < 34 ? 'winnow' : w > 66 ? 'future' : 'balanced';
}

// ---- POOL FILTERS ------------------------------------------------------
/** Every position this league's FLEX-type slots will accept, in CORE order. */
export function flexPositions(slots: string[]): string[] {
  const hit = new Set<string>();
  for (const s of slots || []) for (const p of FLEX_ELIG[s] || []) hit.add(p);
  return ['QB', 'RB', 'WR', 'TE'].filter((p) => hit.has(p));
}

/**
 * A first-year player. The board already stages every player (rookie/yr2/asc/
 * prime/aging/fading) and prices them off it — a rookie is marked 0.70 on 2026
 * and 1.10 on 2027, which is exactly why they sit low on a win-now board and
 * climb on a future one. This is the single place that decides what counts.
 */
export const isRookie = (p: MockPlayer): boolean => p?.stage === 'rookie';

export interface PoolFilter {
  pos?: string;            // 'ALL' | a position | 'FLX'
  flex?: string[];         // what FLX accepts in this league
  needs?: string[];        // positions that would fill a starting seat
  onlyNeeds?: boolean;
  rookiesOnly?: boolean;
  q?: string;              // name or team
}

/**
 * Every pool filter in one place, ANDed together, so "rookie RBs who'd fill a
 * starting seat" is a thing you can actually ask for. Search deliberately does
 * NOT match position any more — that's what the buttons are for.
 */
export function filterPool(pool: MockPlayer[], f: PoolFilter = {}): MockPlayer[] {
  const pos = f.pos || 'ALL';
  const flex = new Set(f.flex || []);
  const needs = new Set(f.needs || []);
  const needle = (f.q || '').trim().toLowerCase();
  return (pool || []).filter((p) => {
    if (pos === 'FLX') { if (!flex.has(p.pos)) return false; }
    else if (pos !== 'ALL' && p.pos !== pos) return false;
    if (f.onlyNeeds && !needs.has(p.pos)) return false;
    if (f.rookiesOnly && !isRookie(p)) return false;
    if (needle && !p.name.toLowerCase().includes(needle) && p.team.toLowerCase() !== needle) return false;
    return true;
  });
}

/**
 * Positions that would fill a starting seat you haven't filled yet — dedicated
 * holes plus, for any empty flex seat, everything eligible for it. Runs off
 * fillSlots so it agrees exactly with the lineup the roster panel draws.
 */
export function needPositions(roster: MockPlayer[], slots: string[]): string[] {
  const { starters } = fillSlots(roster, slots);
  const hit = new Set<string>();
  for (const s of starters) {
    if (s.player) continue;
    const elig = FLEX_ELIG[s.slot];
    if (elig) for (const p of elig) hit.add(p);
    else hit.add(s.slot);
  }
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].filter((p) => hit.has(p));
}

// ---- GM personality in plain English -----------------------------------
export function personaPhrase(p: Persona): string {
  const w = Math.max(0, Math.min(100, p?.window ?? 50));
  const c = Math.max(0, Math.min(100, p?.chaos ?? 50));
  const win = w <= 15 ? 'Win-now' : w <= 40 ? 'Lean win-now' : w <= 60 ? 'Balanced' : w <= 85 ? 'Lean future' : 'Future-first';
  const cha = c <= 10 ? 'by the book' : c <= 35 ? 'mostly disciplined' : c <= 65 ? 'keeps you guessing' : c <= 85 ? 'unpredictable' : 'total chaos';
  return `${win} · ${cha}`;
}

// ---- "you're up in 6 picks" --------------------------------------------
// Picks between now and this handle's next turn. 0 = on the clock, -1 = done.
export function picksUntil(s: MockState, handle: string): number {
  if (s.done) return -1;
  for (let i = s.cursor; i < s.seq.length; i++) if (s.seq[i] === handle) return i - s.cursor;
  return -1;
}
// The overall pick number of that next turn (1-based), 0 when there isn't one.
export function nextPickOverall(s: MockState, handle: string): number {
  const d = picksUntil(s, handle);
  return d < 0 ? 0 : s.cursor + d + 1;
}

// ---- THE LINEUP — which drafted players actually start ------------------
export interface SlotFill { slot: string; player: MockPlayer | null }
// Greedy and honest: dedicated slots claim their best man first, flex slots
// then take the best eligible leftover. Order of the returned slots matches
// the league's own slot list, so the panel reads like the lineup page.
export function fillSlots(roster: MockPlayer[], slots: string[]): { starters: SlotFill[]; bench: MockPlayer[] } {
  const pool = roster.slice().sort((a, b) => b.v.balanced - a.v.balanced);
  const used = new Set<MockPlayer>();
  const starters: SlotFill[] = slots.map((slot) => ({ slot, player: null }));
  const take = (ok: (p: MockPlayer) => boolean): MockPlayer | null => {
    for (const p of pool) if (!used.has(p) && ok(p)) { used.add(p); return p; }
    return null;
  };
  slots.forEach((slot, i) => { if (!FLEX_ELIG[slot]) starters[i].player = take((p) => p.pos === slot); });
  slots.forEach((slot, i) => {
    const elig = FLEX_ELIG[slot];
    if (elig) starters[i].player = take((p) => elig.includes(p.pos));
  });
  return { starters, bench: pool.filter((p) => !used.has(p)) };
}
