<script>
  import { hoverCard, keepers, mode, rosterOwn, unlocked } from '../lib/store.js';
  import { BYUNAME, RYAN } from '../lib/data.js';
  import { windowVal, r26, r27, ownerOf, rosterOwner, isFinalYr, isRyanPlayer, yearsLeft } from '../lib/models.js';

  let innerWidth = 1200;
  // Never render the hover preview on touch devices (no mouseleave to dismiss it).
  const canHover = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  $: hc = canHover ? $hoverCard : null;
  $: p = hc ? BYUNAME[hc.name.toLowerCase()] : null;
  $: ks = $keepers;
  $: md = $mode;
  $: own = $rosterOwn;

  $: WIN = p ? windowVal(p, ks, md) : 0;
  $: k = p ? ownerOf(ks, hc.name) : null;
  $: ro = p ? rosterOwner(own, hc.name) : null;
  $: classified = p && isRyanPlayer(ks, hc.name) && !$unlocked;

  function oneLiner(p, name) {
    if (isFinalYr(ks, name)) return 'Final-year keeper — R27 is a free roster slot, not zero.';
    const st = p[6] || '';
    if (['rookie', 'yr2', 'asc'].includes(st)) return 'Ascending — gains value into 2027.';
    if (['aging', 'fading'].includes(st)) return 'Mileage — his 2027 value decays.';
    return 'Prime-window contributor.';
  }
  $: left = hc ? Math.max(8, Math.min(hc.x, innerWidth - 250)) : 0;
</script>

<svelte:window bind:innerWidth />

{#if hc && p}
  <div class="hc" style="left:{left}px; top:{hc.y + 8}px">
    <div class="pos">{p[2]} · {p[3]}{p[4] ? ' · bye ' + p[4] : ''}</div>
    <div class="nm">{hc.name}</div>
    <div class="row">
      <span class="win">{classified ? '🔒' : WIN}</span>
      {#if !classified}<span class="rr">R26 {r26(p)} · R27 {r27(p, ks)}</span>{/if}
    </div>
    {#if classified}
      <div class="plate cls">CLASSIFIED</div>
    {:else}
      {#if k && k.conf !== 'U'}<div class="plate kept">PROPERTY OF {k.owner}</div>
      {:else if ro && ro !== RYAN}<div class="plate kept">ON {ro}'S ROSTER</div>
      {:else}<div class="plate free">FREE AGENT</div>{/if}
      <div class="one">{oneLiner(p, hc.name)}</div>
    {/if}
    <div class="hint">click to open the file →</div>
  </div>
{/if}

<style>
  .hc {
    position: fixed; z-index: 9998; pointer-events: none; width: 234px;
    background: var(--paper); color: var(--ink); border-radius: 5px; padding: 12px 14px;
    box-shadow: 0 14px 30px rgba(28,46,64,.16); transform: rotate(-1.2deg);
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    background-image: repeating-linear-gradient(rgba(22, 32, 43, 0.04) 0 1px, transparent 1px 22px);
  }
  .pos { font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); }
  .nm { font-family: 'Archivo Black', sans-serif; font-size: 18px; text-transform: uppercase; line-height: 1; margin: 3px 0 8px; }
  .row { display: flex; align-items: baseline; gap: 10px; }
  .win { font-family: 'Archivo Black', sans-serif; font-size: 26px; color: #2f7fb8; }
  .rr { font-size: 10px; color: var(--ink-soft); }
  .plate { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 7px; border-radius: 3px; border: 1.5px solid; margin-top: 8px; }
  .plate.kept, .plate.cls { color: #b5442f; border-color: #b5442f; }
  .plate.free { color: #2f7fb8; border-color: #2f7fb8; }
  .one { font-size: 10.5px; color: var(--muted); margin-top: 8px; line-height: 1.5; }
  .hint { font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); margin-top: 8px; }
</style>
