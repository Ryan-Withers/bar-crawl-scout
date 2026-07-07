<script>
  // Renders vsLeague() rows as a receipt ledger: avg / best / games per manager.
  export let rows = [];
  export let loading = false;
  $: max = rows.length ? Math.max(...rows.map((r) => r.avg)) : 0;
</script>

<div class="vs">
  <div class="hd">Vs The League</div>
  {#if rows.length}
    <div class="grid">
      {#each rows as r}
        <div class="row">
          <span class="opp">{r.opponent}</span>
          <span class="bar"><span class="fill" style="width:{max ? (r.avg / max) * 100 : 0}%"></span></span>
          <span class="avg">{r.avg}</span>
          <span class="meta">best {r.best} · {r.games}g</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty">{loading ? 'Cross-referencing every matchup…' : 'No head-to-head history on file yet — builds from matchups in your browser.'}</div>
  {/if}
</div>

<style>
  .vs { margin-top: 2px; }
  .hd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 12px; }
  .grid { display: flex; flex-direction: column; gap: 8px; }
  .row { display: grid; grid-template-columns: 90px 1fr auto auto; align-items: center; gap: 12px; }
  .opp { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--chalk); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { height: 8px; background: var(--barroom); border-radius: 4px; overflow: hidden; }
  .fill { display: block; height: 100%; background: linear-gradient(90deg, rgba(130,201,252,.5), var(--neon)); border-radius: 4px; }
  .avg { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 700; color: var(--neon-hot); min-width: 40px; text-align: right; }
  .meta { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: var(--muted); min-width: 84px; text-align: right; }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); }
</style>
