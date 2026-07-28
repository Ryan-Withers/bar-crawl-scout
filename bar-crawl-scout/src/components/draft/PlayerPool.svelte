<script>
  // THE POOL — a focus dial, position buttons (FLX included), a needs filter,
  // search, and visible tier breaks so you can see the cliff coming. Star a
  // player to queue him; DRAFT takes him now.
  import { blendValue, tiersOf, slugify, filterPool, isRookie, FOCUS_ORDER, FOCUS_LABEL } from '../../lib/engine/mockdraft.ts';
  import { posColor, POS_TABS } from './theme.js';

  export let pool = [];
  export let userTurn = false;
  export let queue = [];
  export let windowPref = 50;      // your persona's win-now/future dial
  export let focus = 'balanced';   // which of the three is lit
  export let onFocus = null;       // null while spectating — nothing to focus
  export let flexPos = [];         // positions this league's flex seats accept
  export let needs = [];           // positions that would fill a starting hole
  export let onPick = () => {};
  export let onStar = () => {};
  export let onAutoPick = () => {};
  export let posFilter = 'ALL';
  export let onlyNeeds = false;
  export let rookiesOnly = false;
  export let q = '';

  let limit = 60;
  // Any re-filter starts the window again from the top.
  $: if (posFilter || q || onlyNeeds || rookiesOnly || windowPref != null) limit = 60;

  // FLX only exists if the league actually starts a flex seat.
  $: tabs = flexPos.length ? [...POS_TABS, 'FLX'] : POS_TABS;
  $: flexSet = new Set(flexPos);
  $: if (posFilter === 'FLX' && !flexPos.length) posFilter = 'ALL';
  $: if (onlyNeeds && !needs.length) onlyNeeds = false;

  const val = (p) => p.me;
  $: ranked = pool
    .map((p) => ({ ...p, me: Math.round(blendValue(p, windowPref)) }))
    .sort((a, b) => val(b) - val(a));
  $: needle = q.trim().toLowerCase();
  $: filtered = filterPool(ranked, { pos: posFilter, flex: flexPos, needs, onlyNeeds, rookiesOnly, q });
  $: tiers = tiersOf(filtered.map(val));
  $: shown = filtered.slice(0, limit);
  $: queued = new Set(queue);
  $: counts = pool.reduce((a, p) => { a[p.pos] = (a[p.pos] || 0) + 1; return a; }, {});
  $: flexCount = pool.reduce((n, p) => n + (flexSet.has(p.pos) ? 1 : 0), 0);
  $: tabCount = (t) => (t === 'FLX' ? flexCount : counts[t] || 0);
  // Rookies left on the board — counted against the position you're already
  // looking at, so the chip tells you what turning it on would actually show.
  $: rookieCount = filterPool(pool, { pos: posFilter, flex: flexPos, needs, onlyNeeds, rookiesOnly: true }).length;
</script>

<div class="pool" data-testid="pool">
  <div class="poolhd">
    <span class="hd">Player pool <b>{filtered.length}</b></span>
    {#if userTurn}
      <button class="auto" data-testid="autopick" on:click={onAutoPick}>🤖 autopick</button>
    {/if}
  </div>

  {#if onFocus}
    <div class="focus" role="group" aria-label="Draft focus" data-testid="focus">
      <span class="flbl">Focus</span>
      {#each FOCUS_ORDER as f}
        <button
          class="fbtn" class:on={focus === f}
          aria-pressed={focus === f}
          data-testid={'focus-' + f}
          on:click={() => onFocus(f)}
        >{FOCUS_LABEL[f]}</button>
      {/each}
    </div>
  {/if}

  <div class="tabs" role="group" aria-label="Position filter">
    {#each tabs as t}
      <button
        class="tab" class:on={posFilter === t}
        aria-pressed={posFilter === t}
        title={t === 'FLX' ? 'Anyone who can fill your flex seat: ' + flexPos.join(', ') : undefined}
        data-testid={'pos-' + t.toLowerCase()}
        on:click={() => (posFilter = t)}
      >{t}{#if t !== 'ALL'}<i>{tabCount(t)}</i>{/if}</button>
    {/each}
  </div>

  <div class="poolbar">
    <input class="search" placeholder="search name or team…" aria-label="Search players" bind:value={q} data-testid="pool-search" />
    {#if needs.length}
      <button
        class="mini needs" class:on={onlyNeeds}
        aria-pressed={onlyNeeds}
        title="Only players who'd fill a starting seat you haven't filled: {needs.join(', ')}"
        data-testid="only-needs"
        on:click={() => (onlyNeeds = !onlyNeeds)}
      >⚑ my needs<i>{needs.length}</i></button>
    {/if}
    <button
      class="mini rook" class:on={rookiesOnly}
      aria-pressed={rookiesOnly}
      title="First-year players only. They sit low on a win-now board by design — the board marks a rookie 0.70 on 2026 and 1.10 on 2027 — so pair this with FUTURE."
      data-testid="only-rookies"
      on:click={() => (rookiesOnly = !rookiesOnly)}
    >🌱 rookies<i>{rookieCount}</i></button>
    {#if posFilter !== 'ALL' || onlyNeeds || rookiesOnly || needle}
      <button class="mini clear" data-testid="clear-filters" on:click={() => { posFilter = 'ALL'; onlyNeeds = false; rookiesOnly = false; q = ''; }}>clear</button>
    {/if}
  </div>

  <div class="rows">
    {#each shown as p, i (p.name)}
      {#if i > 0 && tiers[i] !== tiers[i - 1]}
        <div class="tierbreak"><span>TIER {tiers[i]}</span><i>the drop-off</i></div>
      {/if}
      <div class="prow" class:starred={queued.has(p.name)} class:tight={userTurn}>
        <span class="pos" style="--pc:{posColor(p.pos)}">{p.pos}</span>
        <span class="pn">
          <span class="nmtxt">{p.name}</span>
          {#if isRookie(p)}<em class="rk" title="Rookie — priced down for 2026, up for 2027">R</em>{/if}
          <small>{p.team}{p.bye ? ' · bye ' + p.bye : ''}</small>
        </span>
        <span class="pv" title="value on your {FOCUS_LABEL[focus].toLowerCase()} board">{val(p)}</span>
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
      <p class="none">
        {#if rookiesOnly && posFilter !== 'ALL'}No {posFilter} rookies left on the board.
        {:else if rookiesOnly}Every rookie is gone.
        {:else if onlyNeeds && posFilter !== 'ALL'}No {posFilter} left who'd fill a starting seat — drop the needs filter or try another position.
        {:else if onlyNeeds}Every starting seat is filled. Turn off <b>my needs</b> to draft depth.
        {:else}Nobody left matching that. Clear the filters.{/if}
      </p>
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

  /* THE FOCUS DIAL — the one control you'll actually reach for mid-draft, so
     it sits above the positions and stays put all draft long. */
  .focus { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
  .flbl {
    font-family: var(--mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--muted); flex: none; margin-right: 2px;
  }
  .fbtn {
    flex: 1; font-family: var(--display); font-weight: 800; font-size: 10.5px; letter-spacing: .02em;
    text-transform: uppercase; background: #fff; border: 1px solid var(--line); color: var(--muted);
    border-radius: 7px; padding: 7px 4px; cursor: pointer; min-height: 36px;
  }
  .fbtn:hover { border-color: var(--blue); color: var(--blue-deep); }
  .fbtn.on { background: var(--blue-wash); border-color: var(--blue); color: var(--blue-deep); box-shadow: inset 0 0 0 1px var(--blue); }

  .tabs { display: flex; gap: 4px; margin-bottom: 8px; }
  .tab {
    flex: 1; min-width: 0; font-family: var(--mono); font-size: 11px; font-weight: 700; background: var(--field-3);
    border: 1px solid var(--line); color: var(--muted); border-radius: 7px; padding: 7px 2px; cursor: pointer; min-height: 36px;
  }
  .tab i { font-style: normal; display: block; font-size: 8px; font-weight: 400; opacity: .8; }
  .tab.on { background: var(--blue); border-color: var(--blue); color: #fff; }

  .poolbar { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
  .poolbar .search { flex: 1 1 150px; min-width: 0; }
  .mini { font-family: var(--mono); font-size: 10px; background: var(--field-3); border: 1px solid var(--line); color: var(--chalk); border-radius: 6px; padding: 4px 9px; cursor: pointer; min-height: 32px; }
  .mini.on { background: var(--blue); color: #fff; border-color: var(--blue); }
  .needs, .rook { display: inline-flex; align-items: center; gap: 5px; flex: none; }
  .needs i, .rook i { font-style: normal; font-size: 9px; background: var(--line); color: var(--chalk); border-radius: 8px; padding: 1px 5px; }
  .needs.on i, .rook.on i { background: rgba(255,255,255,.28); color: #fff; }
  .rook.on { background: var(--purp); border-color: var(--purp); color: #fff; }
  .clear { flex: none; color: var(--muted); }

  /* The rookie mark rides with the name, so you can spot one without filtering. */
  .rk {
    flex: none; font-style: normal; font-family: var(--display); font-weight: 800; font-size: 8.5px;
    color: #fff; background: var(--purp); border-radius: 3px; padding: 1px 3px; letter-spacing: .04em;
  }

  .rows { max-height: 52vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .prow { display: flex; align-items: center; gap: 8px; padding: 6px 2px; border-bottom: 1px dashed var(--line); font-family: var(--mono); font-size: 12.5px; }
  .prow.starred { background: var(--blue-wash); border-radius: 6px; }
  .pos { flex: none; width: 30px; text-align: center; font-size: 9px; font-weight: 700; color: #fff; background: var(--pc); border-radius: 4px; padding: 2px 0; }
  /* A flex row, not one ellipsised string: the name and the team can each give
     ground on a narrow screen, but the rookie mark never gets clipped off. */
  .pn { flex: 1; display: flex; align-items: baseline; gap: 5px; min-width: 0; overflow: hidden; color: var(--chalk); }
  .nmtxt, .pn small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Shrink factors, not equal shares: the team/bye tail collapses ~200x faster
     than the name, so a narrow row eats "MIN · bye 6" long before it eats a
     letter of "Jeremiyah Love". */
  .nmtxt { flex: 0 1 auto; }
  .pn small { flex: 0 200 auto; color: var(--muted); font-size: 10px; }
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

  /* On your turn every row grows a DRAFT button, and on a phone that leaves the
     team/bye tail showing as "T…" — no information, and it costs the name real
     letters. Drop it while the button is there; it's back the moment it isn't. */
  @media (max-width: 430px) {
    .prow.tight .pn small { display: none; }
  }

  @media (max-width: 860px) {
    .rows { max-height: none; }
    .prow { padding: 8px 2px; }
    .pickbtn { min-height: 42px; padding: 10px 14px; }
    .star { min-height: 42px; width: 40px; font-size: 18px; }
  }
</style>
