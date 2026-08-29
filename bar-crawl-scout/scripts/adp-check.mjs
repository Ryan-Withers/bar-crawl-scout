// ADP CHECK — the hand-typed draft position against the market's.
//
// The 200-row board in data.js carries a hand-typed ADP, and ADP is the ONLY
// real input to the valuation model: tierFromADP turns it into the talent base
// that every WIN score, every trade valuation and every bot's board is built on.
// A number that has drifted is not a cosmetic problem, it is a mis-priced player
// on every page.
//
// Sleeper's season projections carry adp_half_ppr — the same basis the board
// footer claims (FantasyPros half-PPR). So this is checkable, and now checked.
//
//   node scripts/adp-check.mjs [--live] [--strict] [--depth 140]
//
// REPORT-ONLY by default, deliberately. Two honest sources disagree about the
// tail all the time — Sleeper ranks a far larger pool, so its numbers run higher
// past pick ~150 as a matter of arithmetic, not opinion. What matters is a
// disagreement INSIDE the range this league actually drafts. --strict exits
// non-zero if one of those is found.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LIVE = process.argv.includes('--live');
const STRICT = process.argv.includes('--strict');
const depthArg = process.argv.indexOf('--depth');
// 10 teams x 12 live rounds is 120 picks; look a little past the last one.
const DEPTH = depthArg >= 0 ? Number(process.argv[depthArg + 1]) : 140;
// Inside the draftable range, this much disagreement is worth a human look.
const LOUD = 40;

const nameKey = (s) => String(s || '')
  .toLowerCase()
  .replace(/[.'’]/g, '')
  .replace(/\s+(jr|sr|ii|iii|iv|v)$/, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const readJSON = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

async function load() {
  if (LIVE) {
    const season = new Date().getUTCFullYear();
    const [pl, pr] = await Promise.all([
      fetch('https://api.sleeper.app/v1/players/nfl').then((r) => r.json()),
      fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${season}`).then((r) => r.json()),
    ]);
    return { blob: pl, proj: pr };
  }
  return {
    blob: await readJSON('src/lib/api/fixtures/players-trimmed.json'),
    proj: await readJSON('src/lib/api/fixtures/season-projections-2026.json'),
  };
}

const main = async () => {
  const { blob, proj } = await load();
  const src = await readFile(join(ROOT, 'src/lib/data.js'), 'utf8');
  const ROW = /\[(\d+),"((?:[^"\\]|\\.)*)","([A-Z]+)","([A-Z]+)",(\d+),([\d.]+),"([a-z0-9]*)"\]/g;

  const byKey = new Map();
  for (const [id, v] of Object.entries(blob)) {
    if (!v) continue;
    const nm = v.full_name || `${v.first_name || ''} ${v.last_name || ''}`.trim();
    if (!nm) continue;
    const k = nameKey(nm);
    const cur = byKey.get(k);
    if (!cur || (v.search_rank ?? 1e9) < (blob[cur].search_rank ?? 1e9)) byKey.set(k, id);
  }

  const rows = [];
  let unmatched = 0;
  for (const m of src.matchAll(ROW)) {
    const [, , name, pos, , , adpStr] = m;
    const ours = Number(adpStr);
    const id = byKey.get(nameKey(name));
    const theirs = id ? proj[id]?.adp_half_ppr : null;
    // 999 is Sleeper's "not ranked at all" sentinel, not a draft position.
    if (theirs == null || theirs >= 900) { unmatched++; continue; }
    rows.push({ name, pos, ours, theirs, drift: theirs - ours });
  }

  console.log(`adp-check: ${rows.length} board rows carry a Sleeper half-PPR ADP (${unmatched} do not) [${LIVE ? 'live' : 'fixture'}]`);
  if (!rows.length) { console.log('  nothing to compare.'); return; }

  const abs = rows.map((r) => Math.abs(r.drift)).sort((a, b) => a - b);
  const q = (p) => abs[Math.floor(p * (abs.length - 1))];
  console.log(`  disagreement: median ${q(0.5).toFixed(1)} · p90 ${q(0.9).toFixed(1)} · worst ${q(1).toFixed(1)}\n`);

  // Only the range this league drafts. Past the last pick the two sources are
  // ranking different pools and the arithmetic diverges on its own.
  const inRange = rows.filter((r) => Math.min(r.ours, r.theirs) <= DEPTH);
  const loud = inRange.filter((r) => Math.abs(r.drift) >= LOUD)
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

  if (!loud.length) {
    console.log(`✓ nothing inside the first ${DEPTH} picks disagrees by ${LOUD} or more`);
    return;
  }
  console.log(`${loud.length} player(s) inside the first ${DEPTH} picks disagree by ${LOUD}+:\n`);
  for (const r of loud) {
    const dir = r.drift > 0 ? 'the market is COLDER on him than we are' : 'the market is HOTTER on him than we are';
    console.log(`  ${r.name.padEnd(24)} ${r.pos.padEnd(3)} ours ${String(r.ours).padStart(6)} · sleeper ${r.theirs.toFixed(1).padStart(6)} · ${dir}`);
  }
  console.log('\nADP is the only real input to the valuation model, so a wrong one');
  console.log('mis-prices that player on every page. Worth a look, not a failure —');
  console.log('the board is allowed to disagree with the market on purpose.');
  if (STRICT) process.exit(1);
};

main().catch((e) => { console.error('ADP-CHECK FAILED:', e); process.exit(1); });
