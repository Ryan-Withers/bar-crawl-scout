<script>
  import { mode } from '../lib/store.js';
  const POS = [
    { m: 'winnow', l: 'Win-Now' },
    { m: 'balanced', l: 'Balanced' },
    { m: 'future', l: 'Future' },
  ];
  $: idx = POS.findIndex((p) => p.m === $mode);
</script>

<div class="switch">
  <span class="lbl">Window Mode</span>
  <div class="track" role="group" aria-label="Window mode">
    <div class="knob" style="--i:{idx < 0 ? 0 : idx}"></div>
    {#each POS as p}
      <button class:on={$mode === p.m} on:click={() => ($mode = p.m)}>{p.l}</button>
    {/each}
  </div>
</div>

<style>
  .switch { display: flex; align-items: center; gap: 11px; }
  .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
  .track {
    position: relative; display: grid; grid-template-columns: repeat(3, 1fr);
    background: #FFFFFF; border: 1px solid var(--line); border-radius: 11px; padding: 4px;
    box-shadow: inset 0 2px 7px rgba(28,46,64,.14);
  }
  .knob {
    position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3);
    border-radius: 8px; background: linear-gradient(180deg, var(--neon-hot), var(--neon));
    box-shadow: 0 2px 5px rgba(28,46,64,.18), 0 0 14px rgba(130, 201, 252, 0.45);
    transform: translateX(calc(var(--i) * 100%));
    transition: transform 0.24s cubic-bezier(0.5, 1.6, 0.5, 1);
  }
  .track button {
    position: relative; z-index: 1; background: none; border: none;
    font-family: 'Archivo', sans-serif; font-weight: 700; text-transform: uppercase;
    font-size: 12px; letter-spacing: 0.02em; color: var(--muted); padding: 8px 12px; cursor: pointer;
    transition: color 0.2s;
  }
  .track button.on { color: var(--on-neon); }
  /* On phones the toggle owns its own row — stretch the segmented control full-width. */
  @media (max-width: 760px) {
    .switch { width: 100%; }
    .track { flex: 1; }
    .track button { padding: 9px 8px; }
  }
  @media (prefers-reduced-motion: reduce) { .knob { transition: none; } }
</style>
