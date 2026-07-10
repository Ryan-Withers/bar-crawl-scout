<script>
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { derived, writable } from 'svelte/store';
  import { RYAN, TEAMS } from '../lib/data.js';
  import { keepers, mode, rosters } from '../lib/store.js';
  import { refreshRosters } from '../lib/sync.js';
  import { myRoster } from '../lib/roster.js';
  import { rosterShape } from '../lib/engine/league-config.ts';
  import { optimalLineup, byeHoles } from '../lib/engine/lineup.ts';
  import { projMapFromBlob } from '../api/projections.ts';
  import { leagueQuery, stateQuery, playersQuery, weekProjectionsQuery } from '../api/queries';
  import PlayerChip from './PlayerChip.svelte';

  const leagueQ = createQuery(leagueQuery());
  const stateQ = createQuery(stateQuery());
  const playersQ = createQuery(playersQuery());
  $: week = $stateQ.data?.week ?? $stateQ.data?.display_week ?? 0;
  $: season = $stateQ.data?.season || $leagueQ.data?.season || '';
  $: scoring = $leagueQ.data?.scoring_settings || {};

  $: ks = $keepers;
  $: md = $mode;

  // The league's real starting slots, else a sensible default.
  $: slots = ($leagueQ.data && $leagueQ.data.roster_positions)
    ? rosterShape($leagueQ.data.roster_positions).starters.flatMap((s) => Array(s.n).fill(s.pos))
    : ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];

  // Live weekly projections (real per-week points), reactive on the NFL week.
  const projKey = writable({ s: '', w: 0 });
  $: projKey.set({ s: season, w: week });
  const projQ = createQuery(derived(projKey, ($k) => ({ ...weekProjectionsQuery($k.s, $k.w), enabled: !!$k.s && $k.w > 0 })));
  $: projByName = ($projQ.data && $playersQ.data && Object.keys(scoring).length)
    ? projMapFromBlob($projQ.data, $playersQ.data, scoring) : null;
  $: liveProj = !!projByName && Object.keys(projByName).length > 0;

  // Your live roster from Sleeper (auto-loaded / synced). Ryan = you.
  $: roster = myRoster($rosters, ks, md, projByName);
  $: mine = roster;
  $: result = roster && roster.length ? optimalLineup(roster, slots) : null;
  $: holes = result ? byeHoles(result.seats, week) : [];
  $: teamName = (TEAMS.find((t) => t[0] === RYAN) || [RYAN, RYAN])[1].replace(' (YOU)', '');

  // ---- current vs optimal ----
  // Left card = your lineup AS SET ON SLEEPER (starter flags), arranged into the
  // league's slots for display. Right card = what the optimizer would set.
  $: curStarters = roster ? roster.filter((p) => p.starter) : [];
  $: hasFlags = curStarters.length > 0;
  $: curSeats = hasFlags ? optimalLineup(curStarters, slots).seats : [];
  $: curBench = roster ? roster.filter((p) => !p.starter) : [];
  $: optNames = result ? new Set(result.seats.map((s) => s.player && s.player.name).filter(Boolean)) : new Set();
  $: curNames = new Set(curStarters.map((p) => p.name));
  const r1 = (n) => Math.round(n * 10) / 10;
  $: curTotal = r1(curStarters.reduce((s, p) => s + (p.proj || 0), 0));
  $: optTotal = result ? r1(result.seats.reduce((s, x) => s + (x.player ? x.player.proj || 0 : 0), 0)) : 0;
  $: gain = r1(optTotal - curTotal);
  $: isOptimal = result ? result.moves.length === 0 : true;

  // "Already did it" escape hatch: the Worker snapshot refreshes hourly, so a
  // move you just made on Sleeper can linger as a suggestion. This forces the
  // Worker to rebuild from Sleeper right now and re-pulls your lineup.
  let refreshing = false;
  async function doRefresh() {
    refreshing = true;
    try { await refreshRosters(); } finally { refreshing = false; }
  }
</script>

<section class="myteam">
  <div class="eyebrow">File 01 / Your Bench</div>
  <h1>{teamName}</h1>
  <p class="blurb">Your live roster from Sleeper — auto-synced when you open the app. Change your team on Sleeper and it updates here.
    {#if liveProj}<span class="projsrc live">● Projections: live Week {week} (Sleeper)</span>{:else}<span class="projsrc">Projections: board value (offseason proxy — real weekly numbers load in-season)</span>{/if}
  </p>

  {#if !mine}
    <div class="empty">No roster loaded yet. It auto-pulls from the sync Worker on open — if it's empty, tap <a href="/sync" use:link>Sync</a> in a real browser (the in-app preview blocks the network).</div>
  {:else}
    {#if holes.length}
      <div class="alert">⚠ <b>Bye-week hole{holes.length > 1 ? 's' : ''} in Week {week}:</b> {holes.map((h) => h.name).join(', ')} {holes.length > 1 ? 'are' : 'is'} on bye — find replacements on <a href="/waivers" use:link>the wire</a>.</div>
    {/if}

    {#if result.moves.length}
      <div class="advice">
        <div class="ahd">📋 Lineup calls
          <button class="refreshbtn" on:click={doRefresh} disabled={refreshing} title="Already made these moves on Sleeper? Pull your lineup fresh — the auto-sync is hourly.">{refreshing ? 'checking Sleeper…' : '↻ already did it?'}</button>
        </div>
        {#each result.moves.slice(0, 4) as m}
          <div class="move"><b class="start">START</b> {m.in} <span class="over">over</span> {m.out} <span class="slot">@ {m.slot}</span> <span class="gain">+{m.gain}</span></div>
        {/each}
      </div>
    {:else}
      <div class="advice ok">✓ Your optimal lineup is set — no start/sit upgrades on the bench.</div>
    {/if}

    {#if hasFlags && !isOptimal}
      <!-- The comparison: what you HAVE vs what the maths would set. -->
      <div class="cols">
        <div class="lineupcard now">
          <div class="lhd"><span class="step">NOW</span> Your lineup on Sleeper
            <span class="total">{curTotal} <small>proj pts</small></span>
          </div>
          {#each curSeats as s}
            <div class="prow" class:sitrow={s.player && !optNames.has(s.player.name)} class:bye={s.player && s.player.bye === week && week > 0}>
              <span class="slot">{s.slot}</span>
              {#if s.player}
                <span class="pn"><PlayerChip name={s.player.name} /></span>
                {#if !optNames.has(s.player.name)}<span class="tag sit">SIT</span>{/if}
                <span class="val">{s.player.proj}</span>
              {:else}<span class="pn empty">— empty —</span><span class="val"></span>{/if}
            </div>
          {/each}
        </div>

        <div class="lineupcard best">
          <div class="lhd"><span class="step blue">OPTIMAL</span> What the maths would set
            <span class="total">{optTotal} <small>proj pts</small>{#if gain > 0}<b class="gainchip">+{gain}</b>{/if}</span>
          </div>
          {#each result.seats as s}
            <div class="prow" class:inrow={s.player && !curNames.has(s.player.name)} class:bye={s.player && s.player.bye === week && week > 0}>
              <span class="slot">{s.slot}</span>
              {#if s.player}
                <span class="pn"><PlayerChip name={s.player.name} /></span>
                {#if !curNames.has(s.player.name)}<span class="tag in">IN</span>{/if}
                <span class="val">{s.player.proj}</span>
              {:else}<span class="pn empty">— empty —</span><span class="val"></span>{/if}
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Already optimal (or no starter data): one clear lineup, no confusion. -->
      <div class="cols">
        <div class="lineupcard now solo">
          <div class="lhd"><span class="step">{hasFlags ? 'NOW' : 'BEST'}</span> {hasFlags ? 'Your lineup on Sleeper — already optimal ✓' : 'The optimal lineup from your roster'}
            <span class="total">{hasFlags ? curTotal : optTotal} <small>proj pts</small></span>
          </div>
          {#each (hasFlags ? curSeats : result.seats) as s}
            <div class="prow" class:bye={s.player && s.player.bye === week && week > 0}>
              <span class="slot">{s.slot}</span>
              {#if s.player}
                <span class="pn"><PlayerChip name={s.player.name} /></span>
                <span class="meta">{s.player.pos} · {s.player.team}{s.player.bye ? ' · bye ' + s.player.bye : ''}</span>
                <span class="val">{s.player.proj}</span>
              {:else}<span class="pn empty">— empty —</span><span class="meta"></span><span class="val"></span>{/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="benchcard">
      <div class="chd">Your bench <span class="cnt">{(hasFlags ? curBench : result.bench).length}</span></div>
      {#each (hasFlags ? curBench : result.bench) as p}
        <div class="prow bench" class:inrow={hasFlags && optNames.has(p.name)} class:bye={p.bye === week && week > 0}>
          <span class="slot">{p.pos}</span>
          <span class="pn"><PlayerChip name={p.name} /></span>
          {#if hasFlags && optNames.has(p.name)}<span class="tag in">START HIM</span>{/if}
          <span class="meta">{p.team}{p.bye ? ' · bye ' + p.bye : ''}</span>
          <span class="val">{p.proj}</span>
        </div>
      {:else}<div class="prow"><span class="pn empty">Deep bench empty</span></div>{/each}
    </div>
  {/if}
</section>

<style>
  .myteam { max-width: 900px; padding-top: 6px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  h1 { font-family: 'Archivo Black', sans-serif; font-size: clamp(26px, 4vw, 40px); text-transform: uppercase; margin: 6px 0 4px; color: var(--chalk); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 16px; line-height: 1.6; max-width: 72ch; }
  .projsrc { color: var(--muted); }
  .projsrc.live { color: #7fcfa6; }
  .empty a, .alert a { color: var(--neon); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--muted); line-height: 1.7; padding: 20px 0; }
  .alert { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: #f0c98a; background: rgba(214,69,60,.1); border: 1px solid rgba(214,69,60,.35); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; line-height: 1.6; }
  .alert b { color: var(--stamp-red); }
  .advice { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
  .advice.ok { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: #7fcfa6; }
  .ahd { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-family: 'Archivo Black', sans-serif; font-size: 12px; text-transform: uppercase; color: var(--chalk); margin-bottom: 8px; }
  .refreshbtn { margin-left: auto; font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: none; background: var(--field-3); color: var(--accent); border: 1px solid var(--line); border-radius: 6px; padding: 4px 9px; cursor: pointer; min-height: 28px; }
  .refreshbtn:hover { border-color: var(--accent); }
  .refreshbtn:disabled { opacity: .6; cursor: wait; }
  .move { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--chalk); padding: 4px 0; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .move .start { color: var(--neon); font-size: 9px; letter-spacing: .1em; border: 1px solid rgba(130,201,252,.4); border-radius: 3px; padding: 1px 5px; }
  .move .over { color: var(--muted); }
  .move .slot { color: var(--muted); font-size: 10px; }
  .move .gain { margin-left: auto; color: #7fcfa6; font-weight: 700; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .lineupcard { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px 12px; }
  .lineupcard.best { border-color: rgba(47,127,184,.45); box-shadow: 0 4px 16px -8px rgba(47,127,184,.35); }
  .lineupcard.solo { grid-column: 1 / -1; max-width: 560px; }
  .lhd { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-family: 'Archivo Black', sans-serif; font-size: 12px; text-transform: uppercase; color: var(--chalk); padding: 4px 0 8px; border-bottom: 1.5px solid var(--line); margin-bottom: 4px; }
  .step { font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .1em; color: var(--muted); border: 1.5px solid var(--line); border-radius: 4px; padding: 2px 7px; }
  .step.blue { color: #FFFFFF; background: var(--blue); border-color: var(--blue); }
  .total { margin-left: auto; font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-weight: 700; color: var(--chalk); display: flex; align-items: baseline; gap: 5px; }
  .total small { font-size: 9px; font-weight: 400; color: var(--muted); text-transform: none; letter-spacing: 0; }
  .gainchip { font-size: 11px; color: #FFFFFF; background: var(--good); border-radius: 4px; padding: 1px 6px; }
  .benchcard { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px 12px; }
  .chd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 8px; display: flex; align-items: baseline; gap: 8px; }
  .cnt { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); }
  .prow { display: grid; grid-template-columns: 46px 1fr auto auto; align-items: center; gap: 10px; padding: 8px 6px; border-bottom: 1px dashed var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .prow:last-child { border-bottom: none; }
  .benchcard .prow { grid-template-columns: 46px 1fr auto auto auto; }
  .prow.bye { background: rgba(214,69,60,.08); border-radius: 5px; }
  .prow.sitrow { background: rgba(214,69,60,.07); border-radius: 5px; }
  .prow.inrow { background: var(--blue-wash); border-radius: 5px; }
  .slot { font-weight: 700; color: var(--neon); font-size: 10px; letter-spacing: .04em; }
  .prow.bench .slot { color: var(--muted); }
  .pn { color: var(--chalk); min-width: 0; }
  .pn.empty { color: var(--muted); font-style: italic; }
  .tag { font-size: 8.5px; font-weight: 700; letter-spacing: .08em; border-radius: 3px; padding: 2px 6px; white-space: nowrap; }
  .tag.sit { color: #FFFFFF; background: var(--stamp-red); }
  .tag.in { color: #FFFFFF; background: var(--blue); }
  .meta { color: var(--muted); font-size: 10.5px; text-align: right; white-space: nowrap; }
  .val { font-weight: 700; color: var(--chalk); min-width: 34px; text-align: right; }
  @media (max-width: 640px) { .cols { grid-template-columns: 1fr; } .meta { display: none; } }
</style>
