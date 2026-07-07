// MATCHUP — turn two projected team totals into a win probability. Weekly fantasy
// scores are roughly normal; the margin (mine - theirs) over the combined spread
// gives a clean logistic-ish win%. Pure + fixture-tested.

// sigma ~ typical weekly team scoring stdev (half-PPR ~ 26-30).
export function winProbability(myProj: number, oppProj: number, sigma = 28): number {
  const margin = myProj - oppProj;
  // Logistic approximation of the normal CDF of margin / (sqrt(2)*sigma).
  const z = margin / (sigma * Math.SQRT2);
  const p = 1 / (1 + Math.exp(-1.702 * z));
  return Math.round(p * 1000) / 10; // percent, 1dp
}

export interface Grade {
  label: string;
  tone: 'good' | 'even' | 'bad';
}

export function matchupGrade(winPct: number): Grade {
  if (winPct >= 65) return { label: 'FAVORED', tone: 'good' };
  if (winPct >= 52) return { label: 'SLIGHT EDGE', tone: 'good' };
  if (winPct > 48) return { label: 'COIN FLIP', tone: 'even' };
  if (winPct > 35) return { label: 'UNDERDOG', tone: 'bad' };
  return { label: 'LONG SHOT', tone: 'bad' };
}
