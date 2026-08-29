<script>
  // Renders the component for the current real-URL location (see router.js).
  // Same routes-object shape the app already used: { '/path': Component,
  // '/player/:id': Component, '*': Fallback }.
  //
  // A route value may also be a LOADER — `() => import('./Heavy.svelte')` — for a
  // page that does not need to be in the first byte the phone downloads. The
  // War Room, the Vault, the draft board and the sheet are each a whole screen
  // of machinery that most visits never open, and shipping them in the entry
  // chunk made every page wait on all of them.
  //
  // The loaded module is cached, so going back to a page is instant. A loader
  // that fails leaves the previous page up rather than blanking the app: a flaky
  // connection on a phone at the pub should not look like a crash.
  import { location, matchRoute } from './router.js';
  export let routes = {};

  const cache = new Map();
  let resolved = null;
  let failed = null;

  $: match = matchRoute(routes, $location);
  $: load(match);

  async function load(m) {
    if (!m) { resolved = null; return; }
    const c = m.component;
    // A Svelte component is a function too, so a loader is marked, not guessed.
    if (!c || !c.__lazy) { resolved = c; failed = null; return; }
    if (cache.has(c)) { resolved = cache.get(c); failed = null; return; }
    const token = c;
    try {
      const mod = await c();
      const comp = mod.default || mod;
      cache.set(token, comp);
      // Only take effect if the user has not navigated on while we loaded.
      if (match && match.component === token) { resolved = comp; failed = null; }
    } catch (e) {
      if (match && match.component === token) failed = e;
    }
  }
</script>

{#if failed}
  <p class="routefail">
    That page didn’t load — most likely the connection dropped mid-download.
    <button on:click={() => { failed = null; load(match); }}>Try again</button>
  </p>
{:else if match && resolved}
  <svelte:component this={resolved} params={match.params} />
{/if}

<style>
  .routefail { font-family: var(--mono); font-size: 13px; color: var(--muted); padding: 24px 0; line-height: 1.7; }
  .routefail button {
    font-family: var(--mono); font-size: 12px; background: var(--blue); color: #fff;
    border: none; border-radius: 8px; padding: 8px 14px; margin-left: 8px; cursor: pointer; min-height: 38px;
  }
</style>
