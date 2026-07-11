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
