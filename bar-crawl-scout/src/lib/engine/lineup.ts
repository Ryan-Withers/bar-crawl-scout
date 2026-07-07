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

  // Start/sit: a benched player who out-projects a startable seat's occupant.
  const moves: LineupResult['moves'] = [];
  for (const b of bench) {
    let best: { seat: Seat; gain: number } | null = null;
    for (const s of seats) {
      if (!eligible(s.slot, b.pos)) continue;
      const cur = s.player ? s.player.proj : 0;
      const gain = Math.round((b.proj - cur) * 10) / 10;
      if (gain > 0 && (!best || gain > best.gain)) best = { seat: s, gain };
    }
    if (best) moves.push({ in: b.name, out: best.seat.player ? best.seat.player.name : '(empty)', slot: best.seat.slot, gain: best.gain });
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
