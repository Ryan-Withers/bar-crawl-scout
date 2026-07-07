<script>
  import { createQuery } from '@tanstack/svelte-query';
  import { foundingQuery } from '../api/queries';
  import { MODEHINT } from '../lib/data.js';
  import { mode } from '../lib/store.js';
  import NeonSign from './NeonSign.svelte';
  import SyncCoaster from './SyncCoaster.svelte';
  import ToggleSwitch from './ToggleSwitch.svelte';

  const founding = createQuery(foundingQuery());
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
    <ToggleSwitch />
    <p class="modehint">{MODEHINT[$mode]}</p>
    <button class="jump" on:click={() => window.dispatchEvent(new CustomEvent('palette:open'))}>
      <span class="lens">⌕</span> Jump to a file <kbd>⌘K</kbd>
    </button>
  </div>
</header>

<style>
  .right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
  .jump { display: inline-flex; align-items: center; gap: 7px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; cursor: pointer; color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-size: 11px; transition: border-color .15s, color .15s; }
  .jump:hover { border-color: rgba(130,201,252,.5); color: var(--chalk); }
  .jump .lens { color: var(--neon); font-size: 13px; }
  .jump kbd { font-size: 9px; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; }
</style>
