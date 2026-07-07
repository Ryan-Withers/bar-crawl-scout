<script>
  import { createQuery } from '@tanstack/svelte-query';
  import { foundingQuery } from '../api/queries';
  import { MODEHINT } from '../lib/data.js';
  import { mode } from '../lib/store.js';
  import NeonSign from './NeonSign.svelte';
  import SyncCoaster from './SyncCoaster.svelte';

  const founding = createQuery(foundingQuery());
  const MODES = [
    { m: 'winnow', label: 'Win-now' },
    { m: 'balanced', label: 'Balanced' },
    { m: 'future', label: 'Future' },
  ];
  $: year = $founding.data;
  $: sub = (year ? `EST. ${year} · ` : '') + 'THE OFFICIAL BAR CRAWL ORDER · 10 SEATS · HALF-PPR · KEEPER';
</script>

<header class="mast">
  <div>
    <p class="eyebrow">File 00 / The Back Room</p>
    <NeonSign {sub} />
  </div>
  <div class="right">
    <SyncCoaster />
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

<style>
  .right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
</style>
