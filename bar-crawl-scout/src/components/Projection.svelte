<script>
  // Weekly projected vs actual (both league-scored). Beat rate + avg delta up top;
  // per-week twin bars below (neon = actual, ghost = projection).
  export let summary = { weeks: [], beatRate: null, avgDelta: null };
  export let loading = false;
  $: weeks = summary.weeks || [];
  $: hi = weeks.length ? Math.max(1, ...weeks.flatMap((w) => [w.proj, w.actual])) : 1;
</script>

<div class="pj">
  <div class="hd">Projection vs Reality</div>
  {#if weeks.length}
    <div class="dials">
      <div class="dial"><b>{summary.beatRate != null ? summary.beatRate + '%' : '—'}</b><span>beat the number</span></div>
      <div class="dial"><b class:pos={(summary.avgDelta ?? 0) >= 0} class:neg={(summary.avgDelta ?? 0) < 0}>{summary.avgDelta != null ? (summary.avgDelta > 0 ? '+' : '') + summary.avgDelta : '—'}</b><span>avg vs proj</span></div>
    </div>
    <div class="bars">
      {#each weeks as w}
        <div class="col" title={'Wk ' + w.week + (w.dnp ? ' · DNP' : ' · proj ' + w.proj.toFixed(1) + ' / act ' + w.actual.toFixed(1))}>
          <div class="stack">
            <span class="proj" style="height:{(w.proj / hi) * 100}%"></span>
            <span class="act" class:beat={!w.dnp && w.actual >= w.proj} style="height:{(w.actual / hi) * 100}%"></span>
          </div>
          <span class="wl">{w.week}</span>
        </div>
      {/each}
    </div>
    <div class="key"><span class="sw act"></span> actual · <span class="sw proj"></span> projected</div>
  {:else}
    <div class="empty">{loading ? 'Lining projections up against reality…' : 'No projection history on file yet — builds weekly in your browser.'}</div>
  {/if}
</div>

<style>
  .pj { margin-top: 2px; }
  .hd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 12px; }
  .dials { display: flex; gap: 22px; margin-bottom: 14px; }
  .dial { display: flex; flex-direction: column; }
  .dial b { font-family: 'Archivo Black', sans-serif; font-size: 22px; color: var(--neon-hot); line-height: 1; }
  .dial b.pos { color: var(--neon); } .dial b.neg { color: var(--stamp-red); }
  .dial span { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
  .bars { display: flex; align-items: flex-end; gap: 4px; height: 96px; }
  .col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
  .stack { position: relative; flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
  .proj, .act { position: absolute; bottom: 0; border-radius: 2px 2px 0 0; }
  .proj { width: 100%; background: rgba(216,222,230,.14); }
  .act { width: 58%; background: linear-gradient(var(--neon), rgba(130,201,252,.5)); }
  .act.beat { background: linear-gradient(var(--neon-hot), var(--neon)); }
  .wl { font-family: 'IBM Plex Mono', monospace; font-size: 8px; color: var(--muted); margin-top: 4px; }
  .key { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: var(--muted); margin-top: 10px; }
  .key .sw { display: inline-block; width: 9px; height: 9px; border-radius: 2px; vertical-align: middle; }
  .key .sw.act { background: var(--neon); } .key .sw.proj { background: rgba(216,222,230,.2); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); }
</style>
