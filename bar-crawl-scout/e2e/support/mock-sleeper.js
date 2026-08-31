// mockSleeper(page) — every api.sleeper.app AND sync-Worker call is fulfilled
// from the CAPTURED league, so E2E has zero live traffic and still sees the
// league the app is actually for.
//
// It used to serve a two-man synthetic league with no keepers, no draft and an
// empty player blob. That was cheap to write and it meant almost every browser
// spec ran the FALLBACK paths — hand-written projections instead of Sleeper's
// locked keepers, the hand-counted CAPITAL constant instead of traded picks,
// the flat pick board instead of the real slots. The live paths were exercised
// by exactly one spec, which is the wrong way round: the fallbacks are what
// nobody sees.
//
// So this now serves the same fixtures real-board.spec.js does — ten managers,
// thirty locked keepers, forty-seven traded 2026 picks, three trades in
// principle — and every spec gets them for free. Specs that want a deliberately
// odd league (an empty one, a league mid-draft) still route over the top of
// this, which is why the routing here is registered first and matched last.
import fs from 'node:fs';
import path from 'node:path';
import { normHandle } from '../../src/api/league';

const DIR = path.join(process.cwd(), 'src/lib/api/fixtures');
const cache = new Map();
const read = (name) => {
  if (!cache.has(name)) {
    const file = path.join(DIR, name);
    cache.set(name, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
  }
  return cache.get(name);
};

const LEAGUE = read('league.json');
const SEASON = String(LEAGUE.season);
const PREV = read('league-2025.json');
const DRAFT_ID = read('drafts-2026.json')[0].draft_id;
const PREV_DRAFT_ID = read('drafts-2025.json')[0].draft_id;

// THE SECOND LEAGUE, from its own captured set.
//
// The redraft league is a different league id and a different draft id, and its
// fixtures live in their own directory so that capturing one cannot overwrite the
// other. Everything below matches on those ids BEFORE the league-A routes, so a
// request for the redraft board is answered with the redraft league's real data
// rather than falling through and being served ten teams and thirty keepers under
// its own name — which is exactly the bug a shared mock invites.
const DIR_B = path.join(process.cwd(), 'src/lib/api/fixtures-b');
const cacheB = new Map();
const readB = (name) => {
  if (!cacheB.has(name)) {
    const file = path.join(DIR_B, name);
    cacheB.set(name, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
  }
  return cacheB.get(name);
};
const LEAGUE_B = readB('league.json');
const DRAFT_ID_B = (readB('drafts-2026.json') || [{}])[0].draft_id;

// The Worker's roster snapshot, built from the captured rosters so My Team, the
// Bye Radar and the Matchup preview see real squads rather than one man each.
const workerRosters = () => {
  const users = read('users-2026.json');
  const blob = read('players-trimmed.json');
  // The Worker keys by the app's HANDLE, not by Sleeper's display name — Ryan's
  // is "witherssssss" and every reader looks him up as "Ryan".
  const byId = Object.fromEntries(users.map((u) => [u.user_id, normHandle(u.display_name || u.user_id)]));
  const out = {};
  for (const r of read('rosters-2026.json')) {
    const handle = byId[r.owner_id];
    if (!handle) continue;
    const starters = new Set((r.starters || []).map(String));
    const players = (r.players || []).map((id) => {
      const p = blob[String(id)];
      return p ? { n: p.full_name, p: p.position, t: p.team || 'FA', s: starters.has(String(id)) } : null;
    }).filter(Boolean);
    out[handle] = { count: players.length, players };
  }
  return out;
};

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body ?? []) });

// season + week out of a Sleeper path like /matchups/8 on a league of a season.
const weekOf = (url) => Number((url.match(/\/(\d+)$/) || [])[1] || 0);

export async function mockSleeper(page) {
  const WORKER_ROSTERS = workerRosters();

  // Barstool identity + live rosters, before any script runs.
  await page.addInitScript((rosters) => {
    localStorage.setItem('bcs_bettor', JSON.stringify('Ryan'));
    localStorage.setItem('hq_rosters_v2', JSON.stringify({ t: new Date(0).toISOString(), byHandle: rosters }));
  }, WORKER_ROSTERS);

  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];

    // The redraft league first — its ids are distinct, so this can never shadow
    // a league-A route, and leaving it later would let the generic /rosters and
    // /drafts handlers below answer for it with the wrong league's data.
    if (LEAGUE_B && url.includes(`/league/${LEAGUE_B.league_id}`)) {
      if (url.endsWith('/users')) return json(route, readB('users-2026.json'));
      if (url.endsWith('/rosters')) return json(route, readB('rosters-2026.json'));
      if (url.endsWith('/drafts')) return json(route, readB('drafts-2026.json'));
      if (url.endsWith('/traded_picks')) return json(route, readB('traded_picks-2026.json'));
      if (url.endsWith('/winners_bracket')) return json(route, readB('winners_bracket-2026.json'));
      if (url.includes('/matchups/')) return json(route, readB(`matchups-2026-${weekOf(url)}.json`));
      if (url.includes('/transactions/')) return json(route, readB(`transactions-2026-${weekOf(url)}.json`));
      if (/\/league\/\d+$/.test(url)) return json(route, LEAGUE_B);
      return json(route, []);
    }
    if (DRAFT_ID_B && url.includes(`/draft/${DRAFT_ID_B}`)) {
      if (url.endsWith('/picks')) return json(route, readB('draft-picks-2026.json'));
      if (url.endsWith('/traded_picks')) return json(route, readB('traded_picks-2026.json'));
      return json(route, []);
    }

    if (url.endsWith('/state/nfl')) return json(route, read('state.json'));
    if (url.includes('/players/nfl')) return json(route, read('players-trimmed.json'));
    if (url.includes('/trending/add')) return json(route, read('trending-add.json'));
    if (url.includes('/trending/drop')) return json(route, read('trending-drop.json'));

    // Which season's league is being asked for decides which fixtures answer.
    const prev = PREV && url.includes(`/league/${PREV.league_id}`);
    const yr = prev ? String(PREV.season) : SEASON;

    if (url.includes(`/draft/${DRAFT_ID}/picks`)) return json(route, read('draft-picks-2026.json'));
    if (url.includes(`/draft/${PREV_DRAFT_ID}/picks`)) return json(route, read('draft-picks-2025.json'));
    if (/\/draft\/\d+\/picks$/.test(url)) return json(route, []);
    if (url.endsWith('/traded_picks')) return json(route, read(`traded_picks-${yr}.json`));
    if (url.endsWith('/drafts')) return json(route, read(`drafts-${yr}.json`));
    if (url.endsWith('/users')) return json(route, read(`users-${yr}.json`));
    if (url.endsWith('/rosters')) return json(route, read(`rosters-${yr}.json`));
    if (url.endsWith('/winners_bracket')) return json(route, read(`winners_bracket-${yr}.json`));
    if (url.includes('/matchups/')) return json(route, read(`matchups-${yr}-${weekOf(url)}.json`));
    if (url.includes('/transactions/')) return json(route, read(`transactions-${yr}-${weekOf(url)}.json`));
    if (/\/league\/\d+$/.test(url)) return json(route, prev ? PREV : LEAGUE);
    if (/\/(projections|stats)\/nfl\//.test(url)) {
      // Week-level first, then the SEASON-level set — whole-season stat lines,
      // which is what The Sheet is built on and which the week regex silently
      // swallowed, leaving that page reporting "no projections came back".
      const wk = url.match(/\/(projections|stats)\/nfl\/regular\/(\d+)\/(\d+)$/);
      if (wk) return json(route, read(`${wk[1]}-${wk[2]}-${wk[3]}.json`));
      const yr = url.match(/\/(projections|stats)\/nfl\/regular\/(\d+)$/);
      if (yr) return json(route, read(`season-${yr[1]}-${yr[2]}.json`) || {});
      return json(route, []);
    }
    return json(route, []);
  });

  await page.route(/workers\.dev/, (route) => {
    const url = route.request().url();
    if (url.includes('/book/bets')) return json(route, { bets: [] });
    if (url.includes('/book/')) return json(route, { ok: false });
    return json(route, { ts: new Date(0).toISOString(), rosters: WORKER_ROSTERS });
  });
}

// Collect uncaught page errors so specs can assert none.
export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
