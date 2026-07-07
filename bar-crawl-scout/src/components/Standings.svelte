<script>
  import { link } from 'svelte-spa-router';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMS, TEAMSHORT, MGRS, RYAN } from '../lib/data.js';
  import { rankStandings } from '../lib/engine/standings.ts';
  import { usersQuery, rostersQuery } from '../api/queries';
  import { userHandleMap, recordsFromRosters } from '../api/league';

  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());

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
</script>

<section class="table-page">
  <div class="eyebrow">File 08 / The Table</div>
  <p class="blurb">Where everyone actually stands. Sorted by record, points-for breaks ties.
    {#if live}<span class="livedot">● live from Sleeper</span>{:else}Seeded from last season — tap <a href="/sync" use:link>Sync</a> in a browser for live.{/if}
  </p>

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
</section>

<style>
  .table-page { max-width: 860px; padding-top: 6px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 8px 0 16px; line-height: 1.6; }
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
  @media (max-width: 620px) {
    .ledger { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .lrow { min-width: 540px; }
    .hnd { display: none; }
  }
</style>
