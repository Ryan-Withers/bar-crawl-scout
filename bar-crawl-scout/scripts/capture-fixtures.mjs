// THE CAPTURE BOT (Fable File 03, Part 1.1)
// Walks the full Sleeper endpoint inventory for the league (and its whole
// previous_league_id chain) and writes real responses to src/lib/api/fixtures/,
// so the test suite reconciles against captured reality — never hand-written mocks.
//
// Runs where the network reaches api.sleeper.app: Ryan's machine, or the
// capture-fixtures GitHub Action (Actions runners are NOT sandboxed).
//   node scripts/capture-fixtures.mjs --league 1311995695032467456
//
// Rules honoured: the 5MB players blob is trimmed to only players seen in league
// history + the current top-400 by search_rank (~300KB). Every file is hashed
// into fixtures/manifest.json so fixture updates are reviewed like code.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'lib', 'api', 'fixtures');
const API = 'https://api.sleeper.app/v1';
const WEEKS = 18;

const argLeague = (() => { const i = process.argv.indexOf('--league'); return i >= 0 ? process.argv[i + 1] : null; })();
const LEAGUE_ID = argLeague || '1311995695032467456';

const manifest = { capturedAt: new Date().toISOString(), leagueId: LEAGUE_ID, files: {} };

async function j(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}
async function save(name, data) {
  if (data == null) return;
  const body = JSON.stringify(data);
  await writeFile(join(OUT, name), body);
  manifest.files[name] = { hash: createHash('sha256').update(body).digest('hex').slice(0, 16), bytes: body.length };
  console.log('  ✓', name, `(${(body.length / 1024).toFixed(1)}kb)`);
}
const ok = async (fn) => { try { return await fn(); } catch (e) { console.log('  · skip:', e.message); return null; } };

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log('Capturing fixtures for league', LEAGUE_ID);

  const state = await ok(() => j('/state/nfl'));
  await save('state.json', state);

  // Walk the league chain (this season back through previous_league_id).
  const chain = [];
  let cur = await j(`/league/${LEAGUE_ID}`);
  while (cur) {
    chain.push(cur);
    if (!cur.previous_league_id) break;
    cur = await ok(() => j(`/league/${cur.previous_league_id}`));
  }
  console.log('League chain:', chain.map((l) => l.season).join(' <- '));

  const rosterPlayerIds = new Set();

  for (let i = 0; i < chain.length; i++) {
    const lg = chain[i];
    const season = lg.season;
    const tag = i === 0 ? '' : `-${season}`; // current league keeps bare names for the app's existing fixtures
    console.log(`\n${season} (${lg.league_id})`);

    await save(`league${tag}.json`, lg);
    if (i === 0) await save('league-scoring.json', lg.scoring_settings);

    const users = await ok(() => j(`/league/${lg.league_id}/users`));
    await save(`users-${season}.json`, users);
    const rosters = await ok(() => j(`/league/${lg.league_id}/rosters`));
    await save(`rosters-${season}.json`, rosters);
    (rosters || []).forEach((r) => (r.players || []).forEach((id) => rosterPlayerIds.add(String(id))));

    await save(`traded_picks-${season}.json`, await ok(() => j(`/league/${lg.league_id}/traded_picks`)));
    const drafts = await ok(() => j(`/league/${lg.league_id}/drafts`));
    await save(`drafts-${season}.json`, drafts);
    if (drafts && drafts[0]) await save(`draft-picks-${season}.json`, await ok(() => j(`/draft/${drafts[0].draft_id}/picks`)));
    await save(`winners_bracket-${season}.json`, await ok(() => j(`/league/${lg.league_id}/winners_bracket`)));

    for (let w = 1; w <= WEEKS; w++) {
      const matchups = await ok(() => j(`/league/${lg.league_id}/matchups/${w}`));
      await save(`matchups-${season}-${w}.json`, matchups);
      await save(`transactions-${season}-${w}.json`, await ok(() => j(`/league/${lg.league_id}/transactions/${w}`)));
      // Raw weekly stats + projections drive the reconciliation suite — TRIMMED
      // to that week's matchup players + all rostered IDs, or the league-wide
      // blobs are ~1MB/week and bloat the repo for players nobody reconciles.
      const weekKeep = new Set(rosterPlayerIds);
      (matchups || []).forEach((m) => {
        Object.keys(m.players_points || {}).forEach((id) => weekKeep.add(id));
        (m.players || []).forEach((id) => weekKeep.add(id));
      });
      const trim = (blob) => {
        if (!blob) return blob;
        const out = {};
        for (const id of Object.keys(blob)) if (weekKeep.has(id)) out[id] = blob[id];
        return out;
      };
      await save(`stats-${season}-${w}.json`, trim(await ok(() => j(`/stats/nfl/regular/${season}/${w}`))));
      await save(`projections-${season}-${w}.json`, trim(await ok(() => j(`/projections/nfl/regular/${season}/${w}`))));
    }
  }

  // Trending (current).
  await save('trending-add.json', await ok(() => j('/players/nfl/trending/add?limit=25')));
  await save('trending-drop.json', await ok(() => j('/players/nfl/trending/drop?limit=25')));

  // Players blob — TRIM to rostered-in-history + current top-400 by search_rank.
  console.log('\nPlayers blob (trimming)…');
  const all = await j('/players/nfl');
  const ranked = Object.entries(all)
    .filter(([, v]) => v && v.search_rank != null && v.search_rank < 100000)
    .sort((a, b) => a[1].search_rank - b[1].search_rank)
    .slice(0, 400)
    .map(([id]) => id);
  const keep = new Set([...rosterPlayerIds, ...ranked]);
  const trimmed = {};
  for (const id of keep) {
    const v = all[id]; if (!v) continue;
    // years_exp + age are what make the career-stage tags in data.js auditable
    // instead of a matter of memory: years_exp 0 IS a rookie, 1 IS a second-year
    // player, and no amount of confident recall beats the field. See
    // scripts/stage-check.mjs.
    trimmed[id] = { player_id: id, full_name: v.full_name, first_name: v.first_name, last_name: v.last_name, position: v.position, team: v.team, search_rank: v.search_rank, fantasy_positions: v.fantasy_positions, years_exp: v.years_exp ?? null, age: v.age ?? null };
  }
  await save('players-trimmed.json', trimmed);

  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n✓ manifest.json written —', Object.keys(manifest.files).length, 'fixtures');
}

main().catch((e) => { console.error('CAPTURE FAILED:', e); process.exit(1); });
