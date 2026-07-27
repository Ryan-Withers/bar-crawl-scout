<script>
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMS, TEAMSHORT, MGRS, RYAN } from '../lib/data.js';
  import { rankStandings } from '../lib/engine/standings.ts';
  import { playoffPicture } from '../lib/engine/playoffs.ts';
  import { usersQuery, rostersQuery, leagueQuery, stateQuery } from '../api/queries';
  import { userHandleMap, recordsFromRosters } from '../api/league';

  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const leagueQ = createQuery(leagueQuery());
  const stateQ = createQuery(stateQuery());

  const mgrByHandle = Object.fromEntries(MGRS.map((m) => [m.h, m]));
  const parseRec = (s) => { const [w, l, t] = String(s || '0-0-0').split('-').map((n) => +n || 0); return { wins: w, losses: l, ties: t || 0 }; };
  const parsePF = (s) => +String(s || '0').replace(/[^0-9.]/g, '') || 0;

  $: liveRecords = ($rostersQ.data && $usersQ.data) ? recordsFromRosters($rostersQ.data, userHandleMap($usersQ.data)) : {};
  $: live = Object.keys(liveRecords).length > 0;

  $: rows = TEAMS.map(([h, team]) => {
    const r = liveRecords[h];
    if (r) return { handle: h, team, wins: r.wins, losses: r.losses, ties: r.ties, pf: r.pf, pa: r.pa };
    const m = mgrByHandle[h]; const rec = parseRec(m && m.rec);
    return { handle: h, team, wins: rec.wins, losses: rec.losses, ties: rec.ties, pf: parsePF(m && m.pf), pa: 0 };
  });
  $: ranked = rankStandings(rows);

  $: settings = $leagueQ.data?.settings || {};
  $: spots = settings.playoff_teams || 6;
  $: regWeeks = settings.playoff_week_start ? settings.playoff_week_start - 1 : 14;
  $: week = $stateQ.data?.week ?? 0;
  $: gamesLeft = Math.max(0, regWeeks - week);
  $: pic = playoffPicture(ranked, spots, gamesLeft);

  const ZONE = { clinched: ['CLINCHED', 'good'], in: ['IN', 'good'], hunt: ['IN THE HUNT', 'even'], out: ['ELIMINATED', 'bad'] };
</script>

<section class="po">
  <p class="blurb">{spots} make it. {#if gamesLeft > 0}{gamesLeft} week{gamesLeft > 1 ? 's' : ''} left — <b>magic</b> is the wins + rivals' losses to lock a spot.{:else}Regular season's done.{/if}
    {#if live}<span class="livedot">● live</span>{:else} Seeded from last season — tap <a href="/sync" use:link>Sync</a> for live.{/if}
    <br><span class="fine">A picture, not the official cut — points-for breaks real ties.</span>
  </p>

  <div class="ladder">
    {#each pic as t, i}
      {#if i === spots}<div class="cutline"><span>PLAYOFF CUT LINE</span></div>{/if}
      <div class="prow" class:you={t.handle === RYAN} class:below={i >= spots}>
        <span class="seed">{t.seed ? '#' + t.seed : '—'}</span>
        <span class="tm">
          <a href={'/managers/' + t.handle} use:link>{TEAMSHORT[t.handle] || t.team}</a>
          {#if t.handle === RYAN}<span class="lock" title="you">★</span>{/if}
        </span>
        <span class="rec">{t.wins}-{t.losses}{t.ties ? '-' + t.ties : ''}</span>
        <span class="pf">{t.pf ? (t.pf >= 1000 ? (t.pf / 1000).toFixed(1) + 'k' : Math.round(t.pf)) : '—'} PF</span>
        <span class="zone {ZONE[t.zone][1]}">{ZONE[t.zone][0]}</span>
        <span class="magic">{#if t.zone === 'clinched'}✓{:else if t.zone === 'in' && t.magic != null}magic {t.magic}{:else if t.zone === 'hunt'}{Math.max(0, (ranked[spots - 1]?.wins || 0) - t.wins)} back{:else}—{/if}</span>
      </div>
    {/each}
  </div>
</section>

<style>
  .po { padding-top: 2px; }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 14px; line-height: 1.6; max-width: 76ch; }
  .blurb b { color: var(--chalk); } .blurb a { color: var(--neon); }
  .livedot { color: #4fb286; } .fine { font-size: 10.5px; color: var(--ink-soft); }
  .ladder { display: flex; flex-direction: column; }
  .prow { display: grid; grid-template-columns: 40px minmax(120px, 1fr) 64px 72px auto 84px; align-items: center; gap: 10px; padding: 9px 8px; border-bottom: 1px solid var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .prow.below { opacity: .72; }
  .prow.you { background: rgba(130,201,252,.08); border-radius: 5px; }
  .seed { font-family: 'Archivo Black', sans-serif; font-size: 15px; color: var(--neon); text-align: center; }
  .prow.below .seed { color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
  .tm { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .tm a { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 14px; color: var(--chalk); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tm a:hover { color: var(--neon-hot); }
  .lock { color: var(--brass); }
  .rec { font-weight: 700; color: var(--chalk); }
  .pf { color: var(--muted); font-size: 10.5px; text-align: right; }
  .zone { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-align: right; }
  .zone.good { color: var(--neon); } .zone.even { color: var(--brass); } .zone.bad { color: var(--stamp-red); }
  .magic { text-align: right; color: var(--muted); font-size: 10.5px; }
  .cutline { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
  .cutline::before, .cutline::after { content: ''; flex: 1; height: 1px; background: repeating-linear-gradient(90deg, var(--stamp-red) 0 6px, transparent 6px 12px); }
  .cutline span { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: .14em; color: var(--stamp-red); }
  @media (max-width: 620px) { .prow { grid-template-columns: 32px 1fr 56px auto 70px; } .pf { display: none; } }
  /* Wide screens: spread the ladder across the room instead of stretching the
     team name into a canyon. */
  @media (min-width: 1000px) {
    .prow { grid-template-columns: 52px minmax(180px, 2.4fr) minmax(70px, .8fr) minmax(84px, .8fr) minmax(112px, .9fr) minmax(92px, .8fr); padding: 11px 10px; font-size: 13px; }
  }
</style>
