<script>
  import { mode, lastSync } from './lib/store.js';
  import { MODEHINT, PLAYERS } from './lib/data.js';
  import Board from './components/Board.svelte';
  import Keepers from './components/Keepers.svelte';
  import Managers from './components/Managers.svelte';
  import Intel from './components/Intel.svelte';

  const TABS = [
    { id: 'board', label: 'Board' },
    { id: 'keepers', label: 'Keepers' },
    { id: 'mgrs', label: 'Managers' },
    { id: 'trade', label: 'Trade' },
    { id: 'faab', label: 'FAAB' },
    { id: 'plan', label: 'Intel' },
    { id: 'sync', label: 'Sync' },
  ];
  const MODES = [
    { m: 'winnow', label: 'Win-now' },
    { m: 'balanced', label: 'Balanced' },
    { m: 'future', label: 'Future' },
  ];
  let active = 'board';
</script>

<div class="wrap">
  <header class="mast">
    <div>
      <p class="eyebrow">Official Bar Crawl Order · Half-PPR · 10-team · Keeper</p>
      <h1 class="title">Bar Crawl <span>Scout</span></h1>
      <p class="sub">Rankings, manager dossiers, a trade calculator and FAAB reads for the whole league. One team's file is classified (you can probably guess whose). The WIN number is the master metric. Good luck, you will need it.</p>
    </div>
    <div>
      <div class="modebar">
        <span class="lbl">Window mode</span>
        <div class="seg">
          {#each MODES as m}
            <button class:on={$mode === m.m} on:click={() => ($mode = m.m)}>{m.label}</button>
          {/each}
        </div>
      </div>
      <p class="modehint">{MODEHINT[$mode]}</p>
    </div>
  </header>

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
  {:else if active === 'plan'}
    <Intel />
  {:else}
    <section class="tab on">
      <div class="note">The <b>{TABS.find((t) => t.id === active).label}</b> tab is being ported to the new app — coming shortly.</div>
    </section>
  {/if}

  <p class="credit">Bar Crawl Scout · ADP: FantasyPros 2026 half-PPR · {$lastSync ? 'Sleeper synced ' + $lastSync : 'Sleeper not yet synced'}</p>
</div>

<datalist id="plist">
  {#each PLAYERS as p}<option value={p[1]}></option>{/each}
</datalist>
