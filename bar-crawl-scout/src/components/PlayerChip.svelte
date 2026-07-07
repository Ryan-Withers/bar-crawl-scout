<script>
  // Level 1 of the depth kit: any player name, linkified to their Player File,
  // with a Level-2 hover card after a short delay (desktop).
  import { link } from 'svelte-spa-router';
  import { hoverCard } from '../lib/store.js';
  export let name;
  let t;
  function enter(e) {
    const r = e.currentTarget.getBoundingClientRect();
    clearTimeout(t);
    t = setTimeout(() => hoverCard.set({ name, x: r.left, y: r.bottom }), 300);
  }
  function leave() { clearTimeout(t); hoverCard.set(null); }
</script>

<a
  class="pchip"
  href={'/player/' + encodeURIComponent(name)}
  use:link
  on:mouseenter={enter}
  on:mouseleave={leave}
  on:focus={enter}
  on:blur={leave}
>{name}</a>

<style>
  .pchip {
    color: inherit; text-decoration: none;
    border-bottom: 1px dotted rgba(130, 201, 252, 0.4);
    cursor: pointer; transition: color 0.12s, border-color 0.12s;
  }
  .pchip:hover { color: var(--neon); border-bottom-color: var(--neon); }
</style>
