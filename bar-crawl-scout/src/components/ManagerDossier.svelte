<script>
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { MGRS, TEAMS, TEAMSHORT, CAPITAL, RYAN } from '../lib/data.js';
  import { capital } from '../lib/store.js';
  import { chestValue, chestTagFor } from '../lib/engine/picks';

  // The war chest, off Sleeper's traded picks rather than a hand-count that had
  // drifted for four of the ten managers. Falls back to the constant offline.
  $: capSeasons = $capital ? Object.keys($capital).sort() : [];
  $: liveCap = $capital && capSeasons[0] ? $capital[capSeasons[0]][handle] : null;
  $: futCap = $capital && capSeasons[1] ? $capital[capSeasons[1]][handle] : null;
  $: chestNum = liveCap ? chestValue(liveCap) : warchest(handle);
  $: chestLbl = liveCap ? chestTagFor(chestNum) : chestTag(handle);
  import { chestTag, needScores, warchest, yearsLeft } from '../lib/models.js';
  import { keepers, draft, faab, managerNotes, unlocked } from '../lib/store.js';
  import { usersQuery, rostersQuery, seasonMatchupsQuery } from '../api/queries';
  import { managersFromUsers, userHandleMap, recordsFromRosters } from '../api/league';
  import { rosterHandleMap } from '../api/history';
  import { weekResultsFor, streakSummary } from '../lib/engine/streaks.ts';
  import { rivalryLedger } from '../lib/engine/rivalries.ts';
  import { avatarUrl } from '../api/sleeper';
  import Stamp from './Stamp.svelte';
  import Coaster from './Coaster.svelte';
  import PlayerChip from './PlayerChip.svelte';

  export let params = {};
  $: handle = params.id;

  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const seasonQ = createQuery(seasonMatchupsQuery());

  $: m = MGRS.find((x) => x.h === handle);
  $: classified = handle === RYAN && !$unlocked;
  $: teamName = (TEAMS.find((t) => t[0] === handle) || [handle, handle])[1];
  $: ks = $keepers;
  $: liveMgrs = $usersQ.data ? managersFromUsers($usersQ.data) : {};
  $: records = ($rostersQ.data && $usersQ.data) ? recordsFromRosters($rostersQ.data, userHandleMap($usersQ.data)) : {};
  $: rec = records[handle];
  $: db = $draft && $draft.byManager ? $draft.byManager[handle] : null;
  // This season's week-by-week results power both the Form panel and Rivalries.
  $: rh = ($rostersQ.data && $usersQ.data) ? rosterHandleMap($rostersQ.data, userHandleMap($usersQ.data)) : {};
  $: results = ($seasonQ.data && Object.keys(rh).length) ? weekResultsFor(handle, $seasonQ.data, rh) : [];
  $: form = results.length ? streakSummary(results) : null;
  $: rivals = rivalryLedger(results);
  const oppName = (h) => TEAMSHORT[h] || h;
  $: fa = $faab && $faab.byManager ? $faab.byManager[handle] : null;
  $: keeps = (ks[handle] || []).slice(0, 3).filter((s) => s && s[0]);
  $: needs = m ? needScores(ks, handle) : {};

  const initials = (name) => name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const posMix = (d) => { const p = d.pos || {}; return Object.keys(p).sort((a, b) => p[b] - p[a]).map((k) => `${k} ${p[k]}`).join(' · '); };
  const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n));
  const staticPF = (s) => { const n = parseFloat(String(s).replace(/[^0-9.]/g, '')); return isNaN(n) ? s : fmtK(n); };
</script>

{#if !m}
  <section class="stub"><p>No file for "{handle}".</p><a href="/managers" use:link>← Back to The Files</a></section>
{:else}
  <section class="dossier">
    <a class="back" href="/managers" use:link>← The Files</a>
    <div class="folder">
      <div class="hd">
        <span class="avatar big">
          {initials(teamName)}
          {#if !classified && liveMgrs[handle]?.avatar}<img src={avatarUrl(liveMgrs[handle].avatar, false)} alt="" on:error={(e) => e.currentTarget.remove()} />{/if}
        </span>
        <div class="who">
          <div class="tm">{teamName}</div>
          <div class="handle">@{handle}</div>
        </div>
        {#if classified}<span class="cs"><Stamp text="CLASSIFIED" tone="red" big seed={7} /></span>{/if}
      </div>

      {#if classified}
        <div class="sealed">🔒 <b>FILE REDACTED.</b> The commissioner's dossier is sealed. His roster is public on Sleeper if you must — but this file stays closed.</div>
      {:else}
        <div class="coasters">
          <Coaster value={rec ? `${rec.wins}-${rec.losses}` : m.rec} label="Record" tone="neon" />
          <Coaster value={rec ? fmtK(rec.pf) : staticPF(m.pf)} label="Points For" tone="brass" />
          <Coaster value={chestNum} label="Chest" tone={chestLbl === 'LOADED' ? 'brass' : chestLbl === 'STRIPPED' ? 'red' : 'muted'} />
          {#if fa}<Coaster value={'$' + (fa.max || 0)} label="Top Bid" tone="neon" />{/if}
        </div>

        <div class="stamps">
          {#each m.tags as t, ti}<Stamp text={t} tone={ti === 0 ? 'neon' : 'ink'} seed={ti + 3} />{/each}
          <Stamp text={chestLbl} tone={chestLbl === 'LOADED' ? 'brass' : chestLbl === 'STRIPPED' ? 'red' : 'ink'} seed={9} />
        </div>

        <div class="secs">
        {#if liveCap}
          <div class="sec"><h4>Draft capital <small>(live from Sleeper)</small></h4>
            <div class="caprow">
              <b>{capSeasons[0]}</b>
              {liveCap.top3[0]}·1st {liveCap.top3[1]}·2nd {liveCap.top3[2]}·3rd
              <small>{liveCap.total} picks</small>
            </div>
            {#if futCap}
              <div class="caprow">
                <b>{capSeasons[1]}</b>
                {futCap.top3[0]}·1st {futCap.top3[1]}·2nd {futCap.top3[2]}·3rd
                <small>{futCap.total} picks</small>
              </div>
            {/if}
            {#if liveCap.picks.filter((p) => p.via && p.round <= 5).length}
              <div class="caprow bought">
                Bought:
                {liveCap.picks.filter((p) => p.via && p.round <= 5).map((p) => `R${p.round} (${p.via})`).join(', ')}
              </div>
            {/if}
          </div>
        {/if}
        <div class="sec"><h4>Form &amp; records <small>(this season)</small></h4>
          {#if form && form.cur}
            <div class="formrow">
              {#each form.last5 as k}<span class="fchip {k.toLowerCase()}">{k}</span>{/each}
              <b class="curstreak {form.cur.kind.toLowerCase()}">{form.cur.len}{form.cur.kind}{form.cur.kind === 'W' ? ' streak 🔥' : form.cur.kind === 'L' ? ' skid 🥶' : ''}</b>
            </div>
            <p>Best week: <b>{form.best.pts.toFixed(1)}</b> (wk {form.best.week} vs {oppName(form.best.opp)}) ·
              Worst: <b>{form.worst.pts.toFixed(1)}</b> (wk {form.worst.week} vs {oppName(form.worst.opp)}) ·
              Longest win run: <b>{form.longestW}</b></p>
          {:else}
            <p class="incomplete"><Stamp text="File Incomplete" tone="ink" seed={11} /> no completed weeks yet — check back after kickoff.</p>
          {/if}
        </div>

        {#if rivals.length}
          <div class="sec"><h4>Rivalries <small>(this season, head-to-head)</small></h4>
            <div class="rivals">
              {#each rivals as r}
                <div class="riv">
                  <span class="rres {r.lastResult.toLowerCase()}">{r.lastResult}</span>
                  <span class="rnm">{oppName(r.opp)}</span>
                  <span class="rrec">{r.wins}-{r.losses}{r.ties ? '-' + r.ties : ''}</span>
                  <span class="rdiff" class:pos={r.diff > 0} class:neg={r.diff < 0}>{r.diff > 0 ? '+' : ''}{r.diff}</span>
                </div>
              {/each}
            </div>
            <p class="note2">Series record and season point differential against each rival — last meeting's result on the left.</p>
          </div>
        {/if}

        <div class="sec"><h4>Tendencies</h4><p>{m.tend}</p><p class="note2">{m.note}</p></div>

        <div class="sec"><h4>Projected keepers</h4>
          <ul class="keeps">
            {#each keeps as s}<li><PlayerChip name={s[0]} /><span class="clk">{yearsLeft(s[0]) === 1 ? 'FINAL YR' : '2 YR'} · {s[1]}</span></li>{/each}
            {#if !keeps.length}<li class="muted">none set</li>{/if}
          </ul>
        </div>

        <div class="sec"><h4>Needs after keepers</h4>
          <div class="needs">{#each ['RB', 'WR', 'TE', 'QB'] as k}<div class="need"><span>{k}</span><i style="--w:{(needs[k] || 0) * 10}%"></i><b>{needs[k] || 0}</b></div>{/each}</div>
        </div>

        <div class="sec"><h4>Draft mix (24–25)</h4>
          {#if db}
            <p>{posMix(db)}</p>
            {#if db.repeat && db.repeat.length}<p class="note2"><b>True affinity (drafted both years):</b> {db.repeat.join(', ')}</p>{/if}
          {:else}
            <p class="incomplete"><Stamp text="File Incomplete" tone="ink" seed={5} /> tap Sync in a browser to pull real 2024–25 draft picks.</p>
          {/if}
        </div>

        <div class="sec"><h4>FAAB behaviour</h4>
          {#if fa}<p>median ${fa.median} · max ${fa.max} · spent ${fa.spent} over {fa.count} bids</p>
          {:else}<p class="incomplete"><Stamp text="File Incomplete" tone="ink" seed={9} /> Sync to load real bid history.</p>{/if}
        </div>

        <div class="sec"><h4>Scout notes <small>(private, local)</small></h4>
          <textarea placeholder="Your read on {handle}…" value={$managerNotes[handle] || ''} on:input={(e) => managerNotes.update((n) => ({ ...n, [handle]: e.target.value }))}></textarea>
        </div>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .caprow { font-family: var(--mono); font-size: 12px; color: var(--chalk); padding: 5px 0; border-bottom: 1px dashed var(--line); }
  .caprow:last-child { border-bottom: none; }
  .caprow b { color: var(--blue-deep); margin-right: 6px; }
  .caprow small { color: var(--muted); margin-left: 6px; }
  .caprow.bought { color: var(--brass); }
  .dossier { padding-top: 2px; }
  .back { display: inline-flex; align-items: center; min-height: 44px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--neon); text-decoration: none; }
  .stub { padding: 40px 0; font-family: 'IBM Plex Mono', monospace; color: var(--muted); }
  .stub a { color: var(--neon); display: block; margin-top: 10px; }
  .folder { background: var(--paper); color: var(--ink); border-radius: 5px; padding: 24px; box-shadow: 0 12px 26px rgba(0, 0, 0, 0.4); background-image: repeating-linear-gradient(rgba(28,26,22,.04) 0 1px, transparent 1px 30px); }
  .hd { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .avatar { position: relative; overflow: hidden; width: 64px; height: 64px; border-radius: 50%; background: #22303f; color: var(--neon-hot); display: grid; place-items: center; font-family: 'Archivo Black', sans-serif; font-size: 20px; box-shadow: 0 0 0 3px var(--paper), 0 0 0 4px rgba(28,26,22,.25); }
  .avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .who .tm { font-family: 'Archivo Black', sans-serif; font-size: 24px; text-transform: uppercase; line-height: 1; }
  .who .handle { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-soft); margin-top: 4px; }
  .cs { margin-left: auto; }
  .sealed { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #3a352a; line-height: 1.7; padding: 12px 0; }
  .coasters { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
  .stamps { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
  /* Stacked on a phone; on a wide desk the panels sit side by side so the
     whole file reads without a scroll marathon. */
  .secs { display: grid; grid-template-columns: 1fr; }
  @media (min-width: 900px) {
    .secs { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); column-gap: 30px; align-items: start; }
  }
  .sec { border-top: 1px dashed rgba(28,26,22,.2); padding: 12px 0; min-width: 0; }
  .sec h4 { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-soft); margin: 0 0 6px; }
  .sec h4 small { text-transform: none; letter-spacing: 0; }
  .sec p { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; line-height: 1.6; margin: 4px 0; color: #2a271f; }
  .note2 { color: #4a4636 !important; }
  .keeps { list-style: none; margin: 0; padding: 0; }
  .keeps li { display: flex; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 13px; padding: 4px 0; border-bottom: 1px dashed rgba(28,26,22,.14); }
  .keeps .clk { font-size: 10px; color: #2f7fb8; text-transform: uppercase; letter-spacing: .04em; }
  .keeps .muted { color: var(--ink-soft); }
  .needs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .need { font-family: 'IBM Plex Mono', monospace; font-size: 11px; display: flex; align-items: center; gap: 6px; }
  .need span { color: var(--ink-soft); width: 22px; }
  .need i { flex: 1; height: 6px; border-radius: 3px; background: rgba(28,26,22,.14); position: relative; }
  .need i::after { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--w); background: #2f7fb8; border-radius: 3px; }
  .incomplete { display: flex; align-items: center; gap: 8px; color: var(--ink-soft) !important; }
  .rivals { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 6px; }
  .riv { display: grid; grid-template-columns: 22px 1fr auto 52px; align-items: center; gap: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; padding: 4px 0; border-bottom: 1px dashed rgba(28,26,22,.14); color: #2a271f; }
  .riv .rres { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 4px; font-size: 10px; font-weight: 700; color: #fff; }
  .rres.w { background: #1d8a4e; } .rres.l { background: #b5442f; } .rres.t { background: #4a4636; }
  .riv .rnm { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .riv .rrec { color: var(--ink-soft); }
  .riv .rdiff { text-align: right; font-weight: 700; color: var(--ink-soft); }
  .riv .rdiff.pos { color: #1d8a4e; } .riv .rdiff.neg { color: #b5442f; }
  .formrow { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin: 4px 0 8px; }
  .fchip { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 4px; font-family: 'Archivo Black', sans-serif; font-size: 11px; color: #fff; }
  .fchip.w { background: #0c8c4a; } .fchip.l { background: #b8442f; } .fchip.t { background: #4a4636; }
  .curstreak { font-family: 'IBM Plex Mono', monospace; font-size: 12px; margin-left: 8px; }
  .curstreak.w { color: #0c8c4a; } .curstreak.l { color: #b8442f; } .curstreak.t { color: #4a4636; }
  textarea { width: 100%; min-height: 70px; background: rgba(255,255,255,.4); border: 1px solid rgba(28,26,22,.25); border-radius: 4px; padding: 8px; font-family: 'Caveat', cursive; font-size: 18px; color: #2a271f; resize: vertical; }
  textarea:focus { outline: 2px solid #2f7fb8; }
</style>
