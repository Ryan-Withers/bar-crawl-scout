<script>
  import { onMount } from 'svelte';
  import Router from './lib/Router.svelte';
  import { link, location } from './lib/router.js';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { queryClient } from './api/queries';
  import { PLAYERS, MODEHINT } from './lib/data.js';
  import { mode, unlocked } from './lib/store.js';
  import { autoLoad } from './lib/sync.js';
  import { SECTIONS, QUICK_NAV, itemFor, sectionFor } from './lib/nav.js';
  import SideNav from './components/SideNav.svelte';
  import SyncCoaster from './components/SyncCoaster.svelte';
  import ToggleSwitch from './components/ToggleSwitch.svelte';
  import Home from './components/Home.svelte';
  import Board from './components/Board.svelte';
  import Keepers from './components/Keepers.svelte';
  import Managers from './components/Managers.svelte';
  import Trade from './components/Trade.svelte';
  import Faab from './components/Faab.svelte';
  import Intel from './components/Intel.svelte';
  import Standings from './components/Standings.svelte';
  import MyTeam from './components/MyTeam.svelte';
  import ByeRadar from './components/ByeRadar.svelte';
  import Matchup from './components/Matchup.svelte';
  import Players from './components/Players.svelte';
  import PowerRankings from './components/PowerRankings.svelte';
  import HoverCard from './components/HoverCard.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import LiveKeepers from './components/LiveKeepers.svelte';
  import NewVersion from './components/NewVersion.svelte';

  // LAZY ROUTES. Each of these is a whole screen of machinery most visits never
  // open — the War Room alone is the biggest thing in the app — and shipping
  // them in the entry chunk made every page, on every phone, wait for all of
  // them. `__lazy` marks a loader for Router.svelte, because a Svelte component
  // is itself a function and the two cannot otherwise be told apart.
  const lazy = (loader) => Object.assign(loader, { __lazy: true });
  const MockDraft = lazy(() => import('./components/MockDraft.svelte'));
  const Vault = lazy(() => import('./components/Vault.svelte'));
  const DraftGrades = lazy(() => import('./components/DraftGrades.svelte'));
  const DraftRoom = lazy(() => import('./components/DraftRoom.svelte'));
  const Sheet = lazy(() => import('./components/Sheet.svelte'));
  const TheBook = lazy(() => import('./components/TheBook.svelte'));
  const BetLedger = lazy(() => import('./components/BetLedger.svelte'));
  const Wall = lazy(() => import('./components/Wall.svelte'));
  const Gameday = lazy(() => import('./components/Gameday.svelte'));
  const Playoffs = lazy(() => import('./components/Playoffs.svelte'));
  const Compare = lazy(() => import('./components/Compare.svelte'));
  const PlayerFile = lazy(() => import('./components/PlayerFile.svelte'));
  const ManagerDossier = lazy(() => import('./components/ManagerDossier.svelte'));
  const SyncPage = lazy(() => import('./components/Sync.svelte'));
  const Settings = lazy(() => import('./components/Settings.svelte'));

  import Stub from './components/Stub.svelte';

  // Pull live rosters from the Worker on open (silent if offline/blocked).
  onMount(autoLoad);

  const routes = {
    '/': Home,
    '/myteam': MyTeam,
    '/matchup': Matchup,
    '/byes': ByeRadar,
    '/board': Board,
    '/keepers': Keepers,
    '/managers': Managers,
    '/managers/:id': ManagerDossier,
    '/trade': Trade,
    '/player/:id': PlayerFile,
    '/compare/:a/:b': Compare,
    '/waivers': Faab,
    '/players': Players,
    '/intel': Intel,
    '/sync': SyncPage,
    '/matchups': Gameday,
    '/standings': Standings,
    '/playoffs': Playoffs,
    '/power': PowerRankings,
    '/mock': MockDraft,
    '/vault': Vault,
    '/grades': DraftGrades,
    '/draftboard': DraftRoom,
    // Hidden on purpose: a real route, deliberately absent from nav.js so the
    // app never links to it. Security by obscurity — the repo is public.
    '/sheet': Sheet,
    '/book': TheBook,
    '/leaderboard': BetLedger,
    '/history': Wall,
    '/draft': Stub,
    '/settings': Settings,
    '*': Stub,
  };

  // What's open right now — drives the page title and the mobile header.
  $: openItem = itemFor($location);
  $: openSection = sectionFor($location);
  $: pageTitle = $location === '/' ? 'Home' : (openItem ? openItem.label : 'Bar Crawl Scout');
  $: {
    if (typeof document !== 'undefined') {
      document.title = $location === '/'
        ? 'Bar Crawl Scout — your league HQ'
        : (openItem ? `${openItem.label} · Bar Crawl Scout` : 'Bar Crawl Scout');
    }
  }

  // The window-mode control only means something on valuation pages.
  const MODE_ROUTES = ['/myteam', '/board', '/keepers', '/managers', '/trade', '/player', '/compare', '/waivers', '/players', '/intel'];
  $: showMode = MODE_ROUTES.some((r) => $location.startsWith(r));

  // The draft room takes the whole screen, like a real one. So does the hidden
  // sheet, which is all table and wants every pixel.
  $: focusMode = $location.startsWith('/mock') || $location.startsWith('/sheet');

  let drawerOpen = false;
  const closeDrawer = () => (drawerOpen = false);
  $: if (focusMode) drawerOpen = false;

  function openPalette() { window.dispatchEvent(new CustomEvent('palette:open')); }
  const isQuickOn = (loc, path) => (path === '/' ? loc === '/' : loc === path || loc.startsWith(path + '/'));
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && closeDrawer()} />

<QueryClientProvider client={queryClient}>
  <!-- Renders nothing; pulls the locked keepers and hands them to the store,
       so every page that reads keepers reads Sleeper rather than a guess. -->
  <LiveKeepers />
  <!-- Renders nothing until the deployed build id stops matching this one, then
       offers a reload. GitHub Pages caches index.html, so without this a fresh
       deploy can look for several minutes exactly like a change that never
       shipped. Outside the focus check on purpose — it matters most mid-draft. -->
  <NewVersion />
  <div class="app" class:focus={focusMode}>
    {#if !focusMode}
      <aside class="rail" data-testid="sidebar">
        <a class="brand" href="/" use:link>
          <span class="bmark">BCS</span>
          <span class="bname">Bar Crawl <b>Scout</b></span>
        </a>
        <SideNav />
      </aside>
    {/if}

    <div class="main">
      {#if !focusMode}
        <header class="topbar">
          <button
            class="burger"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            on:click={() => (drawerOpen = !drawerOpen)}
            data-testid="burger"
          >☰</button>

          <div class="crumb">
            {#if openSection}<span class="csect">{openSection.label}</span>{/if}
            <h1 class="ctitle">{pageTitle}</h1>
          </div>

          <div class="util">
            {#if $unlocked}<a class="commishchip" href="/settings" use:link title="Commissioner mode — your files are unsealed">🔓</a>{/if}
            <SyncCoaster />
            <button class="jump" on:click={openPalette} data-testid="jump">
              <span class="lens">⌕</span><span class="jtxt">Search</span><kbd>⌘K</kbd>
            </button>
          </div>
        </header>

        {#if openItem}
          <p class="pagelede" data-testid="page-lede">{openItem.desc}</p>
        {/if}
        {#if showMode}
          <!-- The window-mode dial gets its own row so it fits a phone and reads
               next to the sentence that explains what it just did. -->
          <div class="moderow" data-testid="moderow">
            <ToggleSwitch />
            <p class="modehint">{MODEHINT[$mode]}</p>
          </div>
        {/if}
      {/if}

      <main class="content" data-testid="content">
        <Router {routes} />
      </main>

      {#if !focusMode}
        <p class="credit">Bar Crawl Scout · ADP: FantasyPros 2026 half-PPR</p>
      {/if}
    </div>
  </div>

  {#if !focusMode}
    <nav class="tabbar" aria-label="Quick navigation" data-testid="tabbar">
      {#each QUICK_NAV as q}
        <a href={q.path} use:link class:on={isQuickOn($location, q.path)}>
          <span class="tico">{q.icon}</span><span class="tlbl">{q.label}</span>
        </a>
      {/each}
      <button class:on={drawerOpen} on:click={() => (drawerOpen = !drawerOpen)} data-testid="tab-more">
        <span class="tico">☰</span><span class="tlbl">More</span>
      </button>
    </nav>
  {/if}

  {#if drawerOpen}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="scrim" on:click={closeDrawer} role="presentation"></div>
    <aside class="drawer" data-testid="drawer">
      <div class="drawerhd">
        <span class="bname">Bar Crawl <b>Scout</b></span>
        <button class="close" on:click={closeDrawer} aria-label="Close menu">✕</button>
      </div>
      <p class="drawerlede">Everything in the app, grouped. Tap anything to jump.</p>
      <SideNav drawer onNavigate={closeDrawer} />
    </aside>
  {/if}
</QueryClientProvider>

<HoverCard />
<CommandPalette />

<style>
  /* THE SHELL — a persistent rail on desktop, a full-bleed content column that
     actually uses the viewport, and a thumb-friendly tab bar on phones. */
  .app { display: block; min-height: 100vh; }
  .main { min-width: 0; }

  .rail { display: none; }
  .brand { display: flex; align-items: center; gap: 9px; padding: 16px 16px 6px; text-decoration: none; }
  .bmark {
    font-family: var(--display); font-weight: 800; font-size: 12px; letter-spacing: .04em;
    color: #fff; background: var(--blue); border-radius: 8px; padding: 6px 8px; line-height: 1;
  }
  .bname { font-family: var(--display); font-weight: 800; font-size: 15px; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); }
  .bname b { color: var(--blue); }

  .topbar {
    position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; background: rgba(247,250,253,.94); border-bottom: 1px solid var(--line);
  }
  .burger {
    flex: none; width: 42px; height: 42px; border-radius: 10px; border: 1px solid var(--line);
    background: #fff; color: var(--chalk); font-size: 17px; cursor: pointer;
  }
  .crumb { min-width: 0; flex: 1; }
  .csect { display: block; font-family: var(--mono); font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--blue); }
  .ctitle {
    margin: 0; font-family: var(--display); font-weight: 800; font-size: 19px; line-height: 1.15;
    color: var(--chalk); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .util { display: flex; align-items: center; gap: 8px; flex: none; min-width: 0; }
  .commishchip { font-size: 15px; text-decoration: none; line-height: 1; }
  .jump {
    display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid var(--line);
    border-radius: 9px; padding: 8px 11px; cursor: pointer; color: var(--muted);
    font-family: var(--mono); font-size: 11px; min-height: 40px;
  }
  .jump:hover { border-color: rgba(47,127,184,.5); color: var(--chalk); }
  .jump .lens { color: var(--blue); font-size: 13px; }
  .jump kbd { font-size: 9px; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; }

  .pagelede {
    font-family: var(--mono); font-size: 12px; line-height: 1.6; color: var(--muted);
    margin: 12px 16px 0; max-width: 78ch;
  }
  .moderow {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 10px 16px 0;
  }
  .modehint { font-family: var(--mono); font-size: 11px; color: var(--muted); margin: 0; line-height: 1.5; flex: 1 1 220px; }
  .content { padding: 14px 16px 20px; min-width: 0; }
  /* The draft room owns the whole viewport — no shell padding, no tab bar gap. */
  .app.focus .content { padding: 0; }
  .credit { font-family: var(--mono); font-size: 10px; color: var(--muted); margin: 20px 16px 0; opacity: .8; }

  /* Phone tab bar — the four things you actually open, plus everything else. */
  .tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex;
    background: rgba(255,255,255,.97); border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .tabbar a, .tabbar button {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    min-height: 54px; text-decoration: none; border: none; background: none; cursor: pointer;
    color: var(--muted); font-family: var(--body); padding: 6px 2px;
  }
  .tabbar .tico { font-size: 16px; line-height: 1; }
  .tabbar .tlbl { font-size: 10px; font-weight: 700; }
  .tabbar a.on, .tabbar button.on { color: var(--blue); }

  /* Drawer — the full map of the app, descriptions and all. */
  .scrim { position: fixed; inset: 0; background: rgba(10,22,34,.5); z-index: 50; }
  .drawer {
    position: fixed; top: 0; bottom: 0; left: 0; width: min(340px, 88vw); z-index: 55;
    background: #fff; box-shadow: 0 0 50px rgba(10,22,34,.35); overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .drawerhd { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 6px; }
  .close { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--line); background: #fff; font-size: 15px; cursor: pointer; color: var(--muted); }
  .drawerlede { font-family: var(--mono); font-size: 11px; color: var(--muted); margin: 0 16px 4px; line-height: 1.5; }

  /* Desktop: the rail appears, the burger and tab bar retire. */
  @media (min-width: 1000px) {
    .app { display: grid; grid-template-columns: 268px minmax(0, 1fr); }
    .app.focus { display: block; }
    .rail {
      display: block; position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
      background: #fff; border-right: 1px solid var(--line);
    }
    .burger, .tabbar { display: none; }
    .topbar { padding: 12px 28px; background: rgba(247,250,253,.95); }
    .ctitle { font-size: 22px; }
    .pagelede, .moderow, .credit { margin-left: 28px; margin-right: 28px; }
    .content { padding: 16px 28px 40px; }
    .jtxt { display: inline; }
  }
  @media (max-width: 999px) {
    /* Clear the fixed tab bar. */
    .content { padding-bottom: 78px; }
    .app.focus .content { padding-bottom: 0; }
    .jtxt, .jump kbd { display: none; }
    .jump { padding: 8px; }
  }
</style>

<datalist id="plist">
  {#each PLAYERS as p}<option value={p[1]}></option>{/each}
</datalist>
