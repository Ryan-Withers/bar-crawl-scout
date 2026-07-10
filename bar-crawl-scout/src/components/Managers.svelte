<script>
  import { link } from 'svelte-spa-router';
  import { createQuery } from '@tanstack/svelte-query';
  import { MGRS, TEAMS, CAPITAL, RYAN } from '../lib/data.js';
  import { chestTag, needScores } from '../lib/models.js';
  import { keepers, unlocked } from '../lib/store.js';
  import { usersQuery, rostersQuery } from '../api/queries';
  import { managersFromUsers, userHandleMap, recordsFromRosters } from '../api/league';
  import { avatarUrl } from '../api/sleeper';
  import Stamp from './Stamp.svelte';

  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());

  $: ks = $keepers;
  $: liveMgrs = $usersQ.data ? managersFromUsers($usersQ.data) : {};
  $: uhMap = $usersQ.data ? userHandleMap($usersQ.data) : {};
  $: records = ($rostersQ.data && $usersQ.data) ? recordsFromRosters($rostersQ.data, uhMap) : {};

  // Live record/PF when synced, else the static fallback from the dossier data.
  const recOf = (m) => { const r = records[m.h]; return r ? `${r.wins}-${r.losses}${r.ties ? '-' + r.ties : ''}` : m.rec; };
  const pfOf = (m) => { const r = records[m.h]; return r ? Math.round(r.pf).toLocaleString() + ' PF' : m.pf; };

  const teamName = (h) => (TEAMS.find((t) => t[0] === h) || [h, h])[1];
  const initials = (name) => name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const keepersOf = (h) => (ks[h] || []).slice(0, 3).filter((s) => s && s[0]);
  const watchOf = (h) => { const w = (ks[h] || [])[3]; return w && w[0] ? w[0] : null; };
  const needBars = (h) => { const n = needScores(ks, h); return ['RB', 'WR', 'TE', 'QB'].map((k) => ({ k, v: n[k] })); };
  const chestTone = (t) => (t === 'LOADED' ? 'brass' : t === 'STRIPPED' ? 'red' : 'ink');
</script>

<section class="files">
  <div class="filenote">
    <span class="eyebrow">File 03 / The Files</span>
    <p>Ten dossiers. Live rosters, tendencies and draft history load from Sleeper. One file is sealed — don't bother.</p>
  </div>

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
            <Stamp text={chestTag(m.h)} tone={chestTone(chestTag(m.h))} seed={i * 3 + 1} />
          </div>

          <div class="section">
            <div class="lbl">Projected keepers</div>
            <ul class="keeps">
              {#each keepersOf(m.h) as s}<li><span class="kn">{s[0]}</span><span class="kc">{s[1]}</span></li>{/each}
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

          {@const c = CAPITAL[m.h] || [0, 0, 0]}
          <div class="cap">2026 capital: <b>{c[0]}</b>·1st <b>{c[1]}</b>·2nd <b>{c[2]}</b>·3rd</div>
          <p class="blurb">{m.note}</p>
        {/if}
        <a class="openfile" href={'/managers/' + m.h} use:link>Open full file ↗</a>
      </article>
    {/each}
  </div>
</section>

<style>
  .files { padding-top: 6px; }
  .filenote { margin-bottom: 18px; }
  .filenote .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--neon); }
  .filenote p { color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-size: 12px; margin: 6px 0 0; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 30px 22px; }

  .folder {
    position: relative;
    background: var(--paper);
    color: var(--ink);
    border-radius: 4px 4px 3px 3px;
    padding: 26px 20px 20px;
    margin-top: 16px;
    transform: rotate(var(--rot));
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(28, 26, 22, 0.12);
    background-image: repeating-linear-gradient(rgba(28, 26, 22, 0.05) 0 1px, transparent 1px 26px);
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
  .avatar { position: relative; overflow: hidden; width: 40px; height: 40px; flex: none; border-radius: 50%; background: #22303f; color: var(--neon-hot);
    display: grid; place-items: center; font-family: 'Archivo Black', sans-serif; font-size: 14px; box-shadow: 0 0 0 2px var(--paper), 0 0 0 3px rgba(28,26,22,.25); }
  .avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .who .handle { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); }
  .who .rec { font-family: 'Archivo Black', sans-serif; font-size: 18px; }
  .who .rec small { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--ink-soft); font-weight: 400; margin-left: 5px; }
  .cornerstamp { margin-left: auto; }

  .stamps { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 14px; }
  .section { margin-bottom: 12px; }
  .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 5px; }
  .keeps { list-style: none; margin: 0; padding: 0; }
  .keeps li { display: flex; justify-content: space-between; align-items: baseline; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; padding: 2px 0; border-bottom: 1px dashed rgba(28, 26, 22, 0.18); }
  .keeps .kn { font-weight: 500; }
  .keeps .kc { font-size: 10px; text-transform: uppercase; color: #7a5; color: #2f7fb8; letter-spacing: 0.05em; }
  .keeps .watch .kc { color: var(--ink-soft); }

  .needs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
  .need { font-family: 'IBM Plex Mono', monospace; font-size: 10px; }
  .need span { display: block; color: var(--ink-soft); margin-bottom: 2px; }
  .need i { display: block; height: 5px; border-radius: 3px; background: rgba(28, 26, 22, 0.14); position: relative; }
  .need i::after { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--w); background: #2f7fb8; border-radius: 3px; }

  .cap { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); margin: 10px 0 8px; }
  .cap b { color: var(--ink); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; line-height: 1.55; margin: 8px 0 0; color: #3a352a; background: none; border: none; padding: 0; }
  .openfile { display: inline-block; margin-top: 12px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #2f7fb8; text-decoration: none; border-bottom: 1.5px solid currentColor; }

  .redacted { padding: 6px 0 2px; }
  .redacted .bar { height: 13px; background: #1c1a16; border-radius: 2px; margin: 8px 0; }
</style>
