# Changelog

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
