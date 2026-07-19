// H2H MATCHUP ODDS — a pregame line for this week's slate. Turns each team's
// scoring strength (points per game) into a win probability, a spread line, and
// Australian decimal prices via the existing book math. Pure + known-answer tested.
import { twoWay, spread } from './odds';

// Win probability for a team projected to win by `margin` points. Logistic on
// the margin over `scale` (~ the standard deviation of a weekly fantasy margin),
// so +26 pts ≈ 73%. Symmetric: winProb(m) + winProb(-m) === 1.
export function winProb(margin: number, scale = 26): number {
  if (!isFinite(margin) || scale <= 0) return 0.5;
  return 1 / (1 + Math.exp(-margin / scale));
}

export interface PricedMatchup {
  margin: number;     // A's projected margin (ppgA - ppgB), 1 dp
  line: number;       // spread line (nearest half-point)
  favoursA: boolean;  // is A the favourite
  probA: number;
  probB: number;
  oddsA: number;      // decimal price for A
  oddsB: number;      // decimal price for B
}

// Price a head-to-head from each side's points-per-game strength.
export function priceMatchup(ppgA: number, ppgB: number, scale = 26, margin = 0.07): PricedMatchup {
  const m = ppgA - ppgB;
  const probA = winProb(m, scale);
  const { a, b } = twoWay(probA, margin);
  return {
    margin: Math.round(m * 10) / 10,
    line: spread(m).line,
    favoursA: m >= 0,
    probA,
    probB: 1 - probA,
    oddsA: a,
    oddsB: b,
  };
}
