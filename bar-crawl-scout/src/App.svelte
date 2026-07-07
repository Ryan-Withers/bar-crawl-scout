<script>
  import { onMount } from 'svelte';
  import Router, { link, location } from 'svelte-spa-router';
  import active from 'svelte-spa-router/active';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from './api/queries';
  import { PLAYERS, MODEHINT } from './lib/data.js';
  import { mode } from './lib/store.js';
  import { autoLoad } from './lib/sync.js';
  import Masthead from './components/Masthead.svelte';
  import SyncCoaster from './components/SyncCoaster.svelte';
  import ToggleSwitch from './components/ToggleSwitch.svelte';
  import Board from './components/Board.svelte';
  import Keepers from './components/Keepers.svelte';
  import Managers from './components/Managers.svelte';
  import ManagerDossier from './components/ManagerDossier.svelte';
  import Trade from './components/Trade.svelte';
  import Faab from './components/Faab.svelte';
  import Intel from './components/Intel.svelte';
  import SyncPage from './components/Sync.svelte';
  import PlayerFile from './components/PlayerFile.svelte';
  import Compare from './components/Compare.svelte';
  import Standings from './components/Standings.svelte';
  import Gameday from './components/Gameday.svelte';
  import Wall from './components/Wall.svelte';
  import Settings from './components/Settings.svelte';
  import MyTeam from './components/MyTeam.svelte';
  import HoverCard from './components/HoverCard.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import Stub from './components/Stub.svelte';

  // Pull live rosters from the Worker on open (silent if offline/blocked).
  onMount(autoLoad);

  const routes = {
    '/': MyTeam,
    '/myteam': MyTeam,
    '/board': Board,
    '/keepers': Keepers,
    '/managers': Managers,
    '/managers/:id': ManagerDossier,
    '/trade': Trade,
    '/player/:id': PlayerFile,
    '/compare/:a/:b': Compare,
    '/waivers': Faab,
    '/intel': Intel,
    '/sync': SyncPage,
    '/matchups': Gameday,
    '/standings': Standings,
    '/history': Wall,
    '/draft': Stub,
    '/settings': Settings,
    '*': Stub,
  };
  const NAV = [
    { p: '/myteam', l: 'My Team' },
    { p: '/board', l: 'Board' },
    { p: '/keepers', l: 'Keepers' },
    { p: '/managers', l: 'Managers' },
    { p: '/trade', l: 'Trade' },
    { p: '/waivers', l: 'Waivers' },
    { p: '/intel', l: 'Intel' },
    { p: '/matchups', l: 'Gameday' },
    { p: '/standings', l: 'Table' },
    { p: '/history', l: 'History' },
    { p: '/settings', l: 'Rules' },
    { p: '/sync', l: 'Sync' },
  ];

  // The window-mode control only means something on valuation pages.
  const MODE_ROUTES = ['/myteam', '/board', '/keepers', '/managers', '/trade', '/player', '/compare', '/waivers', '/intel'];
  $: showMode = $location === '/' || MODE_ROUTES.some((r) => $location.startsWith(r));

  function openPalette() { window.dispatchEvent(new CustomEvent('palette:open')); }
</script>

<QueryClientProvider client={queryClient}>
  <div class="wrap">
    <Masthead />

    <div class="stickytop">
      <div class="topbar">
        <a class="mark" href="/board" use:link>Bar&nbsp;Crawl&nbsp;<b>Scout</b></a>
        <div class="util">
          <SyncCoaster />
          {#if showMode}<ToggleSwitch />{/if}
          <button class="jump" on:click={openPalette}><span class="lens">⌕</span> Jump <kbd>⌘K</kbd></button>
        </div>
      </div>
      <nav class="tabs">
        {#each NAV as n}
          <a href={n.p} use:link use:active={{ path: n.p, className: 'on' }}>{n.l}</a>
        {/each}
      </nav>
    </div>

    {#if showMode}<p class="modehint">{MODEHINT[$mode]}</p>{/if}

    <Router {routes} />
    <p class="credit">Bar Crawl Scout · ADP: FantasyPros 2026 half-PPR · The Back Room build</p>
  </div>
</QueryClientProvider>

<HoverCard />
<CommandPalette />

<style>
  /* Sticky identity + controls + nav: the hero above scrolls away, this stays. */
  .stickytop { position: sticky; top: 0; z-index: 30; background: var(--field); box-shadow: 0 8px 18px -10px rgba(0,0,0,.7); }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0 7px; border-bottom: 1px solid var(--line); }
  .mark { font-family: var(--display); font-weight: 800; font-size: 15px; letter-spacing: .03em; text-transform: uppercase; color: var(--muted); text-decoration: none; white-space: nowrap; }
  .mark b { color: var(--neon); }
  .mark:hover { color: var(--chalk); }
  .util { display: flex; align-items: center; gap: 10px; }
  .jump { display: inline-flex; align-items: center; gap: 6px; background: var(--field-2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; cursor: pointer; color: var(--muted); font-family: var(--mono); font-size: 11px; }
  .jump:hover { border-color: rgba(130,201,252,.5); color: var(--chalk); }
  .jump .lens { color: var(--neon); font-size: 13px; }
  .jump kbd { font-size: 9px; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; }
  .modehint { font-family: var(--mono); font-size: 11px; color: var(--muted); margin: 10px 0 0; line-height: 1.5; }
  @media (max-width: 760px) {
    .topbar { flex-wrap: wrap; gap: 8px; }
    .util { width: 100%; justify-content: space-between; }
    .jump kbd { display: none; }
  }
</style>

<datalist id="plist">
  {#each PLAYERS as p}<option value={p[1]}></option>{/each}
</datalist>
