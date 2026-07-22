<script>
  import { derived, writable } from 'svelte/store';
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { RYAN, TEAMS, TEAMSHORT } from '../lib/data.js';
  import { keepers, mode, rosters } from '../lib/store.js';
  import { rosterFor } from '../lib/roster.js';
  import { rosterShape } from '../lib/engine/league-config.ts';
  import { optimalLineup } from '../lib/engine/lineup.ts';
  import { pairMatchups } from '../lib/engine/gameday.ts';
  import { winProbability, matchupGrade } from '../lib/engine/matchup.ts';
  import { positionalEdges, edgeHighlights } from '../lib/engine/edges.ts';
  import { projMapFromBlob } from '../api/projections.ts';
  import { userHandleMap } from '../api/league';
  import { stateQuery, usersQuery, rostersQuery, leagueQuery, matchupsQuery, playersQuery, weekProjectionsQuery } from '../api/queries';
  import PlayerChip from './PlayerChip.svelte';

  const stateQ = createQuery(stateQuery());
  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const leagueQ = createQuery(leagueQuery());
  const playersQ = createQuery(playersQuery());

  $: ks = $keepers;
  $: md = $mode;
  $: week = $stateQ.data?.week ?? $stateQ.data?.display_week ?? 0;
  $: season = $stateQ.data?.season || $leagueQ.data?.season || '';
  $: scoring = $leagueQ.data?.scoring_settings || {};
  $: slots = ($leagueQ.data && $leagueQ.data.roster_positions)
    ? rosterShape($leagueQ.data.roster_positions).starters.flatMap((s) => Array(s.n).fill(s.pos))
    : ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];

  // roster_id -> handle, from live rosters + users.
  $: rosterHandle = (Array.isArray($rostersQ.data) && Array.isArray($usersQ.data))
    ? Object.fromEntries($rostersQ.data.map((r) => [r.roster_id, userHandleMap($usersQ.data)[r.owner_id]]).filter(([, h]) => h))
    : {};

  const weekStore = writable(0);
  $: weekStore.set(week);
  const matchupsQ = createQuery(derived(weekStore, ($w) => ({ ...matchupsQuery($w), enabled: $w > 0 })));

  // Live weekly projections, reactive on the NFL week.
  const projKey = writable({ s: '', w: 0 });
  $: projKey.set({ s: season, w: week });
  const projQ = createQuery(derived(projKey, ($k) => ({ ...weekProjectionsQuery($k.s, $k.w), enabled: !!$k.s && $k.w > 0 })));
  $: projByName = ($projQ.data && $playersQ.data && Object.keys(scoring).length)
    ? projMapFromBlob($projQ.data, $playersQ.data, scoring) : null;
  $: liveProj = !!projByName && Object.keys(projByName).length > 0;

  // Who do I play this week?
  $: games = ($matchupsQ.data && Object.keys(rosterHandle).length) ? pairMatchups($matchupsQ.data, rosterHandle, TEAMSHORT) : [];
  $: myGame = games.find((g) => g.a.handle === RYAN || (g.b && g.b.handle === RYAN));
  $: oppHandle = myGame ? (myGame.a.handle === RYAN ? (myGame.b && myGame.b.handle) : myGame.a.handle) : null;

  const teamOf = (h) => (TEAMS.find((t) => t[0] === h) || [h, h])[1].replace(' (YOU)', '');
  // Pass every reactive dep in as an arg so Svelte tracks the dependency and
  // never runs this before md/ks/slots are assigned.
  function projTotal(rd, handle, ks, md, slots, projByName) {
    const r = rosterFor(rd, handle, ks, md, projByName);
    if (!r) return null;
    const { seats } = optimalLineup(r, slots);
    const total = seats.reduce((s, x) => s + (x.player ? x.player.proj : 0), 0);
    return { total: Math.round(total * 10) / 10, seats: seats.filter((x) => x.player) };
  }
  $: me = projTotal($rosters, RYAN, ks, md, slots, projByName);
  $: opp = oppHandle ? projTotal($rosters, oppHandle, ks, md, slots, projByName) : null;
  $: winPct = me && opp ? winProbability(me.total, opp.total) : null;
  $: grade = winPct != null ? matchupGrade(winPct) : null;
  const top = (side) => (side ? side.seats.slice().sort((a, b) => b.player.proj - a.player.proj).slice(0, 3) : []);

  // Where the game is won: projected points by slot, you vs them.
  $: edges = (me && opp) ? positionalEdges(me.seats, opp.seats) : [];
  $: swing = edgeHighlights(edges);
  // Bar scale: widest single-side position total, so bars are comparable.
  $: edgeMax = edges.reduce((m, e) => Math.max(m, e.mine, e.theirs), 1);
</script>

<section class="matchup">
  <div class="eyebrow">My Team · This Week</div>
  <h1>The Matchup{#if week} · Week {week}{/if}</h1>
  <p class="blurb">Your projected total (optimal lineup) vs your opponent's. Win% from the projected margin.
    {#if liveProj}<span class="live">● live Week {week} projections (Sleeper)</span>{:else}board-value proxy — real weekly projections load in-season{/if}
  </p>

  {#if !me}
    <div class="empty">No roster loaded yet — it auto-pulls on open, or tap <a href="/sync" use:link>Sync</a> in a real browser.</div>
  {:else}
    <div class="scoreboard">
      <div class="side me">
        <div class="tm">{teamOf(RYAN)}</div>
        <div class="score">{me.total}</div>
        <div class="lbl">projected</div>
      </div>
      <div class="mid">
        {#if winPct != null}
          <div class="win {grade.tone}">{winPct}%</div>
          <div class="grade {grade.tone}">{grade.label}</div>
        {:else}
          <div class="vs">VS</div>
          <div class="pending">opponent loads live</div>
        {/if}
      </div>
      <div class="side opp">
        {#if opp && oppHandle}
          <div class="tm"><a href={'/managers/' + oppHandle} use:link>{teamOf(oppHandle)}</a></div>
          <div class="score">{opp.total}</div>
          <div class="lbl">projected</div>
        {:else}
          <div class="tm muted">This week's opponent</div>
          <div class="score muted">—</div>
          <div class="lbl">from Sleeper in your browser</div>
        {/if}
      </div>
    </div>

    <div class="keys">
      <div class="kcol">
        <div class="khd">Your guns</div>
        {#each top(me) as s}<div class="kp"><span class="pos">{s.slot}</span><PlayerChip name={s.player.name} /><span class="pv">{s.player.proj}</span></div>{/each}
      </div>
      {#if opp}
        <div class="kcol">
          <div class="khd">Theirs to fear</div>
          {#each top(opp) as s}<div class="kp"><span class="pos">{s.slot}</span><PlayerChip name={s.player.name} /><span class="pv">{s.player.proj}</span></div>{/each}
        </div>
      {/if}
    </div>

    {#if edges.length}
      <div class="edges">
        <div class="ehd">Where it's won
          {#if swing.best && swing.best.edge > 0}<span class="etag good">{swing.best.pos} +{swing.best.edge}</span>{/if}
          {#if swing.worst && swing.worst.edge < 0}<span class="etag bad">{swing.worst.pos} {swing.worst.edge}</span>{/if}
        </div>
        {#each edges as e}
          <div class="erow">
            <span class="epos">{e.pos}</span>
            <div class="ebar">
              <div class="half l"><i style="width:{(e.theirs / edgeMax) * 100}%"></i><b>{e.theirs}</b></div>
              <div class="half r"><i style="width:{(e.mine / edgeMax) * 100}%"></i><b>{e.mine}</b></div>
            </div>
            <span class="edelta" class:good={e.edge > 0} class:bad={e.edge < 0}>{e.edge > 0 ? '+' : ''}{e.edge}</span>
          </div>
        {/each}
        <div class="efoot"><span>◀ {opp ? teamOf(oppHandle) : 'them'}</span><span>{teamOf(RYAN)} ▶</span></div>
      </div>
    {/if}
  {/if}
</section>

<style>
  .matchup { max-width: 820px; padding-top: 6px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  h1 { font-family: 'Archivo Black', sans-serif; font-size: clamp(24px, 4vw, 38px); text-transform: uppercase; margin: 6px 0 4px; color: var(--chalk); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 18px; line-height: 1.6; max-width: 72ch; }
  .blurb .live { color: #7fcfa6; }
  .empty a { color: var(--neon); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--muted); padding: 20px 0; }
  .scoreboard { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 22px 18px; }
  .side { text-align: center; }
  .side .tm { font-family: 'Archivo Black', sans-serif; font-size: 15px; text-transform: uppercase; color: var(--chalk); line-height: 1.05; }
  .side .tm a { color: var(--chalk); text-decoration: none; }
  .side .tm a:hover { color: var(--neon-hot); }
  .side .tm.muted, .score.muted { color: var(--muted); }
  .side .score { font-family: 'Archivo Black', sans-serif; font-size: 44px; color: var(--neon); line-height: 1; margin: 6px 0 2px; }
  .side.opp .score { color: var(--brass); }
  .side .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .mid { text-align: center; min-width: 100px; }
  .win { font-family: 'Archivo Black', sans-serif; font-size: 30px; line-height: 1; }
  .win.good { color: var(--neon); } .win.even { color: var(--brass); } .win.bad { color: var(--stamp-red); }
  .grade { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: .1em; margin-top: 4px; color: var(--muted); }
  .grade.good { color: var(--neon); } .grade.bad { color: var(--stamp-red); }
  .vs { font-family: 'Archivo Black', sans-serif; font-size: 22px; color: var(--muted); }
  .pending { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; color: var(--muted); margin-top: 4px; }
  .keys { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  .kcol { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .khd { font-family: 'Archivo Black', sans-serif; font-size: 11px; text-transform: uppercase; color: var(--chalk); margin-bottom: 8px; }
  .kp { display: flex; align-items: center; gap: 9px; padding: 5px 0; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .kp .pos { min-width: 34px; color: var(--muted); font-weight: 700; font-size: 9.5px; }
  .kp .pv { margin-left: auto; font-weight: 700; color: var(--chalk); }
  /* Where it's won — a per-slot diverging bar, theirs left, yours right. */
  .edges { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-top: 16px; }
  .ehd { font-family: 'Archivo Black', sans-serif; font-size: 11px; text-transform: uppercase; color: var(--chalk); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .etag { font-family: 'IBM Plex Mono', monospace; font-size: 9px; border-radius: 3px; padding: 1px 6px; }
  .etag.good { color: var(--neon); border: 1px solid rgba(47,127,184,.35); } .etag.bad { color: var(--stamp-red); border: 1px solid rgba(214,69,60,.3); }
  .erow { display: grid; grid-template-columns: 44px 1fr 46px; align-items: center; gap: 8px; padding: 4px 0; }
  .epos { font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 700; color: var(--muted); }
  .ebar { display: flex; align-items: center; gap: 3px; }
  .half { flex: 1; display: flex; align-items: center; gap: 5px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); }
  .half.l { flex-direction: row-reverse; }
  .half i { display: block; height: 9px; border-radius: 3px; }
  .half.l i { background: var(--brass); } .half.r i { background: var(--neon); }
  .edelta { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; text-align: right; color: var(--muted); }
  .edelta.good { color: var(--neon); } .edelta.bad { color: var(--stamp-red); }
  .efoot { display: flex; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--line); }
  @media (max-width: 560px) { .keys { grid-template-columns: 1fr; } .side .score { font-size: 34px; } }
</style>
