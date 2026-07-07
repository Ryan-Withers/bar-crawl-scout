# Changelog

## 2.0.0

Rebuilt as a **Vite + Svelte single-page app** with the same look and behaviour, plus
live data on open. No feature was dropped.

- Componentized: one Svelte component per tab (Board, Keepers, Managers, Trade, FAAB,
  Intel, Sync) over a shared app shell, with reactive stores on the same `localStorage`
  keys so existing saved data carries over untouched.
- Valuation and keeper logic extracted to pure, unit-tested ES modules (`src/lib`).
- Live rosters now auto-load from the Cloudflare sync Worker on page open — no manual
  Sync tap and no large player-dictionary download for leaguemates. Manual Sync remains
  for FAAB medians and draft history.
- Commissioner redaction preserved everywhere (Board, Keepers, Managers, Trade, FAAB,
  Intel) and covered by tests.
- Tooling: Vitest unit tests, a `npm run build` production bundle, and CI that runs the
  tests and the build on every push and pull request. Netlify now builds in CI.

## 1.0.0

First tracked release. The app existed before this as a single deployable file; this
version gives it a proper repo: documentation, a CI-enforced test suite, the optional
sync Worker, and static-host deploy config.

- Board, Keepers, Managers, Trade, FAAB, Intel, and Sync tabs.
- Keeper-based pool model: only projected keepers leave the draftable pool, so rostered
  non-keepers stay available for mocks and remain searchable.
- Live-roster display on the board as info only ("POOL - on [team]"), which never gates
  availability. The commissioner's roster stays sealed.
- Team Mapping diagnostic in the Sync output to expose any roster-to-manager mismatch.
- Test suite (jsdom) locking in keeper accuracy, redaction, the pool model, and the
  live-roster display, run automatically in CI on every push.
