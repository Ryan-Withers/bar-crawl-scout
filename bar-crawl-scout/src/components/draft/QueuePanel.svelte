<script>
  // MY QUEUE — the list the room drafts from when you're not looking. Star from
  // the pool, re-order here; autopick and an expired clock both take the top man
  // still on the board.
  import { slugify } from '../../lib/engine/mockdraft.ts';
  import { posColor } from './theme.js';

  export let queue = [];           // names, your order
  export let pool = [];            // what's still available
  export let userTurn = false;
  export let onMove = () => {};
  export let onRemove = () => {};
  export let onPick = () => {};
  export let onTidy = () => {};

  $: byName = new Map(pool.map((p) => [p.name, p]));
  $: rows = queue.map((n) => ({ name: n, p: byName.get(n) || null }));
  $: goneCount = rows.filter((r) => !r.p).length;
</script>

<div class="queue" data-testid="queue">
  <div class="qhd">
    <span class="hd">My queue <b>{rows.length}</b></span>
    {#if goneCount}<button class="mini" data-testid="queue-tidy" on:click={onTidy}>clear {goneCount} drafted</button>{/if}
  </div>

  {#if !rows.length}
    <p class="empty">Star players in the pool (☆) and they stack up here. If the clock beats you, the room takes the top one still available.</p>
  {:else}
    <ol class="qlist">
      {#each rows as r, i (r.name)}
        <li class="qrow" class:gone={!r.p} data-testid={'queued-' + slugify(r.name)}>
          <span class="qn">{i + 1}</span>
          {#if r.p}<span class="pos" style="--pc:{posColor(r.p.pos)}">{r.p.pos}</span>{:else}<span class="pos out">—</span>{/if}
          <span class="nm">{r.name}{#if !r.p}<small> drafted</small>{/if}</span>
          <span class="acts">
            <button class="mini" aria-label={'Move ' + r.name + ' up'} disabled={i === 0} on:click={() => onMove(i, -1)}>↑</button>
            <button class="mini" aria-label={'Move ' + r.name + ' down'} disabled={i === rows.length - 1} on:click={() => onMove(i, 1)}>↓</button>
            <button class="mini x" aria-label={'Remove ' + r.name} on:click={() => onRemove(r.name)}>✕</button>
            {#if userTurn && r.p}
              <button class="qpick" data-testid={'qpick-' + slugify(r.name)} on:click={() => onPick(r.name)}>DRAFT</button>
            {/if}
          </span>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .queue { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
  .qhd { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .hd { font-family: var(--display); font-weight: 800; font-size: 12px; text-transform: uppercase; color: var(--chalk); }
  .hd b { color: var(--muted); font-weight: 700; font-family: var(--mono); font-size: 10px; }
  .qhd .mini { margin-left: auto; }
  .empty { font-family: var(--mono); font-size: 10.5px; color: var(--muted); line-height: 1.6; margin: 0; }

  .qlist { list-style: none; margin: 0; padding: 0; max-height: 34vh; overflow-y: auto; }
  .qrow { display: flex; align-items: center; gap: 7px; padding: 5px 2px; border-bottom: 1px dashed var(--line); font-family: var(--mono); font-size: 12px; color: var(--chalk); }
  .qrow.gone { opacity: .45; }
  .qrow.gone .nm { text-decoration: line-through; }
  .qn { width: 16px; color: var(--muted); font-weight: 700; text-align: right; }
  .pos { flex: none; width: 28px; text-align: center; font-size: 8.5px; font-weight: 700; color: #fff; background: var(--pc); border-radius: 4px; padding: 2px 0; }
  .pos.out { background: var(--field-3); color: var(--muted); }
  .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nm small { color: var(--muted); font-size: 9px; }
  .acts { display: flex; gap: 3px; align-items: center; }
  .mini { font-family: var(--mono); font-size: 10px; background: var(--field-3); border: 1px solid var(--line); color: var(--chalk); border-radius: 6px; padding: 3px 7px; cursor: pointer; min-height: 30px; }
  .mini:disabled { opacity: .3; cursor: default; }
  .mini.x { color: var(--muted); }
  .qpick { font-family: var(--display); font-weight: 800; font-size: 9.5px; background: var(--blue); color: #fff; border: none; border-radius: 6px; padding: 6px 9px; cursor: pointer; min-height: 32px; }

  @media (max-width: 860px) {
    .qlist { max-height: none; }
    .mini { min-height: 38px; padding: 5px 9px; }
    .qpick { min-height: 38px; padding: 8px 11px; }
  }
</style>
