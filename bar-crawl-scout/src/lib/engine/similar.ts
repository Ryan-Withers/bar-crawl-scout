// SIMILAR FILES — nearest comparable players. Same position first, then closest
// on value (R26) and draft cost (ADP). Pure + fixture-tested; the Player File
// feeds it the top-200 board and renders the peers as pull-able mini files.

export interface PeerInput {
  name: string;
  pos: string;
  r26: number;   // this-year value
  adp: number;   // draft cost
}

export interface Peer extends PeerInput {
  dist: number;  // lower = closer
}

// Normalize the two axes so neither dominates, then Euclidean distance.
// Same position is a hard preference (off-position peers pushed to the back).
export function similarPlayers(target: PeerInput, pool: PeerInput[], k = 5): Peer[] {
  const others = pool.filter((p) => p.name.toLowerCase() !== target.name.toLowerCase());
  if (!others.length) return [];

  const all = [target, ...others];
  const span = (sel: (p: PeerInput) => number) => {
    const xs = all.map(sel);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return hi - lo || 1;
  };
  const rSpan = span((p) => p.r26);
  const aSpan = span((p) => p.adp);

  return others
    .map((p) => {
      const dr = (p.r26 - target.r26) / rSpan;
      const da = (p.adp - target.adp) / aSpan;
      const posPenalty = p.pos === target.pos ? 0 : 100; // dwarfs any in-position distance (max ~1.41)
      return { ...p, dist: posPenalty + Math.sqrt(dr * dr + da * da) };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, k);
}
