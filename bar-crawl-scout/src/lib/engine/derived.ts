// Derived stats. Every formula lives here so the numbers are consistent site-wide.
// Missing input -> null (the UI shows "-", never 0; 0 is a lie).

// 1. Points per game.
export function ppg(points: number | null, gamesActive: number | null): number | null {
  if (points == null || !gamesActive) return null;
  return Math.round((points / gamesActive) * 10) / 10;
}

// 6. Weekly volatility = population standard deviation of weekly points.
export function volatility(weekly: number[]): number | null {
  if (!weekly.length) return null;
  const mean = weekly.reduce((s, v) => s + v, 0) / weekly.length;
  const varc = weekly.reduce((s, v) => s + (v - mean) ** 2, 0) / weekly.length;
  return Math.round(Math.sqrt(varc) * 10) / 10;
}

// 2. Consistency / FLOOR = % of played weeks scoring above the replacement line.
export function floorPct(weekly: number[], replacementPoints: number): number | null {
  if (!weekly.length) return null;
  const above = weekly.filter((p) => p >= replacementPoints).length;
  return Math.round((above / weekly.length) * 100);
}

// 3. Boom rate = % of played weeks finishing top-12 at position.
export function boomRate(weeklyRanks: number[]): number | null {
  if (!weeklyRanks.length) return null;
  return Math.round((weeklyRanks.filter((r) => r <= 12).length / weeklyRanks.length) * 100);
}
// Bust rate = % below rank 36 (RB/WR) or 18 (QB/TE).
export function bustRate(weeklyRanks: number[], position: string): number | null {
  if (!weeklyRanks.length) return null;
  const line = position === 'QB' || position === 'TE' ? 18 : 36;
  return Math.round((weeklyRanks.filter((r) => r > line).length / weeklyRanks.length) * 100);
}

// 4. Target share = targets / team pass attempts. Touch share = (rush + tgt) / team plays.
export function targetShare(recTgt: number | null, teamPassAtt: number | null): number | null {
  if (recTgt == null || !teamPassAtt) return null;
  return Math.round((recTgt / teamPassAtt) * 1000) / 10;
}
export function touchShare(rushAtt: number | null, recTgt: number | null, teamPlays: number | null): number | null {
  if (rushAtt == null || recTgt == null || !teamPlays) return null;
  return Math.round(((rushAtt + recTgt) / teamPlays) * 1000) / 10;
}

// 5. Snap share = offensive snaps / team offensive snaps.
export function snapShare(offSnp: number | null, tmOffSnp: number | null): number | null {
  if (offSnp == null || !tmOffSnp) return null;
  return Math.round((offSnp / tmOffSnp) * 1000) / 10;
}

// 7. Age-curve "mileage" flag by position.
export function mileageFlag(position: string, age: number | null): boolean {
  if (age == null) return false;
  if (position === 'RB') return age >= 27;
  if (position === 'WR' || position === 'TE') return age >= 29;
  if (position === 'QB') return age >= 35;
  return false;
}

// Rolling trend arrow over the last `window` values: 'up' | 'down' | 'flat'.
export function trend(series: number[], window = 4): 'up' | 'down' | 'flat' | null {
  if (series.length < 2) return null;
  const recent = series.slice(-window);
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const delta = last - first;
  const scale = Math.max(1, Math.abs(first));
  if (delta / scale > 0.08) return 'up';
  if (delta / scale < -0.08) return 'down';
  return 'flat';
}
