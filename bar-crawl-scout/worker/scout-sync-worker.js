// Bar Crawl Scout - Sleeper sync Worker (Cloudflare Workers)
// PURPOSE: sync Sleeper once on a schedule and serve a small cached JSON the site reads,
// so nobody has to tap Sync and nobody downloads the 5MB player file. This is item 1.
//
// SETUP (one time, free):
//   1. cloudflare.com -> Workers & Pages -> Create -> Worker. Name it e.g. scout-sync.
//   2. Paste this whole file into the editor (replace the default).
//   3. Storage & Databases -> KV -> Create a namespace called SCOUT_KV.
//   4. In the Worker -> Settings -> Bindings -> add a KV binding: variable name SCOUT_KV -> that namespace.
//   5. Settings -> Triggers -> Cron Triggers -> add "0 * * * *" (top of every hour).
//   6. Deploy. You get a URL like https://scout-sync.<you>.workers.dev
//   7. Send Ryan that URL; next session we point the site at it (it then reads this instead of each person syncing).
//
// Endpoints:
//   GET  /            -> cached league JSON (rosters with names). CORS enabled.
//   GET  /?refresh=1  -> force a fresh sync right now (use once after deploy to warm the cache).
//   cron              -> refreshes the cache automatically every hour.
//
//   THE BOOK (in-house betting) — shared, cheat-resistant because this Worker is
//   the single source of truth for every bet:
//   GET  /book/bets   -> the whole season ledger { bets:[...] }.
//   POST /book/login  -> { code } -> { ok, handle } | { ok:false }. Codes live HERE,
//                        server-side, so they aren't just sitting in the site bundle.
//   POST /book/bets   -> { code, bet } -> re-checks the code AND recomputes the bettor's
//                        weekly spend from ALL stored bets before accepting, so a second
//                        device can't slip a bet past the $150 cap. Returns { ok, bet, ledger }.
//
//   Optional binding: set a Worker secret/var BET_CODES (JSON like {"BUCKLE":"joshleota"})
//   to override the codes without editing this file. Falls back to the map below.

const LG2026 = "1311995695032467456";
const HANDLES = ["witherssssss","joshleota","ImyHunter","JohnnyDuff","JShrimp341","jduddy9","WinzTheBrah","ATorelli4","ShaydenB","jpdonners"];
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", "Cache-Control": "public, max-age=300" };

const j = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + " -> " + r.status); return r.json(); };
const norm = (dn) => { const l = String(dn || "").toLowerCase(); if (l.indexOf("wither") >= 0) return "Ryan"; const h = HANDLES.find(x => x.toLowerCase() === l); return h || dn; };

async function build(env) {
  const users = await j(`https://api.sleeper.app/v1/league/${LG2026}/users`);
  const rosters = await j(`https://api.sleeper.app/v1/league/${LG2026}/rosters`);
  const umap = {}; users.forEach(u => umap[u.user_id] = norm(u.display_name));

  // Player dictionary: cache in KV for 24h so we do not re-pull the big file every run.
  let pmap = null;
  const cached = await env.SCOUT_KV.get("players", { type: "json" });
  if (cached && Date.now() - cached.t < 86400000) pmap = cached.map;
  else {
    const all = await j("https://api.sleeper.app/v1/players/nfl");
    pmap = {};
    for (const id in all) {
      const v = all[id]; if (!v) continue;
      const nm = v.full_name || ((v.first_name || "") + " " + (v.last_name || "")).trim() || v.last_name;
      if (nm) pmap[id] = [nm, v.position || "", v.team || "FA"];
    }
    await env.SCOUT_KV.put("players", JSON.stringify({ t: Date.now(), map: pmap }));
  }

  const byHandle = {};
  rosters.forEach(r => {
    const h = umap[r.owner_id]; if (!h) return;
    const st = new Set(r.starters || []);
    byHandle[h] = {
      count: (r.players || []).length,
      players: (r.players || []).map(id => {
        const e = pmap[id];
        return e ? { n: e[0], p: e[1], t: e[2], s: st.has(id) } : { n: String(id), p: "", t: "", s: st.has(id) };
      })
    };
  });

  const payload = { ts: new Date().toISOString(), rosters: byHandle };
  await env.SCOUT_KV.put("league", JSON.stringify(payload));
  return payload;
}

// ---- THE BOOK ----------------------------------------------------------------
// Bankroll rules — MUST match src/lib/bet.js so client and server agree.
const WEEKLY_SPEND_CAP = 150, MULTI_CAP = 20, MULTIS_PER_WEEK = 1;
// Fallback code map (overridable via env.BET_CODES). Mirror of MANAGER_CODES.
const DEFAULT_CODES = {
  RYAN0: "Ryan", BUCKLE: "joshleota", JET2: "WinzTheBrah", SHOUGH: "JohnnyDuff",
  RICE9: "jduddy9", LAMAR: "jpdonners", GRID4: "ATorelli4", SHAKIR: "JShrimp341",
  BOURNE: "ShaydenB", EGG10: "ImyHunter",
};
function codes(env) {
  if (env && env.BET_CODES) { try { return JSON.parse(env.BET_CODES); } catch { /* bad JSON */ } }
  return DEFAULT_CODES;
}
const resolveCode = (env, code) => codes(env)[String(code || "").trim().toUpperCase()] || null;

async function getBets(env) {
  const raw = await env.SCOUT_KV.get("bets");
  try { const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
const weekSpent = (all, handle, week) =>
  all.filter(b => b.handle === handle && b.week === week).reduce((s, b) => s + (+b.stake || 0), 0);
const weekMultis = (all, handle, week) =>
  all.filter(b => b.handle === handle && b.week === week && b.kind === "multi").length;

// Server-authoritative validation — the same rules as the client's validateBet.
function checkBet(all, handle, week, bet) {
  if (!bet || !(+bet.stake > 0)) return { ok: false, reason: "stake must be positive" };
  if (+bet.week !== week) return { ok: false, reason: "wrong week" };
  if (weekSpent(all, handle, week) + +bet.stake > WEEKLY_SPEND_CAP + 1e-6)
    return { ok: false, reason: "over the $" + WEEKLY_SPEND_CAP + " weekly cap" };
  if (bet.kind === "multi") {
    if (+bet.stake > MULTI_CAP + 1e-6) return { ok: false, reason: "multi stake over $" + MULTI_CAP };
    if (weekMultis(all, handle, week) >= MULTIS_PER_WEEK) return { ok: false, reason: "multi already used this week" };
    if (!Array.isArray(bet.legs) || bet.legs.length < 2) return { ok: false, reason: "a multi needs 2+ legs" };
  }
  return { ok: true };
}

async function handleBook(req, env, path) {
  if (path === "/book/bets" && req.method === "GET") {
    return new Response(JSON.stringify({ bets: await getBets(env) }), { headers: CORS });
  }
  if (path === "/book/login" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const handle = resolveCode(env, body.code);
    return new Response(JSON.stringify(handle ? { ok: true, handle } : { ok: false }), { headers: CORS });
  }
  if (path === "/book/bets" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const handle = resolveCode(env, body.code);
    if (!handle) return new Response(JSON.stringify({ ok: false, reason: "bad code" }), { headers: CORS });
    const week = +(body.bet && body.bet.week);
    const all = await getBets(env);
    const chk = checkBet(all, handle, week, body.bet);
    if (!chk.ok) return new Response(JSON.stringify({ ok: false, reason: chk.reason, ledger: all }), { headers: CORS });
    // Stamp server-authoritative fields — client can't spoof owner, id or time.
    const b = body.bet;
    const bet = {
      id: `${week}-${handle}-${Date.now()}-${all.length}`, handle, week,
      kind: b.kind === "multi" ? "multi" : "single",
      legs: Array.isArray(b.legs) ? b.legs : [],
      stake: Math.round((+b.stake) * 100) / 100, odds: +b.odds || 1,
      status: "open", placed: Date.now(),
    };
    const ledger = [bet, ...all];
    await env.SCOUT_KV.put("bets", JSON.stringify(ledger));
    return new Response(JSON.stringify({ ok: true, bet, ledger }), { headers: CORS });
  }
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    try {
      if (url.pathname.startsWith("/book/")) {
        const r = await handleBook(req, env, url.pathname);
        if (r) return r;
        return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: CORS });
      }
      if (url.searchParams.get("refresh")) {
        const p = await build(env);
        return new Response(JSON.stringify(p), { headers: CORS });
      }
      const cached = await env.SCOUT_KV.get("league");
      if (cached) return new Response(cached, { headers: CORS });
      const p = await build(env);
      return new Response(JSON.stringify(p), { headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e && e.message || e) }), { status: 500, headers: CORS });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(build(env));
  }
};
