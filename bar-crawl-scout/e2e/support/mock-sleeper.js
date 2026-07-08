// mockSleeper(page) — Fable File 03, Part 5: every api.sleeper.app AND sync-Worker
// call is fulfilled from fixtures, so E2E has ZERO live traffic. Also seeds a
// barstool identity + rosters in localStorage so data views render.
const SCORING = { pass_yd: 0.04, pass_td: 6, pass_int: -1, rush_yd: 0.1, rush_td: 6, rec: 0.5, rec_yd: 0.1, rec_td: 6, fum_lost: -2 };
const USERS = [
  { user_id: '1', display_name: 'witherssssss' }, { user_id: '2', display_name: 'joshleota' },
];
const ROSTERS = [
  { roster_id: 1, owner_id: '1', players: ['4046'], starters: ['4046'], settings: { wins: 8, losses: 3, fpts: 1400 } },
  { roster_id: 2, owner_id: '2', players: ['4034'], starters: ['4034'], settings: { wins: 6, losses: 5, fpts: 1300 } },
];
const WORKER_ROSTERS = {
  Ryan: { count: 1, players: [{ n: 'Joe Burrow', p: 'QB', t: 'CIN', s: true }] },
  joshleota: { count: 1, players: [{ n: 'Justin Jefferson', p: 'WR', t: 'MIN', s: true }] },
};

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

export async function mockSleeper(page) {
  // Barstool identity + live rosters, before any script runs.
  await page.addInitScript((rosters) => {
    localStorage.setItem('bcs_bettor', JSON.stringify('Ryan'));
    localStorage.setItem('hq_rosters_v2', JSON.stringify({ t: new Date(0).toISOString(), byHandle: rosters }));
  }, WORKER_ROSTERS);

  await page.route(/api\.sleeper\.app/, (route) => {
    const url = route.request().url().split('?')[0];
    if (url.endsWith('/state/nfl')) return json(route, { week: 8, season: '2026', season_type: 'regular' });
    if (/\/league\/\d+$/.test(url)) return json(route, { league_id: '1311995695032467456', name: 'Bar Crawl', season: '2026', scoring_settings: SCORING, previous_league_id: null });
    if (url.endsWith('/users')) return json(route, USERS);
    if (url.endsWith('/rosters')) return json(route, ROSTERS);
    if (url.includes('/matchups/')) return json(route, []);
    if (url.includes('/players/nfl')) return json(route, {});
    return json(route, []); // transactions, drafts, brackets, trending, etc.
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
