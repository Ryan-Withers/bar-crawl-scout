# Bar Crawl Scout

A keeper-league scouting board for the **Official Bar Crawl Order** league (10-team, half-PPR, Sleeper). It ranks the draftable pool, tracks projected keepers per manager, models FAAB bids and trade value, and pulls live rosters straight from Sleeper.

Live site: https://ryan-withers.github.io/bar-crawl-scout/

## What it does

- **Board** - a rankable, tag-able draft board over the player pool. Only projected keepers leave the pool, so rostered non-keepers stay draftable for mocks. Sort by projected value windows (WIN), single-year values (R26/R27), or projected points (P26/P27).
- **Keepers** - the projected keeper card for every team, with confidence (Very Likely / Likely / Watch).
- **Managers** - a posture read on each rival plus their live Sleeper roster once synced.
- **Trade** - a two-sided value read for proposing or judging a deal.
- **FAAB** - a suggested bid and tier for a free agent, built from last season's real bid medians.
- **Intel** - best-available reads and league context.
- **Sync** - pulls live data from Sleeper (see below).

The commissioner's own team is redacted throughout (it is a tool shared with leaguemates).

## Architecture

Bar Crawl Scout is a **Vite + Svelte single-page app**. The source lives in `src/`; GitHub Actions runs the build in CI and Pages serves the static bundle, so the target device only ever loads finished output — it never runs a build tool.

- `index.html` — Vite entry that mounts the app.
- `src/App.svelte` — the shell: masthead, window-mode bar, tab navigation, and the on-open live auto-load.
- `src/components/` — one component per tab: `Board`, `Keepers`, `Managers`, `Trade`, `Faab`, `Intel`, `Sync`.
- `src/lib/`
  - `data.js` — the ranked player pool, teams, keeper projections, capital, and tuning constants (pure values).
  - `models.js` — pure valuation and keeper functions (WIN/value, points, FAAB, trade), parameterized by the keeper map and window mode.
  - `store.js` — reactive Svelte stores backed by `localStorage` (keeper edits, board views/tags, cached rosters, mode).
  - `sleeper.js` / `sync.js` — the live-roster auto-load and the manual full Sleeper pull.
  - `util.js` — small helpers.
- `src/app.css` — all styles.

- **State** lives in the browser via `localStorage`. Nothing is stored server-side by the site itself.
- **Live data** comes from the sync Worker (auto-loaded on open) and the public Sleeper API (manual full Sync).

## Syncing live data

Live rosters load **automatically on page open** from the sync Worker (see below), so most of the time nobody has to tap anything. The **Sync** tab runs a full manual pull — league, users, rosters, last season's transactions (FAAB medians), past draft picks, and the Sleeper player dictionary — and must run in a **real browser tab** (the Sleeper API blocks sandboxed frames).

## Known limitation: live-roster attribution

The Managers tab shows each roster directly from Sleeper and is authoritative. The board's "on [team]" label is a convenience that depends on two joins:

1. **Owner mapping** - which Sleeper account maps to which manager, matched by display name.
2. **Name matching** - matching a board player to a roster entry by name text.

Either join can misattribute if a leaguemate's Sleeper display name differs from the handle on file. The Sync tab now prints a **Team Mapping** readout (`roster [id]: Sleeper "[name]" -> [manager]`) so any bad mapping is visible. The permanent fix is to pin a `roster_id -> manager` table once the real IDs are read off that readout, which removes the display-name guessing entirely.

## Deploying

**GitHub Pages (current).** `.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` to https://ryan-withers.github.io/bar-crawl-scout/. The app is served from the `/bar-crawl-scout/` subpath, and `npm run build` copies `dist/index.html` to `dist/404.html` so deep links survive a cold load — Pages serves the 404 document and the router takes it from there. `inspector.yml` smoke-tests that URL nightly.

**Netlify (connected, but not the live site).** Netlify is still linked to this repo from an earlier setup. `netlify.toml` now cancels every build (`ignore = "exit 0"`) so it stops consuming free-tier build minutes publishing a site nobody opens. Unlink it in the Netlify UI and the file can be deleted.

**Cloudflare Pages.** Point a Pages project at this repo, build command `npm run build`, output directory `dist`. It sits next to the sync Worker (below).

To update the site: edit `src/`, push to `main`, and the deploy workflow rebuilds and redeploys.

## Tests

Unit tests (Vitest) cover the live-sync adapter and the valuation/keeper models — the invariants that have regressed before: exact keeper set and confidence per team, no player kept by two teams, the redaction of the commissioner's team, the pool model (non-keepers stay draftable), and final-year replacement value.

```
npm install
npm test        # vitest
npm run build   # production bundle -> dist/
```

CI (`.github/workflows/ci.yml`) runs the tests and a production build on every push and pull request, so a change that breaks an invariant or the build fails the check before it can ship.

## Backend: the sync Worker

`worker/scout-sync-worker.js` is a Cloudflare Worker that syncs Sleeper hourly and serves one small cached JSON, so nobody has to hit Sync and nobody downloads the large player dictionary. The site reads it on open — the URL is `SYNC_URL` in `src/lib/sleeper.js`. Deploy steps are in the file header.

## Roadmap

- Pin the `roster_id -> manager` table to make live-roster attribution bulletproof.
- Rebuild the UI around a new primary palette.
- Extend live value into the season rather than a static preseason ranking.
- A shared layer: power rankings, a trade block, and a moves feed.

## License

Personal project for the Official Bar Crawl Order league. See `LICENSE`.
