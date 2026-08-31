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
// WHERE THE CAPTURE LANDS. Defaults to the fixtures the whole suite reconciles
// against; --out puts a SECOND league somewhere of its own. Without that, running
// this for another league would silently overwrite the first league's fixtures
// under the same filenames and every known-answer test would start reconciling
// against a league it was never written for.
const argOut = (() => { const i = process.argv.indexOf('--out'); return i >= 0 ? process.argv[i + 1] : null; })();
const OUT_DIR = (argOut || 'fixtures').replace(/[^a-z0-9_-]/gi, '');
const OUT = join(HERE, '..', 'src', 'lib', 'api', OUT_DIR);
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
  console.log('Capturing fixtures for league', LEAGUE_ID, '->', OUT_DIR);

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
    // Every draft in the season, not just the first. The keeper picks live in
    // /draft/<id>/picks with is_keeper set, and a season can hold more than one
    // draft object — taking [0] on faith is how you capture the empty one.
    for (const d of drafts || []) {
      const picks = await ok(() => j(`/draft/${d.draft_id}/picks`));
      const kept = (picks || []).filter((p) => p && p.is_keeper).length;
      console.log(`    draft ${d.draft_id} (${d.status}): ${(picks || []).length} picks, ${kept} keeper`);
      await save(d.draft_id === (drafts[0] || {}).draft_id ? `draft-picks-${season}.json` : `draft-picks-${season}-${d.draft_id}.json`, picks);
      (picks || []).forEach((p) => { if (p && p.player_id) rosterPlayerIds.add(String(p.player_id)); });
    }
    // What each roster has actually LOCKED as a keeper. Sleeper keeps this on
    // the roster, and it is the only source that is right by construction —
    // everything else in this app used to be a hand-typed guess.
    (rosters || []).forEach((r) => (r.keepers || []).forEach((id) => rosterPlayerIds.add(String(id))));
    const keeperCount = (rosters || []).filter((r) => (r.keepers || []).length).length;
    console.log(`    keepers set on ${keeperCount}/${(rosters || []).length} rosters`);
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

  // Players blob FIRST — the top-600 list is also the trim list for the
  // season-level blobs below, so it has to exist before they are fetched.
  console.log('\nPlayers blob (trimming)…');
  const all = await j('/players/nfl');
  const ranked = Object.entries(all)
    .filter(([, v]) => v && v.search_rank != null && v.search_rank < 100000)
    .sort((a, b) => a[1].search_rank - b[1].search_rank)
    .slice(0, 600)
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

  // SEASON-level stats + projections, per season in the chain. The weekly
  // endpoints don't carry a whole-season line, and the draft sheet re-scores
  // the season projection under the league's own rulebook — so without these
  // the sheet has nothing to reconcile against in tests.
  console.log('\nSeason-level stats + projections…');
  for (const lg of chain) {
    const trimSeason = (blob) => {
      if (!blob) return blob;
      const out = {};
      for (const id of Object.keys(blob)) if (keep.has(id)) out[id] = blob[id];
      return out;
    };
    await save(`season-stats-${lg.season}.json`, trimSeason(await ok(() => j(`/stats/nfl/regular/${lg.season}`))));
    await save(`season-projections-${lg.season}.json`, trimSeason(await ok(() => j(`/projections/nfl/regular/${lg.season}`))));
  }

  // Trending (current).
  await save('trending-add.json', await ok(() => j('/players/nfl/trending/add?limit=25')));
  await save('trending-drop.json', await ok(() => j('/players/nfl/trending/drop?limit=25')));

  // THE KEEPER LEDGER — printed loud, because this is the one thing in the app
  // that used to be hand-typed and guessed at. Names, not ids, and the count per
  // manager, so a short roster is obvious in the run log rather than three
  // layers deep in a JSON diff. Keeper-round picks get traded in this league,
  // so the draft board's own keeper picks are printed alongside and any
  // disagreement between the two sources is called out rather than averaged.
  console.log('\n=== KEEPERS LOCKED (current season) ===');
  const cur0 = chain[0];
  const curUsers = await ok(() => j(`/league/${cur0.league_id}/users`)) || [];
  const curRosters = await ok(() => j(`/league/${cur0.league_id}/rosters`)) || [];
  const handle = (ownerId) => (curUsers.find((u) => u.user_id === ownerId) || {}).display_name || ownerId;
  const nameOf = (id) => (all[String(id)] || {}).full_name || `#${id}`;
  const posOf = (id) => (all[String(id)] || {}).position || '?';
  const ledger = {};
  for (const r of curRosters) {
    const ks = (r.keepers || []).map(String);
    ledger[handle(r.owner_id)] = { rosterId: r.roster_id, keepers: ks.map((id) => ({ id, name: nameOf(id), pos: posOf(id) })) };
    const flag = ks.length === 3 ? '' : `  <-- ${ks.length} of 3`;
    console.log(`  ${String(handle(r.owner_id)).padEnd(14)} ${ks.map((id) => `${nameOf(id)} (${posOf(id)})`).join(', ') || '(none set)'}${flag}`);
  }
  // Cross-check against the draft board itself.
  const curDrafts = await ok(() => j(`/league/${cur0.league_id}/drafts`)) || [];
  for (const d of curDrafts) {
    const picks = await ok(() => j(`/draft/${d.draft_id}/picks`)) || [];
    const kp = picks.filter((p) => p && p.is_keeper);
    if (!kp.length) continue;
    console.log(`\n  Draft ${d.draft_id} keeper picks (${kp.length}):`);
    for (const p of kp) console.log(`    R${p.round} pick ${p.pick_no} roster ${p.roster_id}: ${nameOf(p.player_id)}`);
  }
  await save('keeper-ledger.json', ledger);

  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n✓ manifest.json written —', Object.keys(manifest.files).length, 'fixtures');
}

main().catch((e) => { console.error('CAPTURE FAILED:', e); process.exit(1); });
