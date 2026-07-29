// STAGE CHECK — audit the career-stage tags in src/lib/data.js against Sleeper.
//
// Every player row carries a hand-written stage (rookie/yr2/asc/prime/aging/
// fading) and the whole valuation model hangs off it: a rookie is priced down
// for 2026 and up for 2027, an aging RB sheds 30% by 2027. A single wrong tag
// silently mis-prices a player in every mode, on every page.
//
// Sleeper knows the answer. `years_exp` is 0 for a first-year player and 1 for a
// second-year one, so "is this man a rookie" is a lookup, not a memory test.
//
// Runs offline against src/lib/api/fixtures/players-trimmed.json, or live with
// --live (which is how the nightly inspector runs it, where the network is up).
//
//   node scripts/stage-check.mjs [--live] [--strict]
//
// Exits non-zero on a HARD contradiction — a tag that years_exp flatly refutes.
// Softer observations (a stage that looks off for a player's age) are printed
// but don't fail the build, because "prime" vs "aging" is a judgement call in a
// way that "rookie" is not.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkStage } from './stage-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LIVE = process.argv.includes('--live');
const STRICT = process.argv.includes('--strict');

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function loadPlayers() {
  if (LIVE) {
    const res = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!res.ok) throw new Error(`Sleeper returned ${res.status}`);
    return res.json();
  }
  const raw = await readFile(join(ROOT, 'src/lib/api/fixtures/players-trimmed.json'), 'utf8');
  return JSON.parse(raw);
}

// Pull PLAYERS out of data.js without importing the whole SPA module graph.
async function loadBoard() {
  const src = await readFile(join(ROOT, 'src/lib/data.js'), 'utf8');
  const m = src.match(/export const PLAYERS\s*=\s*(\[[\s\S]*?\n\];)/);
  if (!m) throw new Error('could not find PLAYERS in src/lib/data.js');
  // The table is a literal array of arrays — safe to evaluate on its own.
  return JSON.parse(m[1].replace(/\n\];$/, '\n]').replace(/,(\s*[\]}])/g, '$1'));
}

const players = await loadPlayers();
const board = await loadBoard();

// name -> { yearsExp, age }
const byName = new Map();
for (const id in players) {
  const v = players[id];
  if (!v) continue;
  const name = v.full_name || [v.first_name, v.last_name].filter(Boolean).join(' ');
  if (!name) continue;
  byName.set(norm(name), { yearsExp: v.years_exp ?? null, age: v.age ?? null });
}

const withExp = [...byName.values()].filter((v) => v.yearsExp != null).length;
console.log(`stage-check: ${board.length} board rows vs ${byName.size} Sleeper players (${withExp} with years_exp)${LIVE ? ' [live]' : ' [fixture]'}`);

// A checker that passes because the data is missing is worse than no checker.
if (withExp === 0) {
  console.error(
    'STAGE-CHECK CANNOT RUN: no years_exp on any player.\n'
    + '  players-trimmed.json predates the field being captured.\n'
    + '  Re-run the capture (Actions -> capture-fixtures.yml, or npm run capture\n'
    + '  where api.sleeper.app is reachable), or run this with --live.',
  );
  process.exit(STRICT ? 1 : 0);
}

const hard = [];
const soft = [];
let matched = 0;
let unmatched = 0;

for (const row of board) {
  const [, name, pos, , , adp, stageRaw] = row;
  const hit = byName.get(norm(name));
  if (!hit || hit.yearsExp == null) { unmatched++; continue; }
  matched++;
  const res = checkStage({ name, pos, adp, stage: stageRaw || '' }, hit);
  hard.push(...res.hard);
  soft.push(...res.soft);
}

console.log(`  matched ${matched}, unmatched ${unmatched} (not in the trimmed blob)`);

if (soft.length) {
  console.log(`\n${soft.length} thing(s) worth a look (not failures):`);
  for (const s of soft) console.log('  · ' + s);
}

if (hard.length) {
  console.error(`\nSTAGE-CHECK FAILED — ${hard.length} tag(s) contradicted by Sleeper:`);
  for (const h of hard) console.error('  ✗ ' + h);
  console.error('\nFix the stage column in src/lib/data.js. years_exp is authoritative.');
  process.exit(1);
}

console.log('\n✓ every stage tag Sleeper can vouch for checks out');
