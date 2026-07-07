// THE RECONCILIATION SUITE — the crown jewel (Fable File 03, Part 2.1).
// For every completed week in the fixtures, run raw weekly stats through
// scoreStats() with the league's real scoring_settings and prove the result
// equals the players_points Sleeper itself computed, within ±0.02 per player.
// This proves the entire scoring pipeline end-to-end using nothing but fixtures.
//
// It auto-discovers captured fixtures. With none yet (only league-scoring.json),
// it SKIPS — green. Run the capture bot / GitHub Action and it lights up.
import { describe, it, expect } from 'vitest';
import { scoreStats } from '../src/lib/engine/scoring';
import scoring from '../src/lib/api/fixtures/league-scoring.json';

const TOL = 0.02;

// Vite globs every captured week fixture at build time (eager = inlined).
const matchupFiles = import.meta.glob('../src/lib/api/fixtures/matchups-*.json', { eager: true, import: 'default' });
const statFiles = import.meta.glob('../src/lib/api/fixtures/stats-*.json', { eager: true, import: 'default' });

// Pair matchups-{season}-{week} with stats-{season}-{week}.
const key = (p) => p.match(/(\d{4})-(\d+)\.json$/)?.slice(1, 3).join('-');
const stats = {};
for (const p in statFiles) { const k = key(p); if (k) stats[k] = statFiles[p]; }
const weeks = [];
for (const p in matchupFiles) {
  const k = key(p);
  if (k && stats[k] && Array.isArray(matchupFiles[p]) && matchupFiles[p].length) weeks.push({ k, matchups: matchupFiles[p], stats: stats[k] });
}

describe.skipIf(weeks.length === 0)('reconciliation — scoreStats vs Sleeper players_points', () => {
  for (const { k, matchups, stats: wStats } of weeks) {
    it(`week ${k}: every scored player reconciles within ±${TOL}`, () => {
      const mismatches = [];
      let checked = 0;
      for (const m of matchups) {
        const pp = m.players_points || {};
        for (const [id, sleeperPts] of Object.entries(pp)) {
          if (typeof sleeperPts !== 'number') continue;
          const raw = wStats[id];
          if (!raw) continue; // no stat line (DNP / not tracked) — nothing to reconcile
          checked += 1;
          const ours = scoreStats(raw, scoring);
          if (Math.abs(ours - sleeperPts) > TOL) {
            mismatches.push(`  player ${id}: sleeper=${sleeperPts} ours=${ours} Δ=${(ours - sleeperPts).toFixed(3)}`);
          }
        }
      }
      if (mismatches.length) {
        throw new Error(`${mismatches.length}/${checked} players off in week ${k}:\n${mismatches.slice(0, 20).join('\n')}`);
      }
      expect(checked).toBeGreaterThan(0);
    });
  }
});

// Always-on guard so the file itself is never a silent no-op.
describe('reconciliation harness', () => {
  it('is either running against captured weeks or cleanly pending', () => {
    if (weeks.length === 0) console.info('[reconcile] no week fixtures yet — run scripts/capture-fixtures.mjs (or the Capture fixtures Action).');
    expect(scoring && typeof scoring === 'object').toBe(true);
  });
});
