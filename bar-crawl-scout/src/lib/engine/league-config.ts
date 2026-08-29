// THE BACK OFFICE — summarise the league's roster shape from Sleeper's flat
// roster_positions array (["QB","RB","RB","WR",...,"BN","BN"]). Pure + tested.

export interface StarterSlot { pos: string; n: number }
export interface RosterShape {
  starters: StarterSlot[];
  bench: number;
  startCount: number;
  total: number;
}

// Preserve first-seen order of starting slots; fold IR/taxi into bench-like.
export function rosterShape(positions: string[]): RosterShape {
  const order: string[] = [];
  const count: Record<string, number> = {};
  let bench = 0;
  for (const p of positions || []) {
    if (p === 'BN' || p === 'IR' || p === 'TAXI') { bench += 1; continue; }
    if (!(p in count)) order.push(p);
    count[p] = (count[p] || 0) + 1;
  }
  const starters = order.map((pos) => ({ pos, n: count[pos] }));
  const startCount = starters.reduce((s, x) => s + x.n, 0);
  return { starters, bench, startCount, total: startCount + bench };
}

/**
 * How many of each skill position a manager needs to fill his STARTING lineup,
 * derived from the league's own roster_positions rather than hand-typed.
 *
 * The dedicated seats are a count. The flex seats are the interesting part: they
 * go to the positions that already carry the most dedicated seats, which is how
 * they actually get filled — nobody starts a second tight end in a flex when a
 * third back is available. For this league (QB, RB, RB, WR, WR, TE + 2 FLEX)
 * that yields QB 1, RB 3, WR 3, TE 1, which is exactly the hand-written table it
 * replaces. The point is not to change the numbers; it is to stop them being a
 * memory once the league changes shape.
 *
 * IDP slots are excluded on purpose — this board does not model defenders.
 */
const FLEX_ELIGIBLE: Record<string, string[]> = {
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['WR', 'RB'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
};
const SKILL = ['QB', 'RB', 'WR', 'TE'];

export function needTargets(positions: string[]): Record<string, number> {
  const out: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const flexes: string[][] = [];
  for (const p of positions || []) {
    if (p === 'BN' || p === 'IR' || p === 'TAXI') continue;
    if (FLEX_ELIGIBLE[p]) { flexes.push(FLEX_ELIGIBLE[p]); continue; }
    if (out[p] != null) out[p] += 1;
  }
  // Spread the flex seats rather than stacking them. Handing every flex to
  // whoever already has the most just piles them all on one position — two
  // FLEX seats became RB 4 / WR 2, which is not how anybody fills a lineup.
  // Round-robin: each seat goes to the eligible position that has received the
  // fewest flexes so far, ties broken by dedicated seats then by convention.
  const gotFlex: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const elig of flexes) {
    const pick = elig
      .filter((p) => out[p] != null)
      .sort((a, b) => gotFlex[a] - gotFlex[b] || out[b] - out[a] || SKILL.indexOf(a) - SKILL.indexOf(b))[0];
    if (pick) { out[pick] += 1; gotFlex[pick] += 1; }
  }
  // A league with no seat at a position still wants one body there rather than a
  // divide-by-zero in the need score.
  for (const p of SKILL) if (!out[p]) out[p] = 1;
  return out;
}
