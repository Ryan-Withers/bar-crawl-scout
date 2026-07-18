# Self-build log

One line per night from the autonomous loop: the inspectors triage CI/Inspector/deploy,
then design and ship one small feature. Ryan skims this instead of watching PRs.

| Date | Feature | Why |
|------|---------|-----|
| 2026-07-10 | War Room: "📋 copy for the group chat" on the mock debrief — podium, your haul, steal & reach of the draft, and a run-yours link, one tap to the clipboard | A mock nobody can flex about is a mock half-finished; banter is the product in a 10-mate league |
| 2026-07-12 | Dossiers: "Form & records" — last-5 W/L chips, active streak/skid, best & worst week with opponent, longest win run (new streaks engine + season-matchups query) | The Files talked tendencies but couldn't answer "is he hot right now?" — the first question before any trade offer |
| 2026-07-16 | History: "The bracket" — an expandable per-season playoff tree (semis→final, champion crowned, 3rd-place badge) on each Wall banner (new brackettree engine over the already-fetched winners_bracket) | assembleWall was fetching the full bracket and throwing away everything but the champion — the dynasty-history page can now actually show how each title was won |
| 2026-07-17 | The Table: "The Luck Index" — all-play expected wins vs actual, luckiest-first, with a +/- luck delta (new allplay engine over the season-matchups query) | Settles the league's oldest argument — "you're 7-3 but you've been lucky" — by scoring every team against the whole field each week, not just its one opponent |
| 2026-07-18 | Player File: "Consistency" card — floor/mean/ceiling range, volatility, relative swing, boom/bust weeks and a STEADY/STREAKY/BOOM-OR-BUST verdict (new consistency engine over the game-log weeks) | Answers the start/sit question the game log couldn't — safe floor or coin flip — off box scores already on the page |
