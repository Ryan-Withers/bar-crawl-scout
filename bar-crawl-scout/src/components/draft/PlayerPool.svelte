<script>
  // THE POOL — position tabs, search, two sorts, and visible tier breaks so you
  // can see the cliff coming. Star a player to queue him; DRAFT takes him now.
  import { blendValue, tiersOf, slugify } from '../../lib/engine/mockdraft.ts';
  import { posColor, POS_TABS } from './theme.js';

  export let pool = [];
  export let userTurn = false;
  export let queue = [];
  export let windowPref = 50;      // your persona's win-now/future dial
  export let onPick = () => {};
  export let onStar = () => {};
  export let onAutoPick = () => {};
  export let sortBy = 'me';        // 'me' = your board | 'balanced'
  export let posFilter = 'ALL';
  export let q = '';

  let limit = 60;
  $: if (posFilter || q || sortBy) limit = 60;   // any re-filter resets the window

  const val = (p) => (sortBy === 'me' ? p.me : p.v.balanced);
  $: ranked = pool
    .map((p) => ({ ...p, me: Math.round(blendValue(p, windowPref)) }))
    .sort((a, b) => val(b) - val(a));
  $: needle = q.trim().toLowerCase();
  $: filtered = ranked.filter((p) =>
    (posFilter === 'ALL' || p.pos === posFilter)
    && (!needle || p.name.toLowerCase().includes(needle) || p.team.toLowerCase() === needle || p.pos.toLowerCase() === needle));
  $: tiers = tiersOf(filtered.map(val));
  $: shown = filtered.slice(0, limit);
  $: queued = new Set(queue);
  $: counts = pool.reduce((a, p) => { a[p.pos] = (a[p.pos] || 0) + 1; return a; }, {});
</script>

<div class="pool" data-testid="pool">
  <div class="poolhd">
    <span class="hd">Player pool <b>{filtered.length}</b></span>
    {#if userTurn}
      <button class="auto" data-testid="autopick" on:click={onAutoPick}>🤖 autopick</button>
    {/if}
  </div>

  <div class="tabs" role="group" aria-label="Position filter">
    {#each POS_TABS as t}
      <button
        class="tab" class:on={posFilter === t}
        data-testid={'pos-' + t.toLowerCase()}
        on:click={() => (posFilter = t)}
      >{t}{#if t !== 'ALL'}<i>{counts[t] || 0}</i>{/if}</button>
    {/each}
  </div>

  <div class="poolbar">
    <input class="search" placeholder="search name, team or pos…" aria-label="Search players" bind:value={q} data-testid="pool-search" />
    <span class="sorts">
      <button class="mini" class:on={sortBy === 'me'} on:click={() => (sortBy = 'me')} data-testid="sort-me">my board</button>
      <button class="mini" class:on={sortBy === 'balanced'} on:click={() => (sortBy = 'balanced')} data-testid="sort-balanced">balanced</button>
    </span>
  </div>

  <div class="rows">
    {#each shown as p, i (p.name)}
      {#if i > 0 && tiers[i] !== tiers[i - 1]}
        <div class="tierbreak"><span>TIER {tiers[i]}</span><i>the drop-off</i></div>
      {/if}
      <div class="prow" class:starred={queued.has(p.name)}>
        <span class="pos" style="--pc:{posColor(p.pos)}">{p.pos}</span>
        <span class="pn">
          {p.name}
          <small>{p.team}{p.bye ? ' · bye ' + p.bye : ''}</small>
        </span>
        <span class="pv" title="{sortBy === 'me' ? 'your board' : 'balanced board'} value">{val(p)}</span>
        <button
          class="star" class:on={queued.has(p.name)}
          aria-pressed={queued.has(p.name)}
          aria-label={(queued.has(p.name) ? 'Remove from queue: ' : 'Add to queue: ') + p.name}
          data-testid={'star-' + slugify(p.name)}
          on:click={() => onStar(p.name)}
        >{queued.has(p.name) ? '★' : '☆'}</button>
        {#if userTurn}
          <button class="pickbtn" data-testid={'pick-' + slugify(p.name)} on:click={() => onPick(p.name)}>DRAFT</button>
        {/if}
      </div>
    {:else}
      <p class="none">Nobody left matching that. Clear the search.</p>
    {/each}
    {#if filtered.length > shown.length}
      <button class="more" on:click={() => (limit += 60)}>show {Math.min(60, filtered.length - shown.length)} more · {filtered.length - shown.length} left</button>
    {/if}
  </div>
</div>

<style>
  .pool { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; min-width: 0; }
  .poolhd { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .hd { font-family: var(--display); font-weight: 800; font-size: 12px; text-transform: uppercase; color: var(--chalk); }
  .hd b { color: var(--muted); font-weight: 700; font-family: var(--mono); font-size: 10px; }
  .auto { margin-left: auto; font-family: var(--mono); font-size: 10.5px; background: var(--field-3); border: 1px solid var(--line); color: var(--chalk); border-radius: 7px; padding: 6px 10px; cursor: pointer; min-height: 34px; }
  .auto:hover { border-color: var(--blue); color: var(--blue-deep); }

  .tabs { display: flex; gap: 4px; margin-bottom: 8px; }
  .tab {
    flex: 1; font-family: var(--mono); font-size: 11px; font-weight: 700; background: var(--field-3);
    border: 1px solid var(--line); color: var(--muted); border-radius: 7px; padding: 7px 4px; cursor: pointer; min-height: 36px;
  }
  .tab i { font-style: normal; display: block; font-size: 8px; font-weight: 400; opacity: .8; }
  .tab.on { background: var(--blue); border-color: var(--blue); color: #fff; }

  .poolbar { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
  .poolbar .search { flex: 1 1 150px; min-width: 0; }
  .sorts { display: flex; gap: 4px; }
  .mini { font-family: var(--mono); font-size: 10px; background: var(--field-3); border: 1px solid var(--line); color: var(--chalk); border-radius: 6px; padding: 4px 9px; cursor: pointer; min-height: 32px; }
  .mini.on { background: var(--blue); color: #fff; border-color: var(--blue); }

  .rows { max-height: 52vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .prow { display: flex; align-items: center; gap: 8px; padding: 6px 2px; border-bottom: 1px dashed var(--line); font-family: var(--mono); font-size: 12.5px; }
  .prow.starred { background: var(--blue-wash); border-radius: 6px; }
  .pos { flex: none; width: 30px; text-align: center; font-size: 9px; font-weight: 700; color: #fff; background: var(--pc); border-radius: 4px; padding: 2px 0; }
  .pn { flex: 1; color: var(--chalk); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pn small { color: var(--muted); font-size: 10px; }
  .pv { font-weight: 700; color: var(--blue-deep); font-variant-numeric: tabular-nums; }
  .star { flex: none; background: none; border: 1px solid transparent; color: var(--muted); font-size: 16px; line-height: 1; cursor: pointer; border-radius: 6px; width: 34px; min-height: 34px; }
  .star.on { color: var(--brass); }
  .star:hover { border-color: var(--line); color: var(--brass); }
  .pickbtn { flex: none; font-family: var(--display); font-weight: 800; font-size: 10px; background: var(--blue); color: #fff; border: none; border-radius: 7px; padding: 8px 12px; cursor: pointer; min-height: 36px; letter-spacing: .04em; }
  .pickbtn:hover { background: var(--blue-deep); }

  .tierbreak { display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; font-family: var(--mono); font-size: 9px; letter-spacing: .12em; color: var(--stamp-red); }
  .tierbreak span { font-weight: 700; }
  .tierbreak i { font-style: normal; color: var(--muted); letter-spacing: .04em; }
  .tierbreak::after { content: ''; flex: 1; height: 0; border-top: 2px dashed var(--line); }
  .none { font-family: var(--mono); font-size: 11.5px; color: var(--muted); padding: 12px 2px; }
  .more { width: 100%; margin-top: 8px; font-family: var(--mono); font-size: 10.5px; background: var(--field-3); border: 1px solid var(--line); color: var(--chalk); border-radius: 7px; padding: 8px; cursor: pointer; min-height: 36px; }

  @media (max-width: 860px) {
    .rows { max-height: none; }
    .prow { padding: 8px 2px; }
    .pickbtn { min-height: 42px; padding: 10px 14px; }
    .star { min-height: 42px; width: 40px; font-size: 18px; }
  }
</style>
