<script>
  import { link, push } from 'svelte-spa-router';
  import { BYUNAME, MODES, RYAN, TAGTXT, PLAYERS } from '../lib/data.js';
  import { r26, r27, pts26, pts27, windowVal, ownerOf, isKept, isFinalYr, yearsLeft, rosterOwner, isRyanPlayer } from '../lib/models.js';
  import { keepers, mode, rosterOwn, playerNotes, unlocked } from '../lib/store.js';
  import Coaster from './Coaster.svelte';
  import Stamp from './Stamp.svelte';
  import ChainOfCustody from './ChainOfCustody.svelte';
  import VsLeague from './VsLeague.svelte';
  import GameLog from './GameLog.svelte';
  import Career from './Career.svelte';
  import Projection from './Projection.svelte';
  import Usage from './Usage.svelte';
  import { similarPlayers } from '../lib/engine/similar.ts';
  import { assemblePlayerHistory } from '../api/history.ts';
  import { loadPlayers } from '../api/players.ts';

  export let params = {};
  export let variant = 'page'; // 'page' | 'drawer'
  $: name = params.id ? decodeURIComponent(params.id) : '';
  $: p = BYUNAME[name.toLowerCase()];

  $: ks = $keepers;
  $: md = $mode;
  $: own = $rosterOwn;
  $: classified = p && isRyanPlayer(ks, name) && !$unlocked;

  $: w = md === 'winnow' ? MODES.winnow : md === 'balanced' ? MODES.balanced : MODES.future;
  $: R26 = p ? r26(p) : 0;
  $: R27 = p ? r27(p, ks) : 0;
  $: WIN = p ? windowVal(p, ks, md) : 0;
  $: k = p ? ownerOf(ks, name) : null;
  $: ro = p ? rosterOwner(own, name) : null;
  $: tm = p ? (p[3] === 'FA' ? 'FA' : p[3] + ' · bye ' + p[4]) : '';
  $: stageLabel = p && TAGTXT[p[6]] ? TAGTXT[p[6]][1] : '';

  // Similar files — nearest peers on the board (runs offline; pure board math).
  $: pool = PLAYERS.map((pp) => ({ name: pp[1], pos: pp[2], r26: r26(pp), adp: pp[5] }));
  $: peers = p ? similarPlayers({ name, pos: p[2], r26: R26, adp: p[5] }, pool, 5) : [];

  // Live custody chain + vs-league — walks every season in the browser. Blocked/
  // offline just leaves the empty states in place; guarded against re-fetch churn.
  const EMPTY_HIST = { chain: [], vs: [], gameLog: [], totals: { games: 0, points: 0, ppg: null }, best: null, career: [], proj: { weeks: [], beatRate: null, avgDelta: null }, usage: { weeks: [], avgTgtShare: null, avgTouch: null, avgSnap: null, snapTrend: null } };
  let hist = EMPTY_HIST;
  let histLoading = false;
  let histFor = '';
  $: if (name && p && !classified && name !== histFor) loadHistory(name);
  async function loadHistory(n) {
    histFor = n;
    histLoading = true;
    hist = EMPTY_HIST;
    try {
      const byId = await loadPlayers();
      const h = await assemblePlayerHistory(n, byId);
      if (histFor === n) hist = h;
    } catch {
      /* Sleeper blocked/offline — components keep their empty state */
    } finally {
      if (histFor === n) histLoading = false;
    }
  }

  const SECTIONS = [['pf-gl', 'Game Log'], ['pf-car', 'Career'], ['pf-proj', 'Proj vs Reality'], ['pf-usg', 'Usage'], ['pf-vs', 'Vs League'], ['pf-coc', 'Chain'], ['pf-sim', 'Similar'], ['pf-notes', 'Notes']];
  function jumpTo(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  let cmp = '';
  function doCompare() {
    const other = BYUNAME[cmp.trim().toLowerCase()];
    if (other) push('/compare/' + encodeURIComponent(name) + '/' + encodeURIComponent(other[1]));
  }
</script>

<section class="file" class:drawer={variant === 'drawer'}>
  {#if variant === 'page'}<a class="back" href="/board" use:link>← The Big Board</a>{/if}

  {#if !p}
    <div class="miss">No file on record for "<b>{name}</b>". He's not in the top-200 board — live-only players open once the player blob loads.</div>
  {:else}
    <!-- A. HEADER SHEET -->
    <div class="sheet header">
      <div class="hbar">
        <div class="hname">
          <div class="pos">{p[2]} · {p[3]}{p[4] ? ' · bye ' + p[4] : ''}{stageLabel ? ' · ' + stageLabel : ''}</div>
          <h1>{name}</h1>
        </div>
        {#if classified}
          <Stamp text="CLASSIFIED" tone="red" big seed={3} />
        {:else if k && k.conf !== 'U'}
          <span class="plate kept">PROPERTY OF {k.owner}</span>
        {:else if ro && ro !== RYAN}
          <span class="plate owned">ON {ro}'S ROSTER</span>
        {:else}
          <span class="plate free">FREE AGENT · ON THE WIRE</span>
        {/if}
      </div>

      {#if classified}
        <div class="sealed">🔒 This file is sealed by the commissioner. His roster is public on Sleeper — this dossier is not.</div>
      {:else}
        <div class="coasters">
          <Coaster value={WIN} label="WIN" tone="neon" />
          <Coaster value={R26} label="R26" tone="brass" />
          <Coaster value={R27} label="R27" tone="muted" />
          <Coaster value={p[5]} label="ADP" tone="muted" />
          {#if isKept(ks, name)}<Coaster value={yearsLeft(name) === 1 ? '1YR' : '2YR'} label="Contract" tone={isFinalYr(ks, name) ? 'red' : 'neon'} />{/if}
        </div>

        <!-- B. FORMULA SHEET (chalkboard) -->
        <div class="chalk">
          <div class="ceyebrow">The formula, owned · window: {md}</div>
          <div class="math">
            WIN = R26 × {w[0]} + R27 × {w[1]}
          </div>
          <div class="math sub">= {R26} × {w[0]} + {R27} × {w[1]} = <b>{WIN}</b></div>
          <div class="cnote">
            {#if isFinalYr(ks, name)}Final-year keeper: R27 is the replacement value ({R27}), not zero — keeping him frees a slot next year.{:else}P26 {pts26(p)} · P27 {pts27(p, ks) || '—'} projected half-PPR points, to sanity-check the value.{/if}
          </div>
        </div>

        <div class="cmpbar">
          <span>⚔ Tale of the tape vs</span>
          <input list="plist" placeholder="another player…" bind:value={cmp} on:keydown={(e) => e.key === 'Enter' && doCompare()} />
          <button on:click={doCompare}>Compare</button>
        </div>

        <!-- Jump-to-section nav so the file doesn't become one long scroll -->
        {#if variant === 'page'}
          <div class="jumpnav">
            {#each SECTIONS as [id, label]}<button type="button" on:click={() => jumpTo(id)}>{label}</button>{/each}
          </div>
        {/if}

        <!-- Live sections stream in the browser; graceful here -->
        <!-- This season's receipt: league-scored per-week points (live) -->
        <div class="sheet stub" id="pf-gl">
          <GameLog rows={hist.gameLog} totals={hist.totals} best={hist.best} loading={histLoading} />
        </div>

        <!-- Season-by-season league-scored totals (live) -->
        <div class="sheet stub" id="pf-car">
          <Career rows={hist.career} loading={histLoading} />
        </div>

        <!-- Weekly projected vs actual, both league-scored (live) -->
        <div class="sheet stub" id="pf-proj">
          <Projection summary={hist.proj} loading={histLoading} />
        </div>

        <!-- Target / touch / snap share off real box-score denominators (live) -->
        <div class="sheet stub" id="pf-usg">
          <Usage summary={hist.usage} loading={histLoading} />
        </div>

        <!-- Head-to-head: what he averages against each manager -->
        <div class="sheet stub" id="pf-vs">
          <VsLeague rows={hist.vs} loading={histLoading} />
        </div>

        <!-- The showpiece: full league custody chain, reconstructed from draft + txns -->
        <div class="sheet stub" id="pf-coc">
          <ChainOfCustody events={hist.chain} loading={histLoading} />
        </div>

        <!-- Similar Files — nearest peers by position + value (live, board-derived) -->
        {#if peers.length}
          <div class="sheet stub" id="pf-sim">
            <div class="stubhd">Similar Files</div>
            <div class="peers">
              {#each peers as pr}
                <a class="peer" href={'/player/' + encodeURIComponent(pr.name)} use:link>
                  <span class="ppos">{pr.pos}</span>
                  <span class="pname">{pr.name}</span>
                  <span class="pval">R26 {pr.r26} · ADP {pr.adp}</span>
                </a>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Your read on this guy — private, local-only scout notes -->
        <div class="sheet stub" id="pf-notes">
          <div class="stubhd">Scout Notes <small>(private, local)</small></div>
          <textarea
            class="notes"
            placeholder="Your read on {name}…"
            value={$playerNotes[name] || ''}
            on:input={(e) => playerNotes.update((n) => ({ ...n, [name]: e.target.value }))}
          ></textarea>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .file { max-width: 760px; padding-top: 6px; }
  .file.drawer { max-width: none; }
  .back { display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--neon); text-decoration: none; margin-bottom: 12px; }
  .miss { font-family: 'IBM Plex Mono', monospace; color: var(--muted); padding: 30px 0; }

  .sheet.header { background: var(--paper); color: var(--ink); border-radius: 5px; padding: 22px; box-shadow: 0 12px 26px rgba(0,0,0,.4); }
  .hbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .hname .pos { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); }
  .hname h1 { font-family: 'Archivo Black', sans-serif; font-size: clamp(30px, 5vw, 52px); text-transform: uppercase; margin: 4px 0 0; line-height: 0.95; }
  .plate { font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: .08em; padding: 5px 10px; border-radius: 4px; border: 1.5px solid; white-space: nowrap; }
  .plate.kept, .plate.owned { color: #b5442f; border-color: #b5442f; }
  .plate.free { color: #2f7fb8; border-color: #2f7fb8; }
  /* Phones: the status plate can't sit beside the name — let the header wrap it below. */
  @media (max-width: 560px) { .hbar { flex-wrap: wrap; gap: 10px; } .plate { white-space: normal; } }
  .sealed { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #3a352a; padding: 16px 0 4px; line-height: 1.7; }
  .coasters { display: flex; gap: 14px; flex-wrap: wrap; margin: 18px 0; }

  .chalk { background: #1a211d; border-radius: 6px; padding: 16px 18px; margin: 6px 0 4px; box-shadow: inset 0 0 0 2px rgba(216,222,230,.06); }
  .ceyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #7f9285; margin-bottom: 8px; }
  .math { font-family: 'Caveat', cursive; font-size: 26px; color: #eef4ee; }
  .math.sub { font-size: 22px; color: #cfe8d8; }
  .math b { color: var(--neon); }
  .cnote { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #9fb0a5; margin-top: 8px; line-height: 1.6; }

  .cmpbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); }
  .cmpbar input { background: rgba(255,255,255,.45); border: 1px solid rgba(28,26,22,.28); border-radius: 4px; padding: 6px 9px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink); }
  .cmpbar button { background: #2f7fb8; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; cursor: pointer; }
  .jumpnav { display: flex; flex-wrap: wrap; gap: 6px; position: sticky; top: 151px; z-index: 3; padding: 10px 0; margin-top: 8px; background: linear-gradient(var(--barroom) 78%, transparent); }
  .jumpnav button { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 20px; padding: 5px 11px; cursor: pointer; line-height: 1; }
  .jumpnav button:hover { color: var(--neon); border-color: rgba(130,201,252,.5); }
  .sheet.stub { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; margin-top: 12px; scroll-margin-top: 210px; }
  .stubhd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 6px; }
  .stubhd small { text-transform: none; font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 400; color: var(--muted); }
  .notes { width: 100%; min-height: 68px; margin-top: 6px; background: var(--barroom); border: 1px solid var(--line); border-radius: 6px; padding: 10px; font-family: 'Caveat', cursive; font-size: 17px; color: var(--chalk); resize: vertical; }
  .notes:focus { outline: 2px solid var(--neon); }

  .peers { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .peer { display: flex; align-items: center; gap: 12px; text-decoration: none; padding: 8px 10px; border-radius: 7px; border: 1px solid var(--line); background: var(--barroom); transition: border-color .15s, transform .1s; }
  .peer:hover { border-color: rgba(130,201,252,.5); transform: translateX(2px); }
  .ppos { flex: none; width: 34px; font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; font-weight: 700; letter-spacing: .06em; color: var(--muted); }
  .pname { flex: 1; font-family: 'Archivo', sans-serif; font-size: 14px; color: var(--chalk); }
  .peer:hover .pname { color: var(--neon-hot); }
  .pval { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); }
</style>
