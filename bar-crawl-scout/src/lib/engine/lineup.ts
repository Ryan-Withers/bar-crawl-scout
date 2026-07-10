// LINEUP — set the optimal starting lineup from a roster + the league's slots,
// and flag bye-week holes. Greedy fill most-restrictive slot first (dedicated
// positions before FLEX), highest projection wins each seat. Pure + tested.
// `proj` is whatever ranking you feed it — live weekly projection in-season,
// season value in the offseason.

export interface RosterPlayer {
  name: string;
  pos: string;      // QB/RB/WR/TE/K/DEF
  team: string;
  proj: number;     // higher = start
  bye: number;      // 0 = unknown
  starter?: boolean;// currently in your Sleeper starting lineup
}

export interface Seat {
  slot: string;     // QB, RB, WR, TE, FLEX, SUPER_FLEX, K, DEF...
  player: RosterPlayer | null;
}

export interface LineupResult {
  seats: Seat[];
  bench: RosterPlayer[];
  moves: Array<{ in: string; out: string; slot: string; gain: number }>; // start/sit suggestions
}

const ELIG: Record<string, string[]> = {
  QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], K: ['K'], DEF: ['DEF', 'DST'],
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['WR', 'RB'], REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'], SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
  IDP_FLEX: ['DL', 'LB', 'DB'],
};
const eligible = (slot: string, pos: string) => (ELIG[slot] || [slot]).includes(pos);

// Fill the optimal lineup. `slots` is the flat list of starting slots (e.g.
// ['QB','RB','RB','WR','WR','TE','FLEX','K','DEF']).
export function optimalLineup(players: RosterPlayer[], slots: string[]): LineupResult {
  const pool = players.slice().sort((a, b) => b.proj - a.proj);
  const used = new Set<RosterPlayer>();

  // Assign the most restrictive slots first so FLEX gets the leftovers.
  const order = slots
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => (ELIG[a.slot] || [a.slot]).length - (ELIG[b.slot] || [b.slot]).length || a.i - b.i);

  const filled: Record<number, Seat> = {};
  for (const { slot, i } of order) {
    const pick = pool.find((p) => !used.has(p) && eligible(slot, p.pos)) || null;
    if (pick) used.add(pick);
    filled[i] = { slot, player: pick };
  }
  const seats: Seat[] = slots.map((_, i) => filled[i]);
  const bench = pool.filter((p) => !used.has(p));

  // Start/sit vs your CURRENT Sleeper lineup (the `starter` flags): the optimal
  // starters you're currently benching, matched against the current starters the
  // optimizer would sit. If no `starter` flags are set, there's nothing to compare.
  const inOptimal = new Set(seats.map((s) => s.player).filter((p): p is RosterPlayer => !!p));
  const shouldStart = seats
    .map((s) => ({ seat: s, p: s.player }))
    .filter((x) => x.p && x.p.starter === false)
    .sort((a, b) => (b.p!.proj) - (a.p!.proj));
  const shouldSit = players
    .filter((p) => p.starter === true && !inOptimal.has(p))
    .sort((a, b) => a.proj - b.proj);

  // Pair each entering player with the sitting player they actually displace —
  // NEVER by list index (that produced illegal pairs like "TE over WR @ TE").
  // 1. Same position first: a WR coming in sits the worst WR going out, at the
  //    seat the newcomer takes.
  // 2. Cross-position leftovers displace each other through the flex chain, so
  //    pair them at a slot BOTH are eligible for (FLEX/SUPER_FLEX), worst out first.
  const moves: LineupResult['moves'] = [];
  const remaining = shouldSit.slice(); // proj asc — worst sitters matched first
  const push = (p: RosterPlayer, out: RosterPlayer | undefined, slot: string) => {
    moves.push({ in: p.name, out: out ? out.name : '(bench)', slot, gain: Math.round((p.proj - (out ? out.proj : 0)) * 10) / 10 });
  };
  const leftovers: Array<{ seat: Seat; p: RosterPlayer }> = [];
  for (const x of shouldStart) {
    if (!x.p) continue;
    const j = remaining.findIndex((o) => o.pos === x.p!.pos);
    if (j >= 0) push(x.p, remaining.splice(j, 1)[0], x.seat.slot);
    else leftovers.push({ seat: x.seat, p: x.p });
  }
  for (const x of leftovers) {
    const j = remaining.findIndex((o) => slots.some((s) => eligible(s, o.pos) && eligible(s, x.p.pos)));
    if (j < 0) { push(x.p, undefined, x.seat.slot); continue; }
    const out = remaining.splice(j, 1)[0];
    // Label with the shared slot the swap flows through (the flex), not the
    // dedicated seat the newcomer occupies.
    const shared = slots.find((s) => eligible(s, out.pos) && eligible(s, x.p.pos)) || x.seat.slot;
    push(x.p, out, shared);
  }
  moves.sort((a, b) => b.gain - a.gain);
  return { seats, bench, moves };
}

// Players on bye this week who are in the starting seats — holes to patch.
export function byeHoles(seats: Seat[], week: number): RosterPlayer[] {
  return seats
    .map((s) => s.player)
    .filter((p): p is RosterPlayer => !!p && p.bye === week && week > 0);
}
