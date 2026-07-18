// CONSISTENCY — is this guy a safe floor or a boom-or-bust coin flip?
// Reads a player's league-scored weekly points (DNPs already excluded) and
// summarises floor / ceiling / volatility, plus how often he booms or busts
// relative to HIS OWN mean. Pure + known-answer tested. Reuses volatility().
import { volatility } from './derived';

export interface Profile {
  weeks: number;
  mean: number;      // avg points / played week
  floor: number;     // worst played week
  ceiling: number;   // best played week
  vol: number;       // population std-dev of weekly points
  cv: number;        // coefficient of variation (vol / mean) — comparable across players
  boomPct: number;   // % of weeks >= 1.25x his mean
  bustPct: number;   // % of weeks <= 0.6x his mean
  verdict: 'STEADY' | 'STREAKY' | 'VOLATILE';
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

// Needs at least 3 played weeks to say anything meaningful.
export function profileWeeks(weekly: number[]): Profile | null {
  if (!weekly || weekly.length < 3) return null;
  const weeks = weekly.length;
  const mean = weekly.reduce((s, v) => s + v, 0) / weeks;
  const vol = volatility(weekly) ?? 0;
  const cv = mean > 0 ? r2(vol / mean) : 0;
  const boomPct = Math.round((weekly.filter((p) => p >= 1.25 * mean).length / weeks) * 100);
  const bustPct = Math.round((weekly.filter((p) => p <= 0.6 * mean).length / weeks) * 100);
  // Lower CV = more predictable week to week.
  const verdict: Profile['verdict'] = cv < 0.4 ? 'STEADY' : cv > 0.65 ? 'VOLATILE' : 'STREAKY';
  return {
    weeks,
    mean: r1(mean),
    floor: r1(Math.min(...weekly)),
    ceiling: r1(Math.max(...weekly)),
    vol,
    cv,
    boomPct,
    bustPct,
    verdict,
  };
}
