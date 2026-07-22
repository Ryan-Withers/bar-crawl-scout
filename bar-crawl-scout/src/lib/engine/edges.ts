// POSITIONAL EDGES — where a head-to-head is actually won. Buckets each side's
// optimal-lineup seats by slot and diffs the projected points, so you can see
// you're +12 at RB but bleeding it back at WR. Pure + known-answer tested.

export interface Seat { slot: string; player: { proj: number } }

export interface Edge {
  pos: string;
  mine: number;    // my projected points at this slot
  theirs: number;  // opponent's
  edge: number;    // mine - theirs (1 dp; + favours you)
}

// Canonical lineup order; anything unrecognised falls to the end in first-seen order.
const ORDER = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'WRRB_FLEX', 'REC_FLEX', 'SUPER_FLEX', 'K', 'DEF'];
const r1 = (n: number) => Math.round(n * 10) / 10;

function sumBySlot(seats: Seat[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of seats || []) {
    if (!s || !s.player) continue;
    m[s.slot] = (m[s.slot] || 0) + (s.player.proj || 0);
  }
  return m;
}

export function positionalEdges(mine: Seat[], theirs: Seat[]): Edge[] {
  const a = sumBySlot(mine);
  const b = sumBySlot(theirs);
  const slots = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  slots.sort((x, y) => {
    const ix = ORDER.indexOf(x); const iy = ORDER.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });
  return slots.map((pos) => {
    const mineV = r1(a[pos] || 0);
    const theirsV = r1(b[pos] || 0);
    return { pos, mine: mineV, theirs: theirsV, edge: r1(mineV - theirsV) };
  });
}

// The biggest swing in your favour and against you (for a headline read).
export function edgeHighlights(edges: Edge[]): { best: Edge | null; worst: Edge | null } {
  if (!edges.length) return { best: null, worst: null };
  let best = edges[0];
  let worst = edges[0];
  for (const e of edges) {
    if (e.edge > best.edge) best = e;
    if (e.edge < worst.edge) worst = e;
  }
  return { best, worst };
}
