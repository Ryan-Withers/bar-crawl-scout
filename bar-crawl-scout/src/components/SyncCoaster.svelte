<script>
  import { onMount } from 'svelte';
  import { createQuery, useIsFetching, useQueryClient } from '@tanstack/svelte-query';
  import { leagueQuery } from '../api/queries';

  const league = createQuery(leagueQuery());
  const isFetching = useIsFetching();
  const qc = useQueryClient();

  let now = Date.now();
  onMount(() => { const t = setInterval(() => (now = Date.now()), 10_000); return () => clearInterval(t); });

  function rel(ts) {
    if (!ts) return '—';
    const s = Math.max(0, Math.round((now - ts) / 1000));
    if (s < 60) return s + 'S AGO';
    const m = Math.round(s / 60);
    if (m < 60) return m + 'M AGO';
    return Math.round(m / 60) + 'H AGO';
  }

  $: state = $league.isError ? 'offline' : ($isFetching > 0 ? 'syncing' : ($league.data ? 'synced' : 'idle'));
  const refresh = () => qc.invalidateQueries();
</script>

<button class="coaster {state}" on:click={refresh} title="Force refresh all live data">
  <span class="dot"></span>
  <span class="lines">
    {#if state === 'offline'}<b class="red">OFFLINE</b><small>tap to retry</small>
    {:else if state === 'syncing'}<b>SYNCING</b><small>pulling live data</small>
    {:else if state === 'synced'}<b>SYNCED</b><small>{rel($league.dataUpdatedAt)}</small>
    {:else}<b>POURING…</b><small>connecting</small>{/if}
  </span>
</button>

<style>
  .coaster {
    display: inline-flex; align-items: center; gap: 9px;
    background: var(--barroom-lift); color: var(--chalk);
    border: 1px solid var(--line); border-radius: 999px;
    padding: 7px 14px 7px 11px; cursor: pointer;
    box-shadow: inset 0 0 0 3px rgba(216, 222, 230, 0.03);
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
  }
  .coaster:hover { border-color: rgba(130, 201, 252, 0.4); }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--neon);
    box-shadow: 0 0 7px rgba(130, 201, 252, 0.9); }
  .syncing .dot { animation: pulse 1.4s ease-in-out infinite; background: var(--brass); box-shadow: 0 0 7px rgba(201, 164, 92, 0.9); }
  .offline .dot { background: var(--stamp-red); box-shadow: 0 0 7px rgba(214, 69, 60, 0.8); }
  .idle .dot { background: var(--muted); box-shadow: none; }
  .lines { display: flex; flex-direction: column; line-height: 1.1; text-align: left; }
  .lines b { font-size: 10px; letter-spacing: 0.1em; font-weight: 700; }
  .lines b.red { color: var(--stamp-red); }
  .lines small { font-size: 9px; letter-spacing: 0.06em; color: var(--muted); }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none !important; } }
</style>
