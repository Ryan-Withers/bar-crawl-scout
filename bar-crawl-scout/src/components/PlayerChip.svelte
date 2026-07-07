<script>
  // Level 1 of the depth kit: any player name, linkified to their Player File.
  import { link } from 'svelte-spa-router';
  export let name;
</script>

<a class="pchip" href={'/player/' + encodeURIComponent(name)} use:link>{name}</a>

<style>
  .pchip {
    color: inherit; text-decoration: none;
    border-bottom: 1px dotted rgba(130, 201, 252, 0.4);
    cursor: pointer; transition: color 0.12s, border-color 0.12s;
  }
  .pchip:hover { color: var(--neon); border-bottom-color: var(--neon); }
</style>
