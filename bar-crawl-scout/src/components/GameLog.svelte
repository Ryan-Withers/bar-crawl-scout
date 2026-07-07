<script>
  // Receipt-style season game log: per-week league-scored points + key line.
  // Best week gets a hand-drawn circle; DNP weeks are struck.
  export let rows = [];
  export let totals = { games: 0, points: 0, ppg: null };
  export let best = null;
  export let loading = false;
</script>

<div class="gl">
  <div class="hd">Game Log</div>
  {#if rows.length}
    <div class="receipt">
      <div class="rrow head"><span class="wk">WK</span><span class="ln">LINE</span><span class="pt">PTS</span></div>
      {#each rows as r}
        <div class="rrow" class:dnp={r.dnp} class:best={r.week === best}>
          <span class="wk">{r.week}{r.week === best ? ' ✦' : ''}</span>
          <span class="ln">{r.dnp ? 'DNP' : r.line || '—'}</span>
          <span class="pt">{r.dnp ? '—' : r.pts.toFixed(1)}</span>
        </div>
      {/each}
      <div class="rrow tot">
        <span class="wk">σ</span>
        <span class="ln">{totals.games} games · {totals.ppg != null ? totals.ppg + ' PPG' : '—'}</span>
        <span class="pt">{totals.points.toFixed(1)}</span>
      </div>
    </div>
  {:else}
    <div class="empty">{loading ? 'Ringing up the receipt — scoring every week…' : 'No box scores on file yet — league-scored per-week in your browser.'}</div>
  {/if}
</div>

<style>
  .gl { margin-top: 2px; }
  .hd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 12px; }
  .receipt { background: var(--paper); color: var(--ink); border-radius: 5px; padding: 12px 14px; box-shadow: inset 0 0 0 1px rgba(28,26,22,.12); }
  .rrow { display: grid; grid-template-columns: 52px 1fr auto; align-items: center; gap: 10px; padding: 5px 0; font-family: 'IBM Plex Mono', monospace; font-size: 12px; border-bottom: 1px dashed rgba(28,26,22,.18); }
  .rrow.head { font-size: 9px; letter-spacing: .12em; color: var(--ink-soft); border-bottom: 1px solid rgba(28,26,22,.35); }
  .rrow:last-child { border-bottom: none; }
  .wk { font-weight: 700; color: var(--ink-soft); }
  .ln { color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pt { font-weight: 700; text-align: right; }
  .rrow.dnp { color: var(--ink-soft); font-style: italic; }
  .rrow.dnp .ln, .rrow.dnp .pt { text-decoration: line-through; text-decoration-thickness: 1px; }
  .rrow.best .pt { color: #b5442f; }
  .rrow.best .wk { color: #b5442f; }
  .rrow.tot { border-top: 2px solid rgba(28,26,22,.5); margin-top: 3px; padding-top: 8px; font-weight: 700; }
  .rrow.tot .ln { font-size: 11px; color: var(--ink-soft); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); }
</style>
