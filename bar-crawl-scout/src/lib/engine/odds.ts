// THE BOOK — odds math. Australian decimal format ($1.38). Every price carries a
// bookie margin (overround) so the house always has an edge, just like the real
// thing. Pure + fixture-tested.

// Decimal odds for a probability, with margin baked in. Higher margin = shorter
// (worse-value) odds. Floored at 1.01. e.g. p=0.5, margin=0.07 -> ~$1.87.
export function decimalOdds(prob: number, margin = 0.07): number {
  const p = Math.min(0.995, Math.max(0.005, prob));
  const o = 1 / (p * (1 + margin));
  return Math.max(1.01, Math.round(o * 100) / 100);
}

// A two-way market (H2H, over/under) priced from one side's true probability.
// Both sides get the margin, so the implied book sums to > 100%.
export function twoWay(probA: number, margin = 0.07): { a: number; b: number } {
  return { a: decimalOdds(probA, margin), b: decimalOdds(1 - probA, margin) };
}

// The book's total implied probability for a market — > 1 by the overround.
export function overround(...odds: number[]): number {
  return Math.round(odds.reduce((s, o) => s + 1 / o, 0) * 1000) / 1000;
}

// Spread line from a projected margin (favourite's expected win margin, points).
// Rounded to the nearest half-point; both sides priced near even ($1.90).
export function spread(projMargin: number, side = 1.9): { line: number; favOdds: number; dogOdds: number } {
  const line = Math.round(Math.abs(projMargin) * 2) / 2 || 0.5;
  return { line, favOdds: side, dogOdds: side };
}

// Over/under line from a projected value (team total or a player's points),
// nudged to a half-point; both sides near even.
export function overUnder(proj: number, side = 1.9): { line: number; overOdds: number; underOdds: number } {
  const line = Math.round(proj * 2) / 2;
  return { line, overOdds: side, underOdds: side };
}

// Parlay (multi): decimal odds multiply. Payout = stake * combined.
export function parlayOdds(legs: number[]): number {
  if (!legs.length) return 0;
  return Math.round(legs.reduce((p, o) => p * o, 1) * 100) / 100;
}

export const potentialReturn = (stake: number, odds: number): number =>
  Math.round(stake * odds * 100) / 100;

// Futures: turn team strength scores into championship (or playoff) probabilities
// via a softmax with a sharpness `k`, then price with a fat futures margin.
export function futuresOdds(
  scores: Array<{ handle: string; score: number }>,
  k = 0.06,
  margin = 0.35,
): Array<{ handle: string; prob: number; odds: number }> {
  const exps = scores.map((s) => Math.exp(k * s.score));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return scores.map((s, i) => {
    const prob = exps[i] / sum;
    return { handle: s.handle, prob: Math.round(prob * 1000) / 1000, odds: decimalOdds(prob, margin) };
  });
}
