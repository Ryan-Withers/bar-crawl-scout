<script>
  import { onMount } from 'svelte';
  import Router, { link } from 'svelte-spa-router';
  import active from 'svelte-spa-router/active';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from './api/queries';
  import { PLAYERS } from './lib/data.js';
  import { autoLoad } from './lib/sync.js';
  import Masthead from './components/Masthead.svelte';
  import Board from './components/Board.svelte';
  import Keepers from './components/Keepers.svelte';
  import Managers from './components/Managers.svelte';
  import ManagerDossier from './components/ManagerDossier.svelte';
  import Trade from './components/Trade.svelte';
  import Faab from './components/Faab.svelte';
  import Intel from './components/Intel.svelte';
  import SyncPage from './components/Sync.svelte';
  import PlayerFile from './components/PlayerFile.svelte';
  import Stub from './components/Stub.svelte';

  // Pull live rosters from the Worker on open (silent if offline/blocked).
  onMount(autoLoad);

  const routes = {
    '/': Board,
    '/board': Board,
    '/keepers': Keepers,
    '/managers': Managers,
    '/managers/:id': ManagerDossier,
    '/trade': Trade,
    '/player/:id': PlayerFile,
    '/waivers': Faab,
    '/intel': Intel,
    '/sync': SyncPage,
    '/matchups': Stub,
    '/standings': Stub,
    '/history': Stub,
    '/draft': Stub,
    '/settings': Stub,
    '*': Stub,
  };
  const NAV = [
    { p: '/board', l: 'Board' },
    { p: '/keepers', l: 'Keepers' },
    { p: '/managers', l: 'Managers' },
    { p: '/trade', l: 'Trade' },
    { p: '/waivers', l: 'Waivers' },
    { p: '/intel', l: 'Intel' },
    { p: '/matchups', l: 'Gameday' },
    { p: '/standings', l: 'Table' },
    { p: '/history', l: 'History' },
    { p: '/sync', l: 'Sync' },
  ];
</script>

<QueryClientProvider client={queryClient}>
  <div class="wrap">
    <Masthead />
    <nav class="tabs">
      {#each NAV as n}
        <a href={n.p} use:link use:active={{ path: n.p, className: 'on' }}>{n.l}</a>
      {/each}
    </nav>
    <Router {routes} />
    <p class="credit">Bar Crawl Scout · ADP: FantasyPros 2026 half-PPR · The Back Room build</p>
  </div>
</QueryClientProvider>

<datalist id="plist">
  {#each PLAYERS as p}<option value={p[1]}></option>{/each}
</datalist>
