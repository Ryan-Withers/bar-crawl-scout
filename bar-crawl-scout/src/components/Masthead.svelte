<script>
  // The hero — scrolls away; identity is carried by the sticky bar below it.
  import { createQuery } from '@tanstack/svelte-query';
  import { foundingQuery } from '../api/queries';
  import NeonSign from './NeonSign.svelte';

  const founding = createQuery(foundingQuery());
  $: year = $founding.data;
  $: sub = (year ? `EST. ${year} · ` : '') + 'THE OFFICIAL BAR CRAWL ORDER · 10 SEATS · HALF-PPR · KEEPER';
</script>

<header class="mast">
  <p class="eyebrow">File 00 / The Back Room</p>
  <NeonSign {sub} />
</header>

<style>
  .mast { padding: 18px 0 8px; }
  .eyebrow { font-family: var(--mono); font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: var(--accent); margin: 0 0 6px; }
</style>
