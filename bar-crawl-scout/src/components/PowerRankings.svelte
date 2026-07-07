<script>
  import { link } from 'svelte-spa-router';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMS, TEAMSHORT, MGRS, RYAN } from '../lib/data.js';
  import { keepers, mode, rosters } from '../lib/store.js';
  import { rosterFor } from '../lib/roster.js';
  import { powerRankings } from '../lib/engine/power.ts';
  import { usersQuery, rostersQuery } from '../api/queries';
  import { userHandleMap, recordsFromRosters } from '../api/league';

  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());

  $: ks = $keepers;
  $: md = $mode;

  const mgrByHandle = Object.fromEntries(MGRS.map((m) => [m.h, m]));
  const parseRec = (s) => { const [w, l, t] = String(s || '0-0-0').split('-').map((n) => +n || 0); return { w, l, t: t || 0 }; };
  const parsePF = (s) => +String(s || '0').replace(/[^0-9.]/g, '') || 0;

  $: liveRecords = ($rostersQ.data && $usersQ.data) ? recordsFromRosters($rostersQ.data, userHandleMap($usersQ.data)) : {};
  $: live = Object.keys(liveRecords).length > 0;

  // Sum of board values on a roster (0 if not synced). Deps passed in so Svelte
  // tracks them and never runs this before ks/md are set.
  function rosterValue(rd, handle, ks, md) {
    const r = rosterFor(rd, handle, ks, md);
    return r ? r.reduce((s, p) => s + (p.proj || 0), 0) : 0;
  }

  $: inputs = buildInputs($rosters, liveRecords, ks, md);
  function buildInputs(rd, records, ks, md) {
    return TEAMS.map(([h, team]) => {
      const rec = records[h];
      const wl = rec ? { w: rec.wins, l: rec.losses, t: rec.ties } : parseRec(mgrByHandle[h] && mgrByHandle[h].rec);
      const games = wl.w + wl.l + wl.t;
      return {
        handle: h, team,
        winPct: games ? (wl.w + wl.t / 2) / games : 0,
        pf: rec ? rec.pf : parsePF(mgrByHandle[h] && mgrByHandle[h].pf),
        rosterVal: rosterValue(rd, h, ks, md),
      };
    });
  }
  $: ranked = powerRankings(inputs);
  $: anyRoster = $rosters && $rosters.byHandle && Object.keys($rosters.byHandle).length > 0;
</script>

<section class="power">
  <div class="eyebrow">The League · Power Rankings</div>
  <h1>Power Rankings</h1>
  <p class="blurb">Not just the standings — a blend of <b>record</b> (45%), <b>points-for</b> (30%) and <b>roster value</b> (25%, your board), each scaled across the league.
    {#if !anyRoster}<br><span class="fine">Roster value needs a sync — tap <a href="/sync" use:link>Sync</a> so the build strength counts.</span>{/if}
  </p>

  <div class="list">
    {#each ranked as t}
      <div class="prow" class:you={t.handle === RYAN}>
        <span class="rk">{t.rank}</span>
        <div class="main">
          <a class="tm" href={'/managers/' + t.handle} use:link>{TEAMSHORT[t.handle] || t.team}</a>
          <div class="bars">
            <span class="bar rec" title="Record {t.parts.record}"><i style="width:{t.parts.record}%"></i></span>
            <span class="bar sco" title="Scoring {t.parts.scoring}"><i style="width:{t.parts.scoring}%"></i></span>
            <span class="bar ros" title="Roster {t.parts.roster}"><i style="width:{t.parts.roster}%"></i></span>
          </div>
        </div>
        <span class="score">{t.score}</span>
      </div>
    {/each}
  </div>
  <div class="legend"><span class="k rec">■ record</span> <span class="k sco">■ scoring</span> <span class="k ros">■ roster</span> · bar length = that team's share vs the league</div>
</section>

<style>
  .power { max-width: 820px; padding-top: 6px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  h1 { font-family: 'Archivo Black', sans-serif; font-size: clamp(26px, 4vw, 40px); text-transform: uppercase; margin: 6px 0 4px; color: var(--chalk); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 16px; line-height: 1.6; max-width: 76ch; }
  .blurb b { color: var(--chalk); } .blurb a { color: var(--neon); } .fine { font-size: 10.5px; color: var(--ink-soft); }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .prow { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 12px; padding: 10px 10px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; }
  .prow.you { border-color: rgba(130,201,252,.4); }
  .rk { font-family: 'Archivo Black', sans-serif; font-size: 20px; color: var(--muted); text-align: center; }
  .prow.you .rk { color: var(--neon); }
  .main { min-width: 0; }
  .tm { font-family: 'Archivo Black', sans-serif; font-size: 15px; text-transform: uppercase; color: var(--chalk); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .tm:hover { color: var(--neon-hot); }
  .bars { display: flex; flex-direction: column; gap: 3px; margin-top: 6px; }
  .bar { height: 5px; background: rgba(255,255,255,.05); border-radius: 3px; overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 3px; }
  .bar.rec i { background: var(--neon); } .bar.sco i { background: var(--brass); } .bar.ros i { background: #a9b6d6; }
  .score { font-family: 'Archivo Black', sans-serif; font-size: 22px; color: var(--neon-hot); }
  .legend { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); margin-top: 12px; }
  .legend .rec { color: var(--neon); } .legend .sco { color: var(--brass); } .legend .ros { color: #a9b6d6; }
</style>
