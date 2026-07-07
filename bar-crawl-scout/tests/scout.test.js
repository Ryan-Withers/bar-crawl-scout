/*
 Bar Crawl Scout - test suite.
 Loads index.html in jsdom, exposes the app's internal data via a bridge script,
 and locks in the invariants that have historically regressed (keeper accuracy,
 redaction, the pool model, live-roster display). Run with: npm test
 Exits non-zero if any check fails, so CI blocks a bad deploy.
*/
const fs = require("fs");
const path = require("path");
const { JSDOM, ResourceLoader } = require("jsdom");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// The app is split into local css/ + js/ modules. Serve those from disk so the real
// deployed files are what gets tested, but block http(s) (fonts/CDN) to avoid the
// network flakiness the suite has always deliberately avoided. Keeping a real https
// origin (below) also means jsdom localStorage works, which the app relies on.
class LocalLoader extends ResourceLoader {
  fetch(url, options) {
    const m = url.match(/\/(css|js)\/([\w.-]+)$/);
    if (m) {
      const file = path.join(__dirname, "..", m[1], m[2]);
      return Promise.resolve(fs.readFileSync(file));
    }
    return null; // block fonts/CDN and anything else external
  }
}

// authoritative 2026 keepers (VL/L locked, U = watch/stays in pool)
const EXPECT = {
  joshleota:   { "Jahmyr Gibbs":"VL","Puka Nacua":"VL","Drake London":"VL","Justin Jefferson":"U" },
  WinzTheBrah: { "James Cook":"VL","Breece Hall":"VL","A.J. Brown":"L","Garrett Wilson":"U" },
  JohnnyDuff:  { "Ashton Jeanty":"VL","De'Von Achane":"VL","Jaxon Smith-Njigba":"VL","Trey McBride":"U" },
  jduddy9:     { "Omarion Hampton":"VL","Christian McCaffrey":"VL","Rashee Rice":"L","Derrick Henry":"U" },
  jpdonners:   { "CeeDee Lamb":"VL","Josh Jacobs":"VL","Travis Etienne Jr.":"L","Jordan Addison":"U" },
  ATorelli4:   { "Amon-Ra St. Brown":"VL","TreVeyon Henderson":"VL","Kenneth Walker III":"L","Drake Maye":"U" },
  JShrimp341:  { "Saquon Barkley":"VL","Chase Brown":"VL","Kyren Williams":"VL","Tyler Warren":"U" },
  ShaydenB:    { "Jonathan Taylor":"VL","Nico Collins":"VL","Quinshon Judkins":"L","DeVonta Smith":"U" },
  ImyHunter:   { "Bijan Robinson":"VL","Malik Nabers":"VL","Emeka Egbuka":"L","Cam Skattebo":"U" }
};
const RYAN_KEEPERS = ["Tetairoa McMillan", "Ja'Marr Chase", "Brock Bowers"];

let pass = 0, fail = 0;
const errors = [];
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; errors.push(msg); } };

// no external resource loading: the app is fully self-contained, so fonts/CDN are
// irrelevant to logic and would only add network flakiness in CI.
const dom = new JSDOM(HTML, {
  runScripts: "dangerously",
  resources: new LocalLoader(),
  pretendToBeVisual: true,
  url: "https://timely-souffle-28ce9e.netlify.app/"
});
const { window } = dom;
const uncaught = [];
window.addEventListener("error", e => uncaught.push(String(e.error || e.message)));

function runChecks() {
  const d = window.document;

  // bridge: top-level const/let are not on window, so copy them across
  const bridge = d.createElement("script");
  bridge.textContent =
    'window.__d={TEAMS:TEAMS,KS:KS,CAPITAL:CAPITAL,MGRS:MGRS,LEAN:LEAN,' +
    'REBUILD:[...REBUILD],CONTEND:[...CONTEND],PLAYERS:PLAYERS,RYAN:RYAN};';
  d.body.appendChild(bridge);
  const D = window.__d;

  const rowOf = nm => [...d.querySelectorAll("#boardbody tr")]
    .find(tr => tr.querySelector(".pname") && tr.querySelector(".pname").textContent === nm);
  const clickTab = t => { const b = d.querySelector('[data-tab="' + t + '"]'); if (b) b.click(); };

  // ---- app loads ----
  ok(!!D && Array.isArray(D.TEAMS), "app booted and exposed internals");
  ok(D.TEAMS.length === 10, "10 teams in TEAMS (got " + (D.TEAMS && D.TEAMS.length) + ")");
  ok(Array.isArray(D.PLAYERS) && D.PLAYERS.length >= 150, "player pool loaded (" + (D.PLAYERS && D.PLAYERS.length) + ")");

  const handles = D.TEAMS.map(t => t[0]);
  handles.forEach(h => {
    ok(D.CAPITAL[h], h + " present in CAPITAL");
    ok(D.KS[h], h + " present in KS");
    ok(D.MGRS.some(m => m.h === h), h + " present in MGRS");
  });

  // ---- keeper integrity: exact match against the authoritative set ----
  Object.keys(EXPECT).forEach(h => {
    const got = {};
    (D.KS[h] || []).forEach(s => { if (s[0]) got[s[0]] = s[1]; });
    Object.keys(EXPECT[h]).forEach(nm => {
      ok(got[nm] === EXPECT[h][nm], h + " keeper " + nm + " should be " + EXPECT[h][nm] + " (got " + got[nm] + ")");
    });
  });

  // Ryan's three keepers exist somewhere with owner === RYAN
  const ryanTeam = Object.keys(D.KS).find(h =>
    (D.KS[h] || []).some(s => s[0] === "Ja'Marr Chase"));
  ok(!!ryanTeam, "found Ryan's keeper team");
  RYAN_KEEPERS.forEach(nm => {
    ok((D.KS[ryanTeam] || []).some(s => s[0] === nm), "Ryan keeper present: " + nm);
  });

  // no player kept (VL/L) by two teams
  const seen = {}; let dup = 0;
  handles.forEach(h => (D.KS[h] || []).forEach(s => {
    if (s[0] && s[1] !== "U") { if (seen[s[0]]) dup++; else seen[s[0]] = h; }
  }));
  ok(dup === 0, "no player kept (VL/L) by two teams");

  // recurring-bug guards
  let jjBad = 0;
  handles.forEach(h => (D.KS[h] || []).forEach(s => { if (s[0] === "Justin Jefferson" && s[1] !== "U") jjBad++; }));
  ok(jjBad === 0, "Justin Jefferson is never a VL/L keeper");
  ok((D.KS.joshleota || []).some(s => s[0] === "Justin Jefferson" && s[1] === "U"), "Jefferson is joshleota's watch (U)");

  // rebuild/contend valid and disjoint
  ok(D.REBUILD.every(h => handles.includes(h)), "REBUILD members are valid handles");
  ok(D.CONTEND.every(h => handles.includes(h)), "CONTEND members are valid handles");
  ok(D.REBUILD.filter(h => D.CONTEND.includes(h)).length === 0, "REBUILD and CONTEND are disjoint");

  // ---- render + redaction ----
  clickTab("board");
  ok(d.querySelectorAll("#boardbody tr").length > 0, "board renders rows");
  d.querySelector("#poolchip").classList.contains("on") || d.querySelector("#poolchip").click(); // ensure pool-only on
  ok(!rowOf("Ja'Marr Chase"), "keeper hidden by pool-only");
  d.querySelector("#poolchip").click(); // show all
  const chase = rowOf("Ja'Marr Chase");
  ok(chase && /CLASSIFIED/.test(chase.innerHTML), "Ryan's keeper shows CLASSIFIED, not his name");
  ok(!/VERY LIKELY[^<]*Ryan/.test(d.querySelector("#boardbody").innerHTML), "Ryan is never named as an owner on the board");

  // a non-keeper is available in the pool and searchable
  d.querySelector("#poolchip").classList.contains("on") || d.querySelector("#poolchip").click();
  d.querySelector("#psearch").value = "nix"; d.querySelector("#psearch").dispatchEvent(new window.Event("input"));
  ok(!!rowOf("Bo Nix"), "non-keeper stays in the pool and is searchable");
  d.querySelector("#psearch").value = ""; d.querySelector("#psearch").dispatchEvent(new window.Event("input"));

  // ---- live roster display: info only, does not gate the pool ----
  const inj = d.createElement("script");
  inj.textContent =
    'localStorage.setItem("hq_rosters_v2",JSON.stringify({t:"now",byHandle:{' +
    'joshleota:{count:1,players:[{n:"Chris Olave",p:"WR",t:"NO",s:true}]}}}));renderBoard();';
  d.body.appendChild(inj);
  const olave = rowOf("Chris Olave");
  ok(olave && /on joshleota/.test(olave.innerHTML), "rostered non-keeper shows its live owner");
  ok(olave && /POOL/.test(olave.innerHTML), "rostered non-keeper still shows POOL (stays draftable)");

  // ---- FAAB redaction ----
  clickTab("faab");
  if (d.querySelector("#fnm") && d.querySelector("#fgo")) {
    d.querySelector("#fnm").value = "Ja'Marr Chase"; d.querySelector("#fgo").click();
    ok(/Access denied|CLASSIFIED/i.test(d.querySelector("#fout").innerHTML), "FAAB blocks Ryan's keeper");
    d.querySelector("#fnm").value = "Bo Nix"; d.querySelector("#fgo").click();
    ok(/Suggested bid/i.test(d.querySelector("#fout").innerHTML), "FAAB prices an available player");
  }

  // ---- every tab renders without throwing ----
  ["keepers", "mgrs", "trade", "plan", "sync", "board"].forEach(t => {
    let threw = false;
    try { clickTab(t); } catch (e) { threw = true; }
    ok(!threw, "tab renders without throwing: " + t);
  });

  ok(uncaught.length === 0, "no uncaught errors (" + uncaught.join(" | ") + ")");

  // ---- report ----
  console.log("\nBar Crawl Scout tests: " + pass + " passed, " + fail + " failed");
  if (fail) { console.log("\nFailures:"); errors.forEach(e => console.log("  - " + e)); }
  process.exit(fail ? 1 : 0);
}
// Wait for external css/js modules to load and execute before probing internals.
if (window.document.readyState === "complete") setTimeout(runChecks, 100);
else window.addEventListener("load", () => setTimeout(runChecks, 100));
