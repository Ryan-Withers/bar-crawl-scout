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
//   GET /            -> cached league JSON (rosters with names). CORS enabled.
//   GET /?refresh=1  -> force a fresh sync right now (use once after deploy to warm the cache).
//   cron             -> refreshes the cache automatically every hour.

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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
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
