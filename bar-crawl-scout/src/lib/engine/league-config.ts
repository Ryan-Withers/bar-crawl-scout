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
