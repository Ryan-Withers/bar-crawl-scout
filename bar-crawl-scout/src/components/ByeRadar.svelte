<script>
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { keepers, mode, rosters } from '../lib/store.js';
  import { myRoster } from '../lib/roster.js';
  import { byeOutlook } from '../lib/engine/byeradar.ts';
  import { stateQuery } from '../api/queries';
  import PlayerChip from './PlayerChip.svelte';

  const stateQ = createQuery(stateQuery());
  $: week = $stateQ.data?.week ?? $stateQ.data?.display_week ?? 0;

  $: roster = myRoster($rosters, $keepers, $mode);
  $: starters = roster ? roster.filter((p) => p.starter) : [];
  // Radar over the whole season; highlight weeks still ahead of us.
  $: outlook = roster ? byeOutlook(roster, 1, 18) : [];
  $: worst = outlook.reduce((m, w) => Math.max(m, w.players.length), 0);
</script>

<section class="radar">
  <p class="legend"><b class="thintag">THIN</b> means two or more of your players are out at the same position that week — plan a stream or a trade before it hits. Starters are flagged.</p>

  {#if !roster}
    <div class="empty">No roster loaded yet — it auto-pulls on open, or tap <a href="/sync" use:link>Sync</a> in a real browser.</div>
  {:else if !outlook.length}
    <div class="empty">No byes on your roster fall inside the season window. You're clear.</div>
  {:else}
    <div class="grid">
      {#each outlook as w}
        <div class="wk" class:past={week > 0 && w.week < week} class:now={w.week === week} class:thin={w.thin.length}>
          <div class="whd">
            <span class="wnum">WK {w.week}</span>
            {#if w.week === week}<span class="tag now">THIS WEEK</span>
            {:else if w.thin.length}<span class="tag thin">THIN: {w.thin.join(', ')}</span>
            {:else}<span class="tag">{w.players.length} out</span>{/if}
          </div>
          <div class="plist">
            {#each w.players as p}
              <div class="pr" class:starter={p.starter}>
                <span class="pos">{p.pos}</span>
                <span class="pn"><PlayerChip name={p.name} /></span>
                {#if p.starter}<span class="st">STARTER</span>{/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .radar { padding-top: 2px; }
  .legend { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 14px; line-height: 1.6; max-width: 74ch; }
  .empty a { color: var(--neon); }
  .thintag { color: var(--stamp-red); font-size: 9px; border: 1px solid rgba(214,69,60,.4); border-radius: 3px; padding: 1px 5px; }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--muted); padding: 20px 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 12px; }
  .wk { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .wk.thin { border-color: rgba(214,69,60,.4); }
  .wk.now { border-color: rgba(130,201,252,.5); box-shadow: 0 0 0 1px rgba(130,201,252,.3); }
  .wk.past { opacity: .5; }
  .whd { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .wnum { font-family: 'Archivo Black', sans-serif; font-size: 16px; color: var(--chalk); }
  .tag { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: .06em; color: var(--muted); border: 1px solid var(--line); border-radius: 3px; padding: 2px 6px; }
  .tag.thin { color: var(--stamp-red); border-color: rgba(214,69,60,.4); }
  .tag.now { color: var(--neon); border-color: rgba(130,201,252,.5); }
  .plist { display: flex; flex-direction: column; gap: 4px; }
  .pr { display: flex; align-items: center; gap: 8px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; padding: 3px 0; }
  .pr .pos { min-width: 30px; color: var(--muted); font-weight: 700; font-size: 10px; }
  .pr .pn { flex: 1; color: var(--chalk); }
  .pr.starter .pn { color: var(--neon-hot); }
  .pr .st { font-size: 8px; letter-spacing: .06em; color: var(--brass); border: 1px solid rgba(201,164,92,.4); border-radius: 3px; padding: 1px 4px; }
</style>
