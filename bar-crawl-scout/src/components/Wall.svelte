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
  <div class="eyebrow">File 09 / The Wall</div>
  <p class="blurb">Every season on record{#if est}, back to {est}{/if}. Champions, points kings, and the best regular-season line.</p>

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
  .wall { max-width: 780px; padding-top: 6px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 8px 0 16px; line-height: 1.6; }
  .banners { display: flex; flex-direction: column; gap: 12px; }
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
  @media (max-width: 520px) { .banner { grid-template-columns: 1fr; gap: 8px; } .yr { flex-direction: row; align-items: baseline; gap: 10px; } }
</style>
