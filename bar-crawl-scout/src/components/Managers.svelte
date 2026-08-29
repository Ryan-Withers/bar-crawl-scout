<script>
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { MGRS, TEAMS, CAPITAL, RYAN } from '../lib/data.js';
  import { capital } from '../lib/store.js';
  import { chestTag, needScores, keptRows, watchName } from '../lib/models.js';
  import { chestValue, chestTagFor } from '../lib/engine/picks';
  import { needTargets } from '../lib/engine/league-config';
  import { keepers, unlocked, keepersSource, keeperFrom } from '../lib/store.js';
  import { usersQuery, rostersQuery, seasonMatchupsQuery , leagueQuery } from '../api/queries';
  import { managersFromUsers, userHandleMap, recordsFromRosters } from '../api/league';
  import { rosterHandleMap } from '../api/history';
  import { weekResultsFor } from '../lib/engine/streaks.ts';
  import { clutchRecord } from '../lib/engine/clutch.ts';
  import { avatarUrl } from '../api/sleeper';
  import Stamp from './Stamp.svelte';

  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const seasonQ = createQuery(seasonMatchupsQuery());

  $: ks = $keepers;
  $: liveMgrs = $usersQ.data ? managersFromUsers($usersQ.data) : {};
  $: uhMap = $usersQ.data ? userHandleMap($usersQ.data) : {};
  $: records = ($rostersQ.data && $usersQ.data) ? recordsFromRosters($rostersQ.data, uhMap) : {};

  // Each manager's record in one-score games (decided by <= 10).
  $: rh = ($rostersQ.data && $usersQ.data) ? rosterHandleMap($rostersQ.data, uhMap) : {};
  $: clutch = ($seasonQ.data && Object.keys(rh).length)
    ? Object.fromEntries(MGRS.map((m) => [m.h, clutchRecord(weekResultsFor(m.h, $seasonQ.data, rh))]))
    : {};

  // Live record/PF when synced, else the static fallback from the dossier data.
  const recOf = (m) => { const r = records[m.h]; return r ? `${r.wins}-${r.losses}${r.ties ? '-' + r.ties : ''}` : m.rec; };
  const pfOf = (m) => { const r = records[m.h]; return r ? Math.round(r.pf).toLocaleString() + ' PF' : m.pf; };

  const teamName = (h) => (TEAMS.find((t) => t[0] === h) || [h, h])[1];
  const initials = (name) => name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  // REACTIVE, not const. Svelte re-renders markup when something the markup
  // REFERENCES changes — and the markup references these helpers, not `ks`. As
  // plain consts their identity never changed, so this page rendered once with
  // the old projections and never updated when the locked keepers arrived: it
  // was still showing Drake London as one of joshleota's three long after
  // Sleeper said DeVonta Smith. Declaring them reactively makes the function
  // identity change with `ks`, which is what pulls the markup through.
  // The war-chest stamp off the LIVE capital, not the hand-counted constant.
  // joshleota was stamped STRIPPED while holding a first, because the constant
  // still had him at zero — the same staleness the capital line above already
  // fixed, one component over.
  $: chestOf = (h) => {
    const seasons = $capital ? Object.keys($capital).sort() : [];
    const live = $capital && seasons[0] ? $capital[seasons[0]][h] : null;
    return live ? chestTagFor(chestValue(live)) : chestTag(h);
  };
  // Not a fixed three any more: a keeper sold in principle is listed under the
  // manager who bought him, so a settled squad can be four or five.
  $: keepersOf = (h) => keptRows(ks, h);
  $: watchOf = (h) => watchName(ks, h);
  $: fromOf = (name) => $keeperFrom[name] || null;
  const leagueQ = createQuery(leagueQuery());
  // The starting lineup decides what a manager needs; it is not a constant.
  $: tgts = needTargets($leagueQ.data?.roster_positions || []);
  $: needBars = (h) => { const n = needScores(ks, h, tgts); return ['RB', 'WR', 'TE', 'QB'].map((k) => ({ k, v: n[k] })); };
  const chestTone = (t) => (t === 'LOADED' ? 'brass' : t === 'STRIPPED' ? 'red' : 'ink');
</script>

<section class="files">
  <p class="filenote">Rosters, tendencies and draft history load live from Sleeper. One file is sealed by the commissioner — don't bother.</p>

  <div class="grid">
    {#each MGRS as m, i}
      {@const classified = m.h === RYAN && !$unlocked}
      <article class="folder" style="--rot:{((i * 37 + 11) % 9) - 4}deg">
        <span class="tab">{teamName(m.h)}</span>
        <span class="clip"></span>

        <div class="hd">
          <span class="avatar">
            {initials(teamName(m.h))}
            {#if !classified && liveMgrs[m.h]?.avatar}
              <img src={avatarUrl(liveMgrs[m.h].avatar)} alt="" on:error={(e) => e.currentTarget.remove()} />
            {/if}
          </span>
          <div class="who">
            <div class="handle">@{m.h}</div>
            <div class="rec">{recOf(m)} <small>{pfOf(m)}</small></div>
          </div>
          {#if classified}
            <span class="cornerstamp"><Stamp text="CLASSIFIED" tone="red" seed={i} /></span>
          {/if}
        </div>

        {#if classified}
          <div class="redacted">
            <div class="bar" style="width:82%"></div>
            <div class="bar" style="width:64%"></div>
            <div class="bar" style="width:74%"></div>
            <p class="blurb">Sealed by the commissioner. Everything here is public on Sleeper if you must — but you didn't hear it from us.</p>
          </div>
        {:else}
          <div class="stamps">
            {#each m.tags as t, ti}<Stamp text={t} tone={ti === 0 ? 'neon' : 'ink'} seed={i * 5 + ti} />{/each}
            <Stamp text={chestOf(m.h)} tone={chestTone(chestOf(m.h))} seed={i * 3 + 1} />
          </div>

          <div class="section">
            <div class="lbl">{$keepersSource === 'projection' ? 'Projected keepers' : 'Keepers'}</div>
            <ul class="keeps">
              {#each keepersOf(m.h) as s}<li><span class="kn">{s[0]}</span><span class="kc">{fromOf(s[0]) ? 'via ' + fromOf(s[0]) : s[1]}</span></li>{/each}
              {#if watchOf(m.h)}<li class="watch"><span class="kn">{watchOf(m.h)}</span><span class="kc">watch</span></li>{/if}
            </ul>
          </div>

          <div class="section">
            <div class="lbl">Needs after keepers</div>
            <div class="needs">
              {#each needBars(m.h) as nb}
                <div class="need"><span>{nb.k}</span><i style="--w:{nb.v * 10}%"></i></div>
              {/each}
            </div>
          </div>

          {#if clutch[m.h] && clutch[m.h].closeGames}
            {@const cl = clutch[m.h]}
            <div class="clutch" class:hot={cl.rate >= 0.6} class:cold={cl.rate <= 0.4}>
              <span class="cdot">{cl.rate >= 0.6 ? '🧊' : cl.rate <= 0.4 ? '😰' : '⏱'}</span>
              <b>{cl.record}</b> in one-score games <small>(decided by ≤10)</small>
            </div>
          {/if}

          {@const seasons = $capital ? Object.keys($capital).sort() : []}
          {@const c = ($capital && seasons[0] && $capital[seasons[0]][m.h]?.top3) || CAPITAL[m.h] || [0, 0, 0]}
          {@const f = $capital && seasons[1] ? $capital[seasons[1]][m.h]?.top3 : null}
          <div class="cap">
            {seasons[0] || 2026} capital: <b>{c[0]}</b>·1st <b>{c[1]}</b>·2nd <b>{c[2]}</b>·3rd
            {#if f}<span class="fut">· {seasons[1]}: <b>{f[0]}</b>·1st <b>{f[1]}</b>·2nd <b>{f[2]}</b>·3rd</span>{/if}
          </div>
          <p class="blurb">{m.note}</p>
        {/if}
        <a class="openfile" href={'/managers/' + m.h} use:link>Open full file ↗</a>
      </article>
    {/each}
  </div>
</section>

<style>
  .cap .fut { color: var(--muted); }
  .files { padding-top: 2px; }
  .filenote { color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-size: 12px; line-height: 1.6; margin: 0 0 18px; max-width: 76ch; }

  /* As many folders as the desk fits — one per row on a phone. */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 30px 22px; align-items: start; }

  .folder {
    position: relative;
    background: var(--paper);
    color: var(--ink);
    border-radius: 4px 4px 3px 3px;
    padding: 26px 20px 20px;
    margin-top: 16px;
    transform: rotate(var(--rot));
    box-shadow: 0 10px 22px rgba(22, 32, 43, 0.12), inset 0 0 0 1px rgba(22, 32, 43, 0.12);
    background-image: repeating-linear-gradient(rgba(22, 32, 43, 0.05) 0 1px, transparent 1px 26px);
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .folder:hover { transform: rotate(0deg) translateY(-3px); box-shadow: 0 16px 30px rgba(28,46,64,.16); z-index: 2; }
  .tab {
    position: absolute; top: -15px; left: 16px;
    background: var(--paper); color: var(--ink);
    font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 0.01em;
    padding: 5px 14px 6px; border-radius: 5px 5px 0 0;
    box-shadow: 0 -3px 8px rgba(0, 0, 0, 0.25); max-width: 78%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .clip { position: absolute; top: -9px; right: 24px; width: 13px; height: 34px; border: 2px solid #9aa0a6; border-bottom-color: #b9bdc2; border-radius: 8px; transform: rotate(8deg); background: transparent; }
  .clip::after { content: ''; position: absolute; inset: 3px 3px 10px; border: 2px solid #b0b5ba; border-radius: 6px 6px 0 0; }

  .hd { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
  .avatar { position: relative; overflow: hidden; width: 40px; height: 40px; flex: none; border-radius: 50%; background: var(--blue-deep); color: var(--on-neon);
    display: grid; place-items: center; font-family: 'Archivo Black', sans-serif; font-size: 14px; box-shadow: 0 0 0 2px var(--paper), 0 0 0 3px rgba(22, 32, 43,.25); }
  .avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .who .handle { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); }
  .who .rec { font-family: 'Archivo Black', sans-serif; font-size: 18px; }
  .who .rec small { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--ink-soft); font-weight: 400; margin-left: 5px; }
  .cornerstamp { margin-left: auto; }

  .stamps { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 14px; }
  .section { margin-bottom: 12px; }
  .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 5px; }
  .keeps { list-style: none; margin: 0; padding: 0; }
  .keeps li { display: flex; justify-content: space-between; align-items: baseline; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; padding: 2px 0; border-bottom: 1px dashed rgba(22, 32, 43, 0.18); }
  .keeps .kn { font-weight: 500; }
  .keeps .kc { font-size: 10px; text-transform: uppercase; color: #7a5; color: #2f7fb8; letter-spacing: 0.05em; }
  .keeps .watch .kc { color: var(--ink-soft); }

  .needs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
  .need { font-family: 'IBM Plex Mono', monospace; font-size: 10px; }
  .need span { display: block; color: var(--ink-soft); margin-bottom: 2px; }
  .need i { display: block; height: 5px; border-radius: 3px; background: rgba(22, 32, 43, 0.14); position: relative; }
  .need i::after { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--w); background: #2f7fb8; border-radius: 3px; }

  .cap { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); margin: 10px 0 8px; }
  .cap b { color: var(--ink); }
  .clutch { display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #2a271f; margin: 8px 0 2px; }
  .clutch b { color: var(--ink); }
  .clutch small { color: var(--ink-soft); }
  .clutch.hot b { color: #1d8a4e; } .clutch.cold b { color: #b5442f; }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; line-height: 1.55; margin: 8px 0 0; color: var(--muted); background: none; border: none; padding: 0; }
  /* A thumb-sized target, not a hairline of text. */
  .openfile { display: inline-flex; align-items: center; min-height: 44px; margin-top: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #2f7fb8; text-decoration: underline; text-underline-offset: 3px; }

  .redacted { padding: 6px 0 2px; }
  .redacted .bar { height: 13px; background: var(--ink); border-radius: 2px; margin: 8px 0; }
</style>
