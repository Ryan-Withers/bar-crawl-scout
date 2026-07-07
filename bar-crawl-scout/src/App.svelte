<script>
  import { onMount } from 'svelte';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from './api/queries';
  import { lastSync } from './lib/store.js';
  import { PLAYERS } from './lib/data.js';
  import { autoLoad } from './lib/sync.js';
  import Masthead from './components/Masthead.svelte';
  import Board from './components/Board.svelte';
  import Keepers from './components/Keepers.svelte';
  import Managers from './components/Managers.svelte';
  import Intel from './components/Intel.svelte';
  import Trade from './components/Trade.svelte';
  import Faab from './components/Faab.svelte';
  import Sync from './components/Sync.svelte';

  // Pull live rosters from the Worker on open (silent if offline/blocked).
  onMount(autoLoad);

  const TABS = [
    { id: 'board', label: 'Board' },
    { id: 'keepers', label: 'Keepers' },
    { id: 'mgrs', label: 'Managers' },
    { id: 'trade', label: 'Trade' },
    { id: 'faab', label: 'FAAB' },
    { id: 'plan', label: 'Intel' },
    { id: 'sync', label: 'Sync' },
  ];
  let active = 'board';
</script>

<QueryClientProvider client={queryClient}>
<div class="wrap">
  <Masthead />

  <nav class="tabs">
    {#each TABS as t}
      <button class:on={active === t.id} on:click={() => (active = t.id)}>{t.label}</button>
    {/each}
  </nav>

  {#if active === 'board'}
    <Board />
  {:else if active === 'keepers'}
    <Keepers />
  {:else if active === 'mgrs'}
    <Managers />
  {:else if active === 'trade'}
    <Trade />
  {:else if active === 'faab'}
    <Faab />
  {:else if active === 'plan'}
    <Intel />
  {:else if active === 'sync'}
    <Sync />
  {/if}

  <p class="credit">Bar Crawl Scout · ADP: FantasyPros 2026 half-PPR · {$lastSync ? 'Sleeper synced ' + $lastSync : 'Sleeper not yet synced'}</p>
</div>
</QueryClientProvider>

<datalist id="plist">
  {#each PLAYERS as p}<option value={p[1]}></option>{/each}
</datalist>
