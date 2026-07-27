<script>
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMS, TEAMSHORT, MGRS, RYAN } from '../lib/data.js';
  import { rankStandings } from '../lib/engine/standings.ts';
  import { allPlayTable, luckBoard } from '../lib/engine/allplay.ts';
  import { recordBook } from '../lib/engine/recordbook.ts';
  import { usersQuery, rostersQuery, seasonMatchupsQuery } from '../api/queries';
  import { userHandleMap, recordsFromRosters } from '../api/league';
  import { rosterHandleMap } from '../api/history';

  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const seasonQ = createQuery(seasonMatchupsQuery());

  // Static fallback parsed from the seeded MGRS blob (used until live records load).
  const mgrByHandle = Object.fromEntries(MGRS.map((m) => [m.h, m]));
  const parseRec = (s) => { const [w, l, t] = String(s || '0-0-0').split('-').map((n) => +n || 0); return { wins: w, losses: l, ties: t || 0 }; };
  const parsePF = (s) => +String(s || '0').replace(/[^0-9.]/g, '') || 0;

  $: liveRecords = ($rostersQ.data && $usersQ.data) ? recordsFromRosters($rostersQ.data, userHandleMap($usersQ.data)) : {};
  $: live = Object.keys(liveRecords).length > 0;

  $: rows = TEAMS.map(([h, team]) => {
    const r = liveRecords[h];
    if (r) return { handle: h, team, wins: r.wins, losses: r.losses, ties: r.ties, pf: r.pf, pa: r.pa };
    const m = mgrByHandle[h];
    const rec = parseRec(m && m.rec);
    return { handle: h, team, wins: rec.wins, losses: rec.losses, ties: rec.ties, pf: parsePF(m && m.pf), pa: 0 };
  });
  $: table = rankStandings(rows);
  $: fmtPct = (p) => p.toFixed(3).replace(/^0/, '');
  $: fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n));

  // The Luck Index: all-play expected wins vs actual, luckiest first. Reuses the
  // season-matchups query (whole-season weekly scores) + the handle map.
  $: rh = ($rostersQ.data && $usersQ.data) ? rosterHandleMap($rostersQ.data, userHandleMap($usersQ.data)) : {};
  $: actualWins = Object.fromEntries(Object.entries(liveRecords).map(([h, r]) => [h, r.wins]));
  $: luck = ($seasonQ.data && Object.keys(rh).length)
    ? luckBoard(allPlayTable($seasonQ.data, rh), actualWins).filter((r) => r.weeks > 0)
    : [];
  const fmtLuck = (n) => (n > 0 ? '+' : '') + n.toFixed(1);

  // The season record book, off the same weekly scores.
  $: book = ($seasonQ.data && Object.keys(rh).length) ? recordBook($seasonQ.data, rh) : null;
  $: hasBook = book && book.topWeek;
  const nm = (h) => TEAMSHORT[h] || h;
</script>

<section class="table-page">
  <p class="blurb">Sorted by record; points-for breaks ties.
    {#if live}<span class="livedot">● live from Sleeper</span>{:else}Seeded from last season — tap <a href="/sync" use:link>Sync</a> in a browser for live.{/if}
  </p>

  <div class="boards">
  <div class="col">
  <div class="ledger">
    <div class="lrow head">
      <span class="rk">#</span><span class="tm">Team</span><span class="c">W-L</span>
      <span class="c">PCT</span><span class="c">PF</span><span class="c">PA</span><span class="c">DIFF</span><span class="c gb">GB</span>
    </div>
    {#each table as r (r.handle)}
      <div class="lrow" class:leader={r.rank === 1} class:you={r.handle === RYAN}>
        <span class="rk">{r.rank}</span>
        <span class="tm">
          <a href={'/managers/' + r.handle} use:link>{TEAMSHORT[r.handle] || r.team}</a>
          {#if r.handle === RYAN}<span class="lock" title="Commissioner — dossier sealed">🔒</span>{/if}
          <span class="hnd">@{r.handle}</span>
        </span>
        <span class="c wl">{r.wins}-{r.losses}{r.ties ? '-' + r.ties : ''}</span>
        <span class="c">{fmtPct(r.pct)}</span>
        <span class="c">{fmtK(r.pf)}</span>
        <span class="c">{r.pa ? fmtK(r.pa) : '—'}</span>
        <span class="c diff" class:pos={r.diff > 0} class:neg={r.diff < 0}>{r.pa ? (r.diff > 0 ? '+' : '') + fmtK(r.diff) : '—'}</span>
        <span class="c gb">{r.gb === 0 ? '—' : r.gb}</span>
      </div>
    {/each}
  </div>

  {#if hasBook}
    <div class="luck-hd"><span class="eyebrow">The Record Book</span>
      <p class="blurb">This season's extremes, straight off the scoreboard.</p>
    </div>
    <div class="recbook">
      <div class="rec"><span class="ricon">💥</span><b>{book.topWeek.pts}</b><span class="rlbl">Highest week</span><span class="rwho">{nm(book.topWeek.handle)} · wk {book.topWeek.week}</span></div>
      <div class="rec"><span class="ricon">💤</span><b>{book.lowWeek.pts}</b><span class="rlbl">Lowest week</span><span class="rwho">{nm(book.lowWeek.handle)} · wk {book.lowWeek.week}</span></div>
      {#if book.blowout}<div class="rec"><span class="ricon">🩸</span><b>{book.blowout.margin}</b><span class="rlbl">Biggest blowout</span><span class="rwho">{nm(book.blowout.winner)} def {nm(book.blowout.loser)} · wk {book.blowout.week}</span></div>{/if}
      {#if book.nailbiter}<div class="rec"><span class="ricon">😰</span><b>{book.nailbiter.margin}</b><span class="rlbl">Closest game</span><span class="rwho">{nm(book.nailbiter.winner)} def {nm(book.nailbiter.loser)} · wk {book.nailbiter.week}</span></div>{/if}
      {#if book.shootout}<div class="rec"><span class="ricon">🔥</span><b>{book.shootout.combined}</b><span class="rlbl">Shootout</span><span class="rwho">{nm(book.shootout.a)} v {nm(book.shootout.b)} · wk {book.shootout.week}</span></div>{/if}
    </div>
  {/if}
  </div>

  <div class="col">
  {#if luck.length}
    <div class="luck-hd">
      <span class="eyebrow">The Luck Index</span>
      <p class="blurb">All-play expected wins — how you'd fare against the whole field each week, not just your one opponent. Above the line, the schedule's been kind; below it, robbed.</p>
    </div>
    <div class="ledger luck">
      <div class="lrow lhead head">
        <span class="rk">#</span><span class="tm">Team</span>
        <span class="c">W-L</span><span class="c">xW</span><span class="c ap">ALL-PLAY</span><span class="c">LUCK</span>
      </div>
      {#each luck as r (r.handle)}
        <div class="lrow lrow-luck" class:you={r.handle === RYAN}>
          <span class="rk">{r.luck > 0 ? '😎' : r.luck < 0 ? '😤' : '😐'}</span>
          <span class="tm">
            <a href={'/managers/' + r.handle} use:link>{TEAMSHORT[r.handle] || r.handle}</a>
          </span>
          <span class="c wl">{r.actualWins}-{Math.max(0, r.weeks - r.actualWins)}</span>
          <span class="c">{r.expWins.toFixed(1)}</span>
          <span class="c ap">{r.allWins}-{r.allLosses}{r.allTies ? '-' + r.allTies : ''}</span>
          <span class="c luckchip" class:pos={r.luck > 0} class:neg={r.luck < 0}>{fmtLuck(r.luck)}</span>
        </div>
      {/each}
    </div>
  {/if}
  </div>
  </div>
</section>

<style>
  .table-page { padding-top: 2px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 14px; line-height: 1.6; max-width: 74ch; }
  .blurb a { color: var(--neon); }
  .livedot { color: #4fb286; margin-left: 4px; }

  .ledger { background: var(--paper); color: var(--ink); border-radius: 6px; padding: 8px 10px; box-shadow: 0 12px 26px rgba(0,0,0,.4); background-image: repeating-linear-gradient(rgba(28,26,22,.035) 0 1px, transparent 1px 34px); }
  .lrow { display: grid; grid-template-columns: 30px minmax(150px, 1fr) 62px 52px 56px 56px 60px 44px; align-items: center; gap: 8px; padding: 9px 8px; border-bottom: 1px dashed rgba(28,26,22,.18); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .lrow:last-child { border-bottom: none; }
  .lrow.head { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); border-bottom: 1.5px solid rgba(28,26,22,.4); }
  .lrow.leader { background: rgba(201,164,92,.14); border-radius: 4px; }
  .lrow.you { background: rgba(130,201,252,.1); border-radius: 4px; }
  .rk { font-weight: 700; color: var(--ink-soft); text-align: center; }
  .lrow.leader .rk { color: #a9791f; }
  .tm { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .tm a { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 14px; color: var(--ink); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tm a:hover { color: #2f7fb8; }
  .hnd { font-size: 9.5px; color: var(--ink-soft); white-space: nowrap; }
  .lock { font-size: 11px; }
  .c { text-align: right; color: #2a271f; }
  .wl { font-weight: 700; }
  .diff.pos { color: #2e7d46; } .diff.neg { color: #b5442f; }
  .gb { color: var(--ink-soft); }
  /* The Record Book — a compact tile strip of season extremes. */
  .recbook { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .rec { background: var(--paper); color: var(--ink); border-radius: 6px; padding: 12px 10px; box-shadow: 0 8px 20px rgba(0,0,0,.3); display: flex; flex-direction: column; gap: 2px; }
  .rec .ricon { font-size: 16px; }
  .rec b { font-family: 'Archivo Black', sans-serif; font-size: 24px; color: var(--ink); line-height: 1.05; }
  .rec .rlbl { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); margin-top: 2px; }
  .rec .rwho { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: #2a271f; }

  /* The Luck Index — same paper ledger, its own column rhythm. */
  .luck-hd { margin: 26px 0 10px; }
  .luck-hd .blurb { margin: 8px 0 0; }
  .ledger.luck { margin-top: 0; }
  .ledger.luck .lrow { grid-template-columns: 30px minmax(120px, 1fr) 58px 46px 72px 56px; }
  .ap { color: var(--ink-soft); }
  .luckchip { font-weight: 700; color: var(--ink-soft); }
  .luckchip.pos { color: #2e7d46; } .luckchip.neg { color: #b5442f; }

  /* Wide screens: the ledgers spend the room on the numbers instead of one
     enormous team column, and the two boards sit side by side. */
  @media (min-width: 1100px) {
    .lrow { grid-template-columns: 40px minmax(180px, 2.4fr) repeat(6, minmax(58px, 1fr)); font-size: 13px; }
    .ledger.luck .lrow { grid-template-columns: 40px minmax(160px, 2.4fr) repeat(4, minmax(58px, 1fr)); }
  }
  @media (min-width: 1500px) {
    .boards { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 22px; align-items: start; }
    .boards > .col > .luck-hd:first-child { margin-top: 0; }
  }
  @media (max-width: 620px) {
    .ledger { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .lrow { min-width: 540px; }
    .ledger.luck .lrow { min-width: 460px; }
    .hnd { display: none; }
  }
</style>
