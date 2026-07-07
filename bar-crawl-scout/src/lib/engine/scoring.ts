// THE SCORING ENGINE.
// Sleeper's league.scoring_settings keys map 1:1 to the stat keys in
// /stats and /projections. So league-scored points = sum(stat * weight).
// No hardcoded half-PPR, no special cases — the league's own settings drive it.
// This is what makes every number on the site trustworthy.

export function scoreStats(
  stats: Record<string, number>,
  scoring: Record<string, number>,
): number {
  let pts = 0;
  for (const [key, value] of Object.entries(stats)) {
    const weight = scoring[key];
    if (weight !== undefined && typeof value === 'number') pts += value * weight;
  }
  return Math.round(pts * 100) / 100;
}

// Rank every player at a position for a week by league-scored points (desc).
// scored: playerId -> league points; positions: playerId -> position.
// Returns playerId -> 1-based rank among same-position players.
export function positionRanks(
  scored: Record<string, number>,
  positions: Record<string, string>,
  position: string,
): Record<string, number> {
  const ids = Object.keys(scored).filter((id) => positions[id] === position);
  ids.sort((a, b) => scored[b] - scored[a]);
  const out: Record<string, number> = {};
  ids.forEach((id, i) => { out[id] = i + 1; });
  return out;
}

// The start-worthy replacement line for a 10-team half-PPR league (blueprint 3.2):
// weekly points of rank-24 RB/WR, rank-12 QB/TE.
export function replacementRank(position: string): number {
  return position === 'QB' || position === 'TE' ? 12 : 24;
}
