// THE ART CRITIC — the automatable anti-AI floor (Fable File 03, Part 6 / File 01 1.7).
// Hard-fails on the two tells that never belong in this codebase:
//   1. backdrop-filter (the frosted-glass "AI default")
//   2. default Tailwind colour utilities (bg-blue-500, text-red-600, …)
// Stray raw hex is REPORTED, not failed — the app predates the token system and
// migrating every colour to a palette token is a separate, tracked cleanup.
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const EXT = new Set(['.svelte', '.css', '.ts', '.js']);

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (EXT.has(extname(e.name))) yield p;
  }
}

const TW = /\b(bg|text|border|from|via|to|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|grey|slate|zinc|neutral|stone)-\d{2,3}\b/;
const errors = [];
let hexCount = 0;

for await (const file of walk(SRC)) {
  const text = await readFile(file, 'utf8');
  const rel = file.slice(SRC.length + 1);
  text.split('\n').forEach((line, i) => {
    if (/backdrop-filter/.test(line)) errors.push(`${rel}:${i + 1}  backdrop-filter is banned (frosted-glass AI tell)`);
    if (TW.test(line)) errors.push(`${rel}:${i + 1}  Tailwind colour class '${line.match(TW)[0]}' — use palette tokens`);
    hexCount += (line.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  });
}

console.log(`token-lint: scanned src/ — ${hexCount} raw hex literals (report-only for now)`);
if (errors.length) { console.error('TOKEN-LINT FAILED:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('✓ no backdrop-filter, no Tailwind colour classes');
