## What & why



## The inspectors (Fable File 03, Part 8)
- [ ] New engine code has known-answer tests, and I ran the mutation check
- [ ] New fetcher has a fixture + schema + degradation test
- [ ] New component has interaction + degradation + a11y-ish tests (query by role/text, not class)
- [ ] Visual/mobile change eyeballed on the phone viewport (or E2E updated)
- [ ] Anti-AI checklist eyeballed on changed pages (no backdrop-filter, palette tokens, seeded jitter)

CI gates (auto): token-lint · unit + coverage · build · bundle-budget · E2E. Green = mergeable.
