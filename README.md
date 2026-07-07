# Bar Crawl Scout

A keeper-league scouting board for the **Official Bar Crawl Order** league (10-team, half-PPR, Sleeper). It ranks the draftable pool, tracks projected keepers per manager, models FAAB bids and trade value, and pulls live rosters straight from Sleeper.

Live site: https://timely-souffle-28ce9e.netlify.app/

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

This is a single self-contained `index.html`: markup, styles, logic, and the ranked player data all live in one file. That is deliberate. The target device cannot run build tools, so there is no bundler, no framework, and no build step. The file is the deployable artifact.

- **State** is kept in the browser via `localStorage` (keeper edits, board views and tags, cached Sleeper data). Nothing is stored server-side by the site itself.
- **Live data** comes from the public Sleeper API at sync time.
- **Models** (value, points, FAAB, trade) are pure functions over the ranked pool and the keeper map. They are documented inline in `index.html`.

## Syncing live data

The **Sync** tab pulls the league, users, rosters, last season's transactions (for FAAB medians), past draft picks, and the Sleeper player dictionary.

Sync must run in a **real browser tab** (not an in-app preview), because the Sleeper API blocks cross-origin requests from sandboxed frames. Open the live URL directly, then hit Sync.

## Known limitation: live-roster attribution

The Managers tab shows each roster directly from Sleeper and is authoritative. The board's "on [team]" label is a convenience that depends on two joins:

1. **Owner mapping** - which Sleeper account maps to which manager, matched by display name.
2. **Name matching** - matching a board player to a roster entry by name text.

Either join can misattribute if a leaguemate's Sleeper display name differs from the handle on file. The Sync tab now prints a **Team Mapping** readout (`roster [id]: Sleeper "[name]" -> [manager]`) so any bad mapping is visible. The permanent fix is to pin a `roster_id -> manager` table once the real IDs are read off that readout, which removes the display-name guessing entirely.

## Deploying

The site is a static file, so any static host works. Two clean options:

**Netlify (current).** Connect this repo to a Netlify site. `netlify.toml` sets the publish directory to the repo root with no build step. Every push to the default branch redeploys automatically. No more drag-and-drop.

**Cloudflare Pages.** Point a Pages project at this repo, framework preset "None", build command empty, output directory `/`. Free, unlimited bandwidth, and it sits next to the sync Worker (below).

To update the site: edit `index.html`, push, and the host redeploys. CI runs the test suite on the same push.

## Tests

The suite loads `index.html` in jsdom and locks in the invariants that have regressed before: keeper accuracy per team, no player kept by two teams, the redaction of the commissioner's team, the pool model (non-keepers stay draftable), and the live-roster display.

```
npm install
npm test
```

CI (`.github/workflows/ci.yml`) runs `npm test` on every push and pull request, so a change that breaks an invariant fails the check before it can ship.

## Optional backend: the sync Worker

`worker/scout-sync-worker.js` is a Cloudflare Worker that syncs Sleeper on a schedule and serves one small cached JSON, so nobody has to hit Sync and nobody downloads the large player dictionary. It is optional and not wired into the site yet. Deploy steps are in the file header. Once it is live, the site can read from it instead of each person syncing.

## Roadmap

- Pin the `roster_id -> manager` table to make live-roster attribution bulletproof.
- Wire the site to the sync Worker so live data loads without a manual Sync.
- Extend live value into the season rather than a static preseason ranking.
- A shared layer: power rankings, a trade block, and a moves feed.

## License

Personal project for the Official Bar Crawl Order league. See `LICENSE`.
