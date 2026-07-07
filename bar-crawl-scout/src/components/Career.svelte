<script>
  // Season-by-season league-scored totals + a PPG trajectory sparkline.
  export let rows = [];
  export let loading = false;
  $: ppgs = rows.map((r) => r.ppg ?? 0);
  $: hi = ppgs.length ? Math.max(...ppgs, 1) : 1;
</script>

<div class="car">
  <div class="hd">Career</div>
  {#if rows.length}
    <div class="grid">
      {#each rows as r}
        <div class="row">
          <span class="yr">{r.season}</span>
          <span class="spark"><span class="fill" style="height:{Math.max(6, (r.ppg ?? 0) / hi * 100)}%"></span></span>
          <span class="ppg">{r.ppg != null ? r.ppg : '—'}<em>PPG</em></span>
          <span class="tot">{r.points.toFixed(1)} pts · {r.games}g</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty">{loading ? 'Reading the whole jacket — every season…' : 'No career sheet on file yet — season totals build in your browser.'}</div>
  {/if}
</div>

<style>
  .car { margin-top: 2px; }
  .hd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 12px; }
  .grid { display: flex; flex-direction: column; gap: 8px; }
  .row { display: grid; grid-template-columns: 52px 46px auto 1fr; align-items: end; gap: 12px; padding-bottom: 6px; border-bottom: 1px dashed var(--line); }
  .yr { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 700; color: var(--chalk); }
  .spark { display: flex; align-items: flex-end; height: 34px; }
  .fill { display: block; width: 100%; background: linear-gradient(var(--neon), rgba(130,201,252,.35)); border-radius: 3px 3px 0 0; }
  .ppg { font-family: 'IBM Plex Mono', monospace; font-size: 16px; font-weight: 700; color: var(--neon-hot); white-space: nowrap; }
  .ppg em { font-size: 8.5px; font-style: normal; color: var(--muted); margin-left: 3px; }
  .tot { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); text-align: right; }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); }
</style>
