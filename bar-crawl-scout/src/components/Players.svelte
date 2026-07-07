<script>
  import { link } from 'svelte-spa-router';
  import { PLAYERS, RYAN, TEAMSHORT, TAGTXT } from '../lib/data.js';
  import { windowVal } from '../lib/models.js';
  import { keepers, mode, rosterOwn } from '../lib/store.js';

  $: ks = $keepers;
  $: md = $mode;
  $: own = $rosterOwn || {};

  const POS = ['ALL', 'RB', 'WR', 'TE', 'QB'];
  let posFilter = 'ALL';
  let freeOnly = true;
  let q = '';

  // Reference `own` directly in the reactive blocks so Svelte orders it first.
  $: rows = PLAYERS
    .map((p) => ({ name: p[1], pos: p[2], team: p[3], bye: p[4], adp: p[5], stage: p[6], val: windowVal(p, ks, md), owner: own[p[1].toLowerCase()] || null }))
    .filter((r) => posFilter === 'ALL' || r.pos === posFilter)
    .filter((r) => !freeOnly || !r.owner)
    .filter((r) => !q || r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.val - a.val)
    .slice(0, 120);

  $: freeCount = PLAYERS.filter((p) => !own[p[1].toLowerCase()]).length;
  $: isSynced = Object.keys(own).length > 0;
</script>

<section class="wire">
  <div class="eyebrow">The Wire · Players</div>
  <h1>The Wire</h1>
  <p class="blurb">Every player on the board, live-tagged with who owns them. Default view is the <b>free-agent pool</b> — the best players nobody's rostered, ranked by your window value. Tap any name for the full file, or send them to the <a href="/waivers" use:link>FAAB desk</a> for a bid read.
    {#if !isSynced}<br><span class="warn">Ownership isn't synced yet — everyone shows as free. Open in a real browser so rosters load.</span>{/if}
  </p>

  <div class="tools">
    <div class="chips">
      {#each POS as p}<button type="button" class="chip" class:on={posFilter === p} on:click={() => (posFilter = p)}>{p === 'ALL' ? 'All pos' : p}</button>{/each}
    </div>
    <button type="button" class="chip" class:on={freeOnly} on:click={() => (freeOnly = !freeOnly)}>Free agents only</button>
    <input class="search" placeholder="Search player…" bind:value={q} spellcheck="false" />
  </div>

  <div class="count">{rows.length} shown{#if freeOnly} · {freeCount} free agents on the board{/if}</div>

  <div class="list">
    {#each rows as r (r.name)}
      <div class="row" class:owned={r.owner}>
        <a class="nm" href={'/player/' + encodeURIComponent(r.name)} use:link>{r.name}</a>
        <span class="meta">{r.pos} · {r.team}{r.bye ? ' · bye ' + r.bye : ''}</span>
        <span class="val">{r.val}</span>
        <span class="status">
          {#if r.owner === RYAN}<span class="own you">YOURS</span>
          {:else if r.owner}<span class="own">{TEAMSHORT[r.owner] || r.owner}</span>
          {:else}<span class="free">FREE</span>{/if}
        </span>
        <a class="bid" href="/waivers" use:link>bid</a>
      </div>
    {:else}
      <div class="empty">No players match. {#if freeOnly}Everyone good is rostered — loosen the filters.{/if}</div>
    {/each}
  </div>
</section>

<style>
  .wire { max-width: 900px; padding-top: 6px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  h1 { font-family: 'Archivo Black', sans-serif; font-size: clamp(26px, 4vw, 40px); text-transform: uppercase; margin: 6px 0 4px; color: var(--chalk); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 14px; line-height: 1.6; max-width: 78ch; }
  .blurb a { color: var(--neon); }
  .blurb .warn { color: #f0c98a; }
  .tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 10px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { font-family: 'IBM Plex Mono', monospace; font-size: 11px; line-height: 1; border: 1px solid var(--line); background: var(--barroom-lift); color: var(--muted); border-radius: 20px; padding: 7px 13px; cursor: pointer; }
  .chip.on { background: var(--neon); color: var(--on-neon); border-color: var(--neon); }
  .search { flex: 1 1 200px; min-width: 160px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; background: #0b0e15; border: 1px solid var(--line); color: var(--chalk); border-radius: 8px; padding: 9px 11px; }
  .count { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); margin-bottom: 8px; }
  .list { display: flex; flex-direction: column; }
  .row { display: grid; grid-template-columns: minmax(120px, 1.4fr) 1.2fr auto 76px 44px; align-items: center; gap: 12px; padding: 9px 6px; border-bottom: 1px solid var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .row.owned { opacity: .62; }
  .nm { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 14px; color: var(--chalk); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm:hover { color: var(--neon-hot); }
  .meta { color: var(--muted); font-size: 11px; }
  .val { font-weight: 700; color: var(--neon); text-align: right; }
  .status { text-align: right; }
  .free { color: #7fcfa6; font-size: 9.5px; font-weight: 700; letter-spacing: .06em; }
  .own { color: var(--muted); font-size: 9.5px; }
  .own.you { color: var(--brass); font-weight: 700; }
  .bid { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--neon); text-decoration: none; border: 1px solid var(--line); border-radius: 5px; padding: 3px 8px; text-align: center; }
  .bid:hover { border-color: rgba(130,201,252,.5); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); padding: 20px 0; }
  @media (max-width: 620px) { .row { grid-template-columns: 1fr auto 56px 40px; } .meta { display: none; } }
</style>
