// THE STOPWATCH — bundle budget (Fable File 03, Part 7). Runs after `npm run build`.
// Asserts the shipped JS stays small and, crucially, that the 5MB Sleeper players
// blob NEVER lands in a chunk (guarded by a hard per-asset size ceiling).
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
const KB = 1024;
const BUDGET = { entryGz: 200 * KB, totalJsGz: 400 * KB, anyAssetRaw: 1024 * KB };

const gz = (buf) => gzipSync(buf).length;
const fmt = (n) => (n / KB).toFixed(1) + 'kb';

const files = await readdir(DIST);
const errors = [];
let totalJsGz = 0, biggestJsGz = 0, biggestJs = '';

for (const f of files) {
  const p = join(DIST, f);
  const size = (await stat(p)).size;
  if (size > BUDGET.anyAssetRaw) errors.push(`${f} is ${fmt(size)} raw — over the ${fmt(BUDGET.anyAssetRaw)} ceiling (the 5MB players blob must never ship)`);
  if (f.endsWith('.js')) {
    const g = gz(await readFile(p));
    totalJsGz += g;
    if (g > biggestJsGz) { biggestJsGz = g; biggestJs = f; }
  }
}

if (biggestJsGz > BUDGET.entryGz) errors.push(`largest JS chunk ${biggestJs} is ${fmt(biggestJsGz)} gz — over the ${fmt(BUDGET.entryGz)} entry budget`);
if (totalJsGz > BUDGET.totalJsGz) errors.push(`total JS ${fmt(totalJsGz)} gz — over the ${fmt(BUDGET.totalJsGz)} budget`);

console.log(`bundle: largest JS ${fmt(biggestJsGz)} gz, total JS ${fmt(totalJsGz)} gz`);
if (errors.length) { console.error('BUNDLE BUDGET FAILED:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('✓ bundle budget OK');
