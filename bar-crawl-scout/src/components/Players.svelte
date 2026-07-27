<script>
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { PLAYERS, RYAN, TEAMSHORT } from '../lib/data.js';
  import { windowVal } from '../lib/models.js';
  import { keepers, mode, rosterOwn } from '../lib/store.js';
  import { buildWireRows } from '../lib/engine/wire.ts';
  import { buildTicker } from '../lib/engine/ticker.ts';
  import { playersQuery, trendingAddsQuery, usersQuery, rostersQuery, seasonTransactionsQuery } from '../api/queries';
  import { userHandleMap } from '../api/league';
  import { rosterHandleMap } from '../api/history';

  const playersQ = createQuery(playersQuery());
  const trendingQ = createQuery(trendingAddsQuery());
  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const txnsQ = createQuery(seasonTransactionsQuery());

  $: ks = $keepers;
  $: md = $mode;
  $: own = $rosterOwn || {};

  const POS = ['ALL', 'RB', 'WR', 'TE', 'QB', 'K', 'DEF'];
  const FANTASY = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST'];
  let posFilter = 'ALL';
  let freeOnly = true;
  let trendingOnly = false;
  let q = '';

  // Board value lookup by lowercase name (top-200 only have a value).
  $: valByName = Object.fromEntries(PLAYERS.map((p) => [p[1].toLowerCase(), { val: windowVal(p, ks, md), bye: p[4], adp: p[5] }]));

  // The universe: EVERY live NFL player if the blob is loaded, else the top-200.
  $: byId = $playersQ.data || null;
  $: allPlayers = byId
    ? (() => { const seen = new Set(); const arr = [];
        for (const pid in byId) { const [name, pos] = byId[pid]; const team = byId[pid][2];
          if (!name || !FANTASY.includes(pos)) continue;
          const key = name.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
          arr.push({ name, pos: pos === 'DST' ? 'DEF' : pos, team: team || 'FA' }); }
        return arr; })()
    : PLAYERS.map((p) => ({ name: p[1], pos: p[2], team: p[3] }));

  // Trending adds keyed by name (needs the id->name blob).
  $: trend = (byId && Array.isArray($trendingQ.data))
    ? Object.fromEntries($trendingQ.data.map((t) => { const info = byId[t.player_id]; return info ? [info[0].toLowerCase(), t.count] : null; }).filter(Boolean))
    : {};

  $: rows = buildWireRows(allPlayers, { valByName, own, trend, ryan: RYAN, pos: posFilter, freeOnly, trendingOnly, q, limit: 150 });
  $: freeCount = allPlayers.filter((p) => !own[p.name.toLowerCase()]).length;
  $: isSynced = Object.keys(own).length > 0;
  $: fullUniverse = !!byId;
  const fmtTrend = (n) => (n >= 1000 ? (n / 1000).toFixed(0) + 'k' : '' + n);

  // THE TICKER — the league's move feed, newest first. Names need the id blob.
  $: rh = ($rostersQ.data && $usersQ.data) ? rosterHandleMap($rostersQ.data, userHandleMap($usersQ.data)) : {};
  $: ticker = (byId && $txnsQ.data && Object.keys(rh).length)
    ? buildTicker($txnsQ.data, rh, (pid) => (byId[pid] ? byId[pid][0] : pid), 30)
    : [];
  const tnm = (h) => TEAMSHORT[h] || h;
  const TYPE = { waiver: 'WAIVER', free_agent: 'FREE AGENT', trade: 'TRADE' };
  let tickerOpen = true;
</script>

<section class="wire">
  <p class="blurb"><b>{fullUniverse ? 'Every NFL player' : 'The top-200 board'}</b> ranked by your window value. Tap a name for the full file, or send them to the <a href="/waivers" use:link>FAAB desk</a> for a bid read.
    {#if !fullUniverse}<br><span class="warn">Showing the top-200 for now — open in a real browser and the full free-agent universe + trending adds load from Sleeper.</span>{:else if !isSynced}<br><span class="warn">Ownership isn't synced yet — everyone shows as free. Tap Sync so rosters load.</span>{/if}
  </p>

  <div class="tools">
    <div class="chips">
      {#each POS as p}<button type="button" class="chip" class:on={posFilter === p} on:click={() => (posFilter = p)}>{p === 'ALL' ? 'All pos' : p}</button>{/each}
    </div>
    <button type="button" class="chip" class:on={freeOnly} on:click={() => (freeOnly = !freeOnly)}>Free agents only</button>
    <button type="button" class="chip" class:on={trendingOnly} on:click={() => (trendingOnly = !trendingOnly)}>🔥 Trending</button>
    <input class="search" placeholder="Search {fullUniverse ? 'any player' : 'player'}…" bind:value={q} spellcheck="false" />
  </div>

  <div class="count">{rows.length} shown{#if freeOnly} · {freeCount} free agents{/if}</div>

  <div class="list">
    {#each rows as r (r.name)}
      <div class="row" class:owned={r.owner}>
        <a class="nm" href={'/player/' + encodeURIComponent(r.name)} use:link>{r.name}</a>
        <span class="meta">{r.pos} · {r.team}{r.bye ? ' · bye ' + r.bye : ''}</span>
        {#if r.trend}<span class="fire" title="{r.trend} adds across Sleeper">🔥 {fmtTrend(r.trend)}</span>{:else}<span class="fire"></span>{/if}
        <span class="val">{r.val ?? '—'}</span>
        <span class="status">
          {#if r.owner === RYAN}<span class="own you">YOURS</span>
          {:else if r.owner}<span class="own">{TEAMSHORT[r.owner] || r.owner}</span>
          {:else}<span class="free">FREE</span>{/if}
        </span>
        <a class="bid" href="/waivers" use:link>bid</a>
      </div>
    {:else}
      <div class="empty">No players match. {#if freeOnly || trendingOnly}Loosen the filters.{/if}</div>
    {/each}
  </div>

  {#if ticker.length}
    <div class="ticker">
      <button class="tickhd" on:click={() => (tickerOpen = !tickerOpen)}>
        <span class="teye">The Ticker</span>
        <span class="tsub">league moves, newest first · {ticker.length}</span>
        <span class="tcaret">{tickerOpen ? '▾' : '▸'}</span>
      </button>
      {#if tickerOpen}
        <div class="feed">
          {#each ticker as t (t.created + '-' + t.week + '-' + (t.adds[0]?.player || t.drops[0]?.player || ''))}
            <div class="move">
              <span class="mtype {t.type}">{TYPE[t.type] || t.type}{#if t.bid != null} · ${t.bid}{/if}</span>
              <span class="mwk">wk {t.week}</span>
              <div class="mbody">
                {#each t.adds as a}<span class="madd">＋ {a.player} <em>{tnm(a.handle)}</em></span>{/each}
                {#each t.drops as d}<span class="mdrop">－ {d.player} <em>{tnm(d.handle)}</em></span>{/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .wire { padding-top: 2px; }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 14px; line-height: 1.6; max-width: 78ch; }
  .blurb a { color: var(--neon); }
  .blurb .warn { color: #f0c98a; }
  .tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 10px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { font-family: 'IBM Plex Mono', monospace; font-size: 11px; line-height: 1; border: 1px solid var(--line); background: var(--barroom-lift); color: var(--muted); border-radius: 20px; padding: 7px 13px; cursor: pointer; }
  .chip.on { background: var(--neon); color: var(--on-neon); border-color: var(--neon); }
  .search { flex: 1 1 200px; min-width: 160px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; background: #FFFFFF; border: 1px solid var(--line); color: var(--chalk); border-radius: 8px; padding: 9px 11px; }
  .count { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); margin-bottom: 8px; }

  /* THE TICKER — a collapsible league move feed. */
  .ticker { margin-top: 22px; border-top: 1px solid var(--line); }
  .tickhd { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; padding: 14px 0 10px; cursor: pointer; text-align: left; }
  .teye { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); }
  .tsub { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); }
  .tcaret { margin-left: auto; color: var(--muted); }
  .feed { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 6px; align-items: start; }
  .move { display: grid; grid-template-columns: auto auto 1fr; align-items: baseline; gap: 10px; padding: 8px 10px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 8px; }
  .mtype { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; font-weight: 700; letter-spacing: .06em; padding: 2px 6px; border-radius: 4px; white-space: nowrap; color: var(--muted); border: 1px solid var(--line); }
  .mtype.waiver { color: var(--brass); border-color: rgba(176,132,40,.35); }
  .mtype.trade { color: var(--neon); border-color: rgba(47,127,184,.4); }
  .mwk { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: var(--muted); white-space: nowrap; }
  .mbody { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
  .madd { color: var(--chalk); } .mdrop { color: var(--muted); }
  .madd em, .mdrop em { font-style: normal; color: var(--neon); font-size: 10px; }
  /* Wide screens show MORE players, not a stretched column. */
  .list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); column-gap: 26px; }
  .row { min-width: 0; display: grid; grid-template-columns: minmax(110px, 1.4fr) 1.1fr 52px 48px 76px 44px; align-items: center; gap: 12px; padding: 9px 6px; border-bottom: 1px solid var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .fire { font-size: 10px; color: #f0913f; text-align: right; white-space: nowrap; }
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
  @media (max-width: 620px) { .row { grid-template-columns: 1fr 40px 52px 40px; } .meta, .fire { display: none; } }
</style>
