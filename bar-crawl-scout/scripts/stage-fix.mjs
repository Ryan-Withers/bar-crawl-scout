// STAGE FIX — settle the objective half of the career-stage column from Sleeper.
//
// stage-check tells you which tags years_exp contradicts. This fixes them, and
// only them: "rookie" means years_exp 0 and "yr2" means years_exp 1, so those two
// are lookups, not opinions, and there is no reason for a human to be typing
// them. Everything else — asc, prime, aging, fading — is a judgement call about a
// player's arc and is left exactly as written.
//
//   node scripts/stage-fix.mjs [--live] [--dry]
//
// Runs against the captured players fixture by default. --dry prints what it
// would change and writes nothing.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LIVE = process.argv.includes('--live');
const DRY = process.argv.includes('--dry');

const nameKey = (s) => String(s || '')
  .toLowerCase()
  .replace(/[.'’]/g, '')
  .replace(/\s+(jr|sr|ii|iii|iv|v)$/, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

async function loadPlayers() {
  if (LIVE) {
    const res = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!res.ok) throw new Error(`Sleeper returned ${res.status}`);
    return res.json();
  }
  return JSON.parse(await readFile(join(ROOT, 'src/lib/api/fixtures/players-trimmed.json'), 'utf8'));
}

const main = async () => {
  const blob = await loadPlayers();
  const byKey = new Map();
  for (const v of Object.values(blob)) {
    if (!v) continue;
    const nm = v.full_name || `${v.first_name || ''} ${v.last_name || ''}`.trim();
    if (!nm) continue;
    const k = nameKey(nm);
    // Prefer the better-ranked man when two share a normalised name.
    const cur = byKey.get(k);
    if (!cur || (v.search_rank ?? 1e9) < (cur.search_rank ?? 1e9)) byKey.set(k, v);
  }

  const path = join(ROOT, 'src/lib/data.js');
  const src = await readFile(path, 'utf8');

  // Rows look like: [12,"Ashton Jeanty","RB","LV",13,12.7,"yr2"]
  const ROW = /\[(\d+),"((?:[^"\\]|\\.)*)","([A-Z]+)","([A-Z]+)",(\d+),([\d.]+),"([a-z0-9]*)"\]/g;
  const changes = [];
  const out = src.replace(ROW, (whole, rank, name, pos, team, bye, adp, stage) => {
    const hit = byKey.get(nameKey(name.replace(/\\"/g, '"')));
    if (!hit || hit.years_exp == null) return whole;
    const exp = Number(hit.years_exp);
    let next = stage;
    if (exp === 0) next = 'rookie';
    else if (exp === 1) next = 'yr2';
    else if (stage === 'rookie' || stage === 'yr2') {
      // He has real service but carries a first- or second-year tag. Dropping
      // him to the neutral tag would be a silent DOWNGRADE — '' prices a player
      // as flat (0.90 into 2027) where yr2 priced him as a riser (1.20) — and
      // the author plainly meant "young man still going up". For a third or
      // fourth-year player that intent is still the best available read, so he
      // becomes 'asc' (1.15) rather than being written off. Past that the tag
      // says nothing credible and a human should look.
      next = exp <= 3 ? 'asc' : '';
    }
    if (next === stage) return whole;
    changes.push({ name, from: stage || '(none)', to: next || '(none)', exp });
    return `[${rank},"${name}","${pos}","${team}",${bye},${adp},"${next}"]`;
  });

  if (!changes.length) { console.log('stage-fix: nothing to change — years_exp agrees with every tag.'); return; }
  console.log(`stage-fix: ${changes.length} tag(s) settled by years_exp\n`);
  for (const c of changes) console.log(`  ${c.name.padEnd(26)} ${c.from} -> ${c.to}   (years_exp ${c.exp})`);
  if (DRY) { console.log('\n--dry: nothing written.'); return; }
  await writeFile(path, out);
  console.log('\n✓ src/lib/data.js updated. Run `npm run stage-check` to confirm.');
};

main().catch((e) => { console.error('STAGE-FIX FAILED:', e); process.exit(1); });
