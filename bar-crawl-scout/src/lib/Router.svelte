<script>
  // Renders the component for the current real-URL location (see router.js).
  // Same routes-object shape the app already used: { '/path': Component,
  // '/player/:id': Component, '*': Fallback }.
  import { location, matchRoute } from './router.js';
  export let routes = {};
  $: match = matchRoute(routes, $location);
</script>

{#if match}
  <svelte:component this={match.component} params={match.params} />
{/if}
