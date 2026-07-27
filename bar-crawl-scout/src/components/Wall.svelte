<script>
  import { onMount } from 'svelte';
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMSHORT, RYAN } from '../lib/data.js';
  import { foundingQuery } from '../api/queries';
  import { assembleWall } from '../api/wall.ts';
  import Skeleton from './Skeleton.svelte';

  const founding = createQuery(foundingQuery());
  $: est = $founding.data;

  let banners = [];
  let loading = true;
  onMount(async () => {
    try { banners = await assembleWall(); } catch { banners = []; } finally { loading = false; }
  });

  const name = (h) => (h ? TEAMSHORT[h] || h : null);
</script>

<section class="wall">
  <p class="blurb">Every season on record{#if est}, back to {est}{/if}. Open a bracket to replay how the title was won.</p>

  {#if banners.length}
    <div class="banners">
      {#each banners as b (b.season)}
        <div class="banner" class:live={b.current}>
          <div class="yr">{b.season}{#if b.current}<span class="tag">IN PROGRESS</span>{/if}</div>
          <div class="body">
            {#if b.champion}
              <div class="champ"><span class="crown">🏆</span>
                <a href={'/managers/' + b.champion} use:link>{name(b.champion)}</a>
                {#if b.champion === RYAN}🔒{/if}
                {#if b.runnerUp}<span class="over">def. {name(b.runnerUp)}</span>{/if}
              </div>
            {:else if b.current}
              <div class="champ pending"><span class="crown">⏳</span> title still up for grabs — <a href="/standings" use:link>see The Table</a></div>
            {:else}
              <div class="champ pending"><span class="crown">—</span> no bracket on file for this season</div>
            {/if}
            <div class="sub">
              {#if b.pointsLeader}<span class="stat">👑 Points king: <b>{name(b.pointsLeader.handle)}</b> ({b.pointsLeader.pf})</span>{/if}
              {#if b.bestRecord}<span class="stat">📋 Best record: <b>{name(b.bestRecord.handle)}</b> ({b.bestRecord.wins}-{b.bestRecord.losses})</span>{/if}
            </div>

            {#if b.bracket}
              <details class="bracket">
                <summary>🏟️ The bracket</summary>
                <div class="rounds">
                  {#each b.bracket as rd (rd.round)}
                    <div class="round">
                      <div class="rlabel">{rd.label}</div>
                      {#each rd.matches as mt (mt.m)}
                        <div class="match" class:title={mt.place === 'Final'}>
                          {#if mt.place === 'Third'}<span class="badge">3rd</span>{/if}
                          <span class="team" class:win={mt.winner && mt.winner === mt.a}>{name(mt.a) || 'TBD'}</span>
                          <span class="v">v</span>
                          <span class="team" class:win={mt.winner && mt.winner === mt.b}>{name(mt.b) || 'TBD'}</span>
                          {#if mt.place === 'Final' && mt.winner}<span class="mini">🏆</span>{/if}
                        </div>
                      {/each}
                    </div>
                  {/each}
                </div>
              </details>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if loading}
    <Skeleton rows={4} height={78} gap={12} />
  {:else}
    <div class="empty">No seasons on file yet — history loads from Sleeper in your browser. Open the site in a real tab; the in-app preview blocks the network.</div>
  {/if}
</section>

<style>
  .wall { padding-top: 2px; }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 14px; line-height: 1.6; max-width: 76ch; }
  /* One banner per row on a phone, several across on a wide wall. */
  .banners { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 12px; align-items: start; }
  .banner { display: grid; grid-template-columns: 84px 1fr; gap: 14px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
  .banner.live { border-color: rgba(130,201,252,.4); }
  .yr { font-family: 'Archivo Black', sans-serif; font-size: 26px; color: var(--neon); line-height: 1; display: flex; flex-direction: column; gap: 6px; }
  .yr .tag { font-family: 'IBM Plex Mono', monospace; font-size: 8px; font-weight: 400; letter-spacing: .08em; color: var(--brass); }
  .champ { font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: var(--chalk); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .champ a { color: var(--neon-hot); text-decoration: none; font-weight: 700; }
  .champ a:hover { text-decoration: underline; }
  .champ.pending { color: var(--muted); font-size: 12.5px; }
  .champ.pending a { color: var(--neon); }
  .crown { font-size: 16px; }
  .over { color: var(--muted); font-size: 11px; }
  .sub { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); }
  .sub b { color: var(--chalk); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); line-height: 1.7; max-width: 60ch; }

  /* The bracket: an expandable per-season playoff tree, dark Book palette. */
  .bracket { margin-top: 10px; border-top: 1px dashed var(--line); padding-top: 8px; }
  .bracket summary { display: flex; align-items: center; min-height: 44px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--neon); cursor: pointer; list-style: none; user-select: none; }
  .bracket summary::-webkit-details-marker { display: none; }
  .bracket summary::before { content: '▸ '; color: var(--muted); }
  .bracket[open] summary::before { content: '▾ '; }
  .rounds { display: flex; gap: 12px; margin-top: 10px; align-items: flex-start; }
  .round { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .rlabel { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .match { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; background: rgba(130,201,252,.06); border: 1px solid var(--line); border-radius: 7px; padding: 6px 9px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); }
  .match.title { border-color: rgba(130,201,252,.4); }
  .match .team { color: var(--chalk); min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .match .team.win { color: var(--neon-hot); font-weight: 700; }
  .match .v { color: var(--muted); font-size: 9px; }
  .match .badge { font-size: 8px; letter-spacing: .06em; color: var(--brass); border: 1px solid var(--line); border-radius: 3px; padding: 1px 4px; }
  .match .mini { margin-left: auto; }
  @media (max-width: 520px) {
    .banner { grid-template-columns: 1fr; gap: 8px; } .yr { flex-direction: row; align-items: baseline; gap: 10px; }
    .rounds { flex-direction: column; gap: 12px; }
  }
</style>
