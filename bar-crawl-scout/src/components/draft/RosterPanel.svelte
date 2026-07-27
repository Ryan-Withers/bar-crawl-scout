<script>
  // MY TEAM — the starting lineup filling in live, the holes called out, the
  // bench underneath. Keepers are flagged so you never count them twice.
  import { fillSlots, unfilledStarters } from '../../lib/engine/mockdraft.ts';
  import { posColor } from './theme.js';

  export let roster = [];
  export let slots = [];
  export let rosterSize = 0;
  export let keeperCount = 0;
  export let title = 'My team';

  $: lineup = fillSlots(roster, slots);
  $: holes = unfilledStarters(roster, slots);
  $: keeperNames = new Set(roster.slice(0, keeperCount).map((p) => p.name));
</script>

<div class="roster" data-testid="roster">
  <div class="rhd">
    <span class="hd">{title}</span>
    <span class="count">{roster.length}/{rosterSize}</span>
  </div>

  <div class="slots">
    {#each lineup.starters as s}
      <div class="slot" class:filled={!!s.player}>
        <span class="lbl">{s.slot}</span>
        {#if s.player}
          <span class="pos" style="--pc:{posColor(s.player.pos)}">{s.player.pos}</span>
          <span class="nm">{s.player.name}</span>
          {#if keeperNames.has(s.player.name)}<em class="ktag">K</em>{/if}
        {:else}
          <span class="open">— open —</span>
        {/if}
      </div>
    {/each}
  </div>

  {#if holes.length}
    <div class="need" data-testid="needs">Still need: <b>{holes.join(', ')}</b></div>
  {:else}
    <div class="need ok" data-testid="needs">✓ Every starting slot filled</div>
  {/if}

  {#if lineup.bench.length}
    <div class="benchhd">Bench <i>{lineup.bench.length}</i></div>
    <div class="bench">
      {#each lineup.bench as p}
        <div class="brow">
          <span class="pos sm" style="--pc:{posColor(p.pos)}">{p.pos}</span>
          <span class="nm">{p.name}</span>
          {#if keeperNames.has(p.name)}<em class="ktag">K</em>{/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .roster { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
  .rhd { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  .hd { font-family: var(--display); font-weight: 800; font-size: 12px; text-transform: uppercase; color: var(--chalk); }
  .count { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--muted); }

  .slots { display: flex; flex-direction: column; gap: 3px; }
  .slot { display: flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 12px; color: var(--chalk); background: var(--field); border: 1px solid var(--line); border-radius: 7px; padding: 5px 8px; }
  .slot.filled { background: var(--field-2); }
  .lbl { flex: none; width: 42px; font-size: 8.5px; font-weight: 700; letter-spacing: .08em; color: var(--muted); text-transform: uppercase; }
  .pos { flex: none; width: 28px; text-align: center; font-size: 8.5px; font-weight: 700; color: #fff; background: var(--pc); border-radius: 4px; padding: 2px 0; }
  .pos.sm { width: 26px; font-size: 8px; }
  .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .open { flex: 1; color: var(--muted); opacity: .7; font-size: 10.5px; }
  .ktag { font-style: normal; font-size: 8px; color: #fff; background: var(--brass); border-radius: 3px; padding: 1px 5px; }

  .need { margin-top: 9px; font-family: var(--mono); font-size: 10.5px; color: var(--stamp-red); }
  .need b { color: var(--stamp-red); }
  .need.ok { color: var(--good); }
  .benchhd { margin-top: 10px; font-family: var(--mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .benchhd i { font-style: normal; }
  .bench { margin-top: 4px; }
  .brow { display: flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 11.5px; color: var(--chalk); padding: 3px 0; }
</style>
