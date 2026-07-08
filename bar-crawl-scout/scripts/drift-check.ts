// THE HEALTH INSPECTOR — nightly drift check (Fable File 03, Part 4.2).
// Runs in GitHub Actions (real network). Hits the live Sleeper endpoints and
// validates each against our Zod schemas. A parse failure = Sleeper changed a
// shape; the workflow opens a high-priority issue and — because the runtime
// schemas are .passthrough() — production degrades gracefully meanwhile.
//
// Run: npx tsx scripts/drift-check.ts   (needs network; not the dev sandbox)
import { SCHEMAS } from '../src/lib/api/schemas';

const API = 'https://api.sleeper.app/v1';
const LG = process.env.LEAGUE_ID || '1311995695032467456';

const checks: Array<[keyof typeof SCHEMAS, string]> = [
  ['state', `/state/nfl`],
  ['league', `/league/${LG}`],
  ['users', `/league/${LG}/users`],
  ['rosters', `/league/${LG}/rosters`],
  ['matchups', `/league/${LG}/matchups/1`],
  ['trending-add', `/players/nfl/trending/add?limit=25`],
];

let failed = false;
for (const [name, path] of checks) {
  try {
    const res = await fetch(API + path);
    if (!res.ok) { failed = true; console.error(`✗ ${name}: HTTP ${res.status}`); continue; }
    const data = await res.json();
    const parsed = SCHEMAS[name].safeParse(data);
    if (!parsed.success) {
      failed = true;
      const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      console.error(`✗ DRIFT ${name}: ${issues}`);
    } else {
      console.log(`✓ ${name}`);
    }
  } catch (e) {
    failed = true;
    console.error(`✗ ${name}: ${(e as Error).message}`);
  }
}

if (failed) { console.error('\nDrift detected — schemas/fixtures need updating.'); process.exit(1); }
console.log('\n✓ all live endpoints match their schemas');
