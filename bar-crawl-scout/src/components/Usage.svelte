<script>
  // Usage: target / touch / snap share, off real box-score denominators.
  // Three season dials + a per-week snap-share trend.
  export let summary = { weeks: [], avgTgtShare: null, avgTouch: null, avgSnap: null, snapTrend: null };
  export let loading = false;
  $: weeks = summary.weeks || [];
  $: hi = weeks.length ? Math.max(1, ...weeks.map((w) => w.snap ?? 0)) : 1;
  const ARROW = { up: '▲', down: '▼', flat: '▬' };
  const pct = (v) => (v != null ? v + '%' : '—');
</script>

<div class="us">
  <div class="hd">Usage</div>
  {#if weeks.length}
    <div class="dials">
      <div class="dial"><b>{pct(summary.avgSnap)}</b><span>snap share</span></div>
      <div class="dial"><b>{pct(summary.avgTouch)}</b><span>touch share</span></div>
      <div class="dial"><b>{pct(summary.avgTgtShare)}</b><span>target share</span></div>
      {#if summary.snapTrend}
        <div class="dial trend {summary.snapTrend}"><b>{ARROW[summary.snapTrend]}</b><span>snap trend</span></div>
      {/if}
    </div>
    <div class="bars">
      {#each weeks as w}
        <div class="col" title={'Wk ' + w.week + ' · snap ' + pct(w.snap) + ' · touch ' + pct(w.touch) + ' · tgt ' + pct(w.tgtShare)}>
          <div class="track"><span class="fill" style="height:{((w.snap ?? 0) / hi) * 100}%"></span></div>
          <span class="wl">{w.week}</span>
        </div>
      {/each}
    </div>
    <div class="key">snap share by week · shares = his volume ÷ his team's that week</div>
  {:else}
    <div class="empty">{loading ? 'Charting snaps, targets and touches…' : 'No usage on file yet — target / touch / snap share build in your browser.'}</div>
  {/if}
</div>

<style>
  .us { margin-top: 2px; }
  .hd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 12px; }
  .dials { display: flex; gap: 22px; margin-bottom: 14px; flex-wrap: wrap; }
  .dial { display: flex; flex-direction: column; }
  .dial b { font-family: 'Archivo Black', sans-serif; font-size: 22px; color: var(--neon-hot); line-height: 1; }
  .dial span { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
  .dial.trend.up b { color: var(--neon); } .dial.trend.down b { color: var(--stamp-red); } .dial.trend.flat b { color: var(--muted); }
  .bars { display: flex; align-items: flex-end; gap: 4px; height: 80px; }
  .col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
  .track { flex: 1; width: 100%; display: flex; align-items: flex-end; }
  .fill { display: block; width: 100%; background: linear-gradient(var(--neon), rgba(130,201,252,.4)); border-radius: 2px 2px 0 0; min-height: 2px; }
  .wl { font-family: 'IBM Plex Mono', monospace; font-size: 8px; color: var(--muted); margin-top: 4px; }
  .key { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: var(--muted); margin-top: 10px; }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); }
</style>
