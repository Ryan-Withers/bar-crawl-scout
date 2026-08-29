<script>
  // "IS THIS THE BUILD I JUST PUSHED?"
  //
  // GitHub Pages caches index.html, so after a deploy a browser that already has
  // the page can keep serving the old bundle for several minutes. Nothing about
  // that looks like caching from the outside — it looks like the change didn't
  // ship, which is a bad thing to be wondering about in draft week.
  //
  // So every build writes its id to version.json, and this re-reads that file
  // with cache: 'no-store' (bypassing the very cache that causes the problem)
  // and offers a reload when the page has fallen behind. It renders nothing at
  // all until then.
  //
  // Silent on failure by design: offline, a 404 on an older deploy, a proxy that
  // mangles it — none of those are worth a banner. The page is still the page.
  import { onMount, onDestroy } from 'svelte';

  const MINE = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '';
  const EVERY = 60_000;

  let latest = '';
  let timer = null;

  async function check() {
    if (!MINE || document.hidden) return;
    try {
      // The app BASE, not the current URL: resolving against document.baseURI
      // asks /bar-crawl-scout/player/version.json on a player page, which is a
      // 404 and would leave this permanently silent on half the site.
      const url = `${import.meta.env.BASE_URL || '/'}version.json`;
      const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      const v = await r.json();
      if (v && typeof v.id === 'string' && v.id) latest = v.id;
    } catch { /* offline, or an older deploy with no version.json — never a banner */ }
  }

  onMount(() => {
    // Also the answer to "which build am I actually looking at?", which is worth
    // being able to read off the page rather than guess at.
    if (MINE) document.documentElement.dataset.build = MINE;
    check();
    timer = setInterval(check, EVERY);
    // Coming back to the tab is the moment you most want to know.
    document.addEventListener('visibilitychange', check);
  });
  onDestroy(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', check);
  });

  // A hard reload, so the cached index.html goes too rather than handing back
  // the same stale bundle it just served.
  const reload = () => window.location.reload();

  $: behind = !!MINE && !!latest && latest !== MINE;
</script>

{#if behind}
  <button class="newver" data-testid="new-version" on:click={reload}>
    ↻ New version — tap to load it
  </button>
{/if}

<style>
  .newver {
    position: fixed; z-index: 90; left: 50%; transform: translateX(-50%);
    bottom: calc(14px + env(safe-area-inset-bottom, 0px));
    font-family: var(--mono); font-size: 12px; font-weight: 700;
    background: var(--blue); color: var(--on-neon);
    border: 1px solid var(--blue-deep); border-radius: 999px;
    padding: 9px 16px; min-height: 38px; cursor: pointer;
    box-shadow: 0 6px 20px rgba(28, 78, 116, .3);
  }
  .newver:hover { background: var(--blue-deep); }
</style>
