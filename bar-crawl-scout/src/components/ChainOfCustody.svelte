<script>
  // Renders chainOfCustody() events as a vertical evidence chain on a neon thread.
  export let events = [];
  export let loading = false;
  const LABEL = { draft: 'DRAFTED', keep: 'KEPT', faab: 'FAAB', add: 'ADDED', drop: 'DROPPED', trade: 'TRADED' };
</script>

<div class="coc">
  <div class="hd">Chain of Custody</div>
  {#if events.length}
    <div class="chain">
      {#each events as e, i}
        <div class="node" class:last={i === events.length - 1}>
          <span class="dot {e.kind}"></span>
          <div class="card">
            <div class="tag {e.kind}">{LABEL[e.kind] || e.kind}</div>
            <div class="when">{e.season}{e.week ? ' · Wk ' + e.week : ''}</div>
            <div class="what"><b>{e.handle}</b> — {e.detail}</div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty">{loading ? 'Pulling the file — walking every season…' : 'No league history on file yet — syncs from Sleeper in your browser.'}</div>
  {/if}
</div>

<style>
  .coc { margin-top: 12px; }
  .hd { font-family: 'Archivo Black', sans-serif; font-size: 14px; text-transform: uppercase; color: var(--chalk); margin-bottom: 12px; }
  .chain { position: relative; padding-left: 6px; }
  .node { position: relative; padding: 0 0 18px 26px; }
  .node::before {
    content: ''; position: absolute; left: 5px; top: 14px; bottom: -4px; width: 2px;
    background: linear-gradient(var(--neon), rgba(130, 201, 252, 0.25));
  }
  .node.last::before { display: none; }
  .dot {
    position: absolute; left: 0; top: 5px; width: 12px; height: 12px; border-radius: 50%;
    background: var(--barroom-lift); border: 2px solid var(--neon); box-shadow: 0 0 8px rgba(130, 201, 252, 0.6);
  }
  .dot.drop { border-color: var(--stamp-red); box-shadow: 0 0 8px rgba(214, 69, 60, 0.5); }
  .dot.keep { border-color: var(--brass); box-shadow: 0 0 8px rgba(201, 164, 92, 0.5); }
  .card { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 7px; padding: 9px 12px; }
  .tag { display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; font-weight: 700; letter-spacing: 0.12em; padding: 2px 6px; border-radius: 3px; color: var(--neon); border: 1px solid rgba(130, 201, 252, 0.4); }
  .tag.drop { color: var(--stamp-red); border-color: rgba(214, 69, 60, 0.4); }
  .tag.keep { color: var(--brass); border-color: rgba(201, 164, 92, 0.4); }
  .when { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: var(--muted); margin: 5px 0 3px; }
  .what { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--chalk); }
  .what b { color: var(--neon-hot); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); }
</style>
