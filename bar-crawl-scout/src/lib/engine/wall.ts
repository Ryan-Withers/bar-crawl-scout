// THE WALL — pull the champion (and runner-up) out of a Sleeper winners bracket.
// The title game is the highest-round match flagged place 1 (p===1); its winner
// roster_id is champion, loser is runner-up. Pure + fixture-tested.

export interface BracketMatch {
  r: number;              // round
  m: number;              // match id
  w?: number | null;      // winner roster_id
  l?: number | null;      // loser roster_id
  p?: number | null;      // placement this match decides (1 = title)
}

export interface Champs {
  champion: number | null;
  runnerUp: number | null;
}

export function championFromBracket(bracket: BracketMatch[]): Champs {
  if (!bracket || !bracket.length) return { champion: null, runnerUp: null };
  // Prefer the explicit 1st-place game; fall back to the highest round.
  const titled = bracket.filter((b) => b.p === 1);
  const pool = titled.length ? titled : bracket;
  const maxR = Math.max(...pool.map((b) => b.r || 0));
  const final = pool.find((b) => b.r === maxR) || null;
  if (!final) return { champion: null, runnerUp: null };
  return { champion: final.w ?? null, runnerUp: final.l ?? null };
}
