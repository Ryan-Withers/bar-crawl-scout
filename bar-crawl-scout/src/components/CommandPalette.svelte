<script>
  // Cmd/Ctrl-K jump box — search every player + page. The Back Room card catalog.
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { PLAYERS } from '../lib/data.js';

  const PAGES = [
    ['The Big Board', '/board'], ['Keeper Ledger', '/keepers'], ['The Files (Managers)', '/managers'],
    ['Trade Desk', '/trade'], ['The Wire (Waivers)', '/waivers'], ['Intel', '/intel'],
    ['Gameday', '/matchups'], ['The Table', '/standings'], ['History', '/history'], ['Sync', '/sync'],
  ];

  let open = false;
  let q = '';
  let sel = 0;
  let input;

  // rank: prefix hit beats substring; players by ADP within ties.
  $: hits = build(q);
  function build(query) {
    const s = query.trim().toLowerCase();
    const pages = PAGES.map(([l, p]) => ({ kind: 'page', label: l, to: p }))
      .filter((x) => !s || x.label.toLowerCase().includes(s));
    const players = PLAYERS
      .map((p) => ({ kind: 'player', label: p[1], sub: `${p[2]} · ${p[3]}`, adp: p[5], to: '/player/' + encodeURIComponent(p[1]) }))
      .filter((x) => !s || x.label.toLowerCase().includes(s))
      .sort((a, b) => {
        const ap = a.label.toLowerCase().startsWith(s) ? 0 : 1;
        const bp = b.label.toLowerCase().startsWith(s) ? 0 : 1;
        return ap - bp || a.adp - b.adp;
      })
      .slice(0, 8);
    return [...pages.slice(0, s ? 4 : 6), ...players];
  }
  $: if (hits && sel >= hits.length) sel = 0;

  function show() { open = true; q = ''; sel = 0; setTimeout(() => input && input.focus(), 0); }
  function hide() { open = false; }
  function go(h) { if (!h) return; hide(); push(h.to); }

  function onKey(e) {
    const k = (e.key || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); open ? hide() : show(); return; }
    if (!open) return;
    if (k === 'escape') { e.preventDefault(); hide(); }
    else if (k === 'arrowdown') { e.preventDefault(); sel = (sel + 1) % hits.length; }
    else if (k === 'arrowup') { e.preventDefault(); sel = (sel - 1 + hits.length) % hits.length; }
    else if (k === 'enter') { e.preventDefault(); go(hits[sel]); }
  }
  onMount(() => {
    window.addEventListener('keydown', onKey);
    window.addEventListener('palette:open', show);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('palette:open', show); };
  });
</script>

{#if open}
  <!-- Backdrop click (target === self) dismisses; Escape is handled globally. -->
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="scrim" on:click={(e) => e.target === e.currentTarget && hide()} role="presentation">
    <div class="palette" role="dialog" aria-modal="true" aria-label="Jump to">
      <div class="bar">
        <span class="lens">⌕</span>
        <input bind:this={input} bind:value={q} placeholder="Jump to a player or page…" spellcheck="false" />
        <kbd>ESC</kbd>
      </div>
      <div class="list">
        {#each hits as h, i}
          <button class="row" class:on={i === sel} on:click={() => go(h)} on:mousemove={() => (sel = i)}>
            <span class="badge {h.kind}">{h.kind === 'page' ? 'GO' : h.sub}</span>
            <span class="lbl">{h.label}</span>
          </button>
        {:else}
          <div class="none">No file matches “{q}”.</div>
        {/each}
      </div>
      <div class="foot"><kbd>↑↓</kbd> move · <kbd>↵</kbd> open · <kbd>⌘K</kbd> toggle</div>
    </div>
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; background: rgba(6, 10, 18, 0.82); z-index: 200; display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; }
  .palette { width: min(560px, 92vw); background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 24px 60px rgba(28,46,64,.16); overflow: hidden; }
  .bar { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
  .lens { color: var(--neon); font-size: 18px; }
  .bar input { flex: 1; background: none; border: none; outline: none; color: var(--chalk); font-family: 'IBM Plex Mono', monospace; font-size: 15px; }
  kbd { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 2px 5px; }
  .list { max-height: 46vh; overflow-y: auto; padding: 6px; }
  .row { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: none; border: none; border-radius: 7px; padding: 9px 11px; cursor: pointer; color: var(--chalk); }
  .row.on { background: rgba(130, 201, 252, 0.12); }
  .badge { flex: none; min-width: 62px; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .08em; color: var(--muted); text-transform: uppercase; }
  .badge.page { color: var(--neon); }
  .lbl { font-family: 'Archivo', sans-serif; font-size: 14px; }
  .row.on .lbl { color: var(--neon-hot); }
  .none { padding: 20px 12px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); }
  .foot { display: flex; gap: 10px; padding: 9px 16px; border-top: 1px solid var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); }
  .foot kbd { font-size: 9px; }
</style>
