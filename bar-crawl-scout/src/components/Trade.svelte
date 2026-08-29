<script>
  import { createQuery } from '@tanstack/svelte-query';
  import { PLAYERS, BYUNAME, TEAMS, TEAMSHORT, byName } from '../lib/data.js';
  import { windowVal, pickValue, isRyanPlayer } from '../lib/models.js';
  import { keepers, mode, unlocked } from '../lib/store.js';
  import { usersQuery, rostersQuery, realDraftQuery } from '../api/queries';
  import { userHandleMap, draftSlotBoard } from '../api/league';
  import Receipt from './Receipt.svelte';
  import Stamp from './Stamp.svelte';
  import PlayerChip from './PlayerChip.svelte';

  $: ks = $keepers;
  $: md = $mode;

  let give = [], recv = [];
  let gp = '', gk = '', tp = '', tk = '';
  let result = null;

  $: playerOpts = PLAYERS.slice().sort((a, b) => windowVal(b, ks, md) - windowVal(a, ks, md));

  // ---- the real board, so a pick is priced at ITS OWN seat ----
  //
  // A pick used to be identified by (season, round) alone and priced as if it
  // sat at slot 4 on a linear board — Ryan's seat. So swapping his second for a
  // slot-1 team's second read as an even deal when they are three picks apart,
  // and the error flipped sign every round because the draft snakes.
  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const realQ = createQuery(realDraftQuery());
  $: slotBoard = draftSlotBoard($realQ.data?.draft, $realQ.data?.traded, $usersQ.data || [], $rostersQ.data || []);
  $: teams = slotBoard?.teams || TEAMS.length;
  $: boardType = slotBoard?.type || 'snake';
  $: thisSeason = Number($realQ.data?.draft?.season || 2026);
  $: draftRounds = $realQ.data?.draft?.settings?.rounds || 15;
  $: maxKeepers = 3;
  // Rounds anybody actually picks in. The old table stopped at 10, so the three
  // round-11 trades and the round-12 trade in this league could not be entered
  // at all; and it would happily price rounds 13-15, which are keeper rounds.
  $: liveRounds = Math.max(1, draftRounds - maxKeepers);
  // A pick key is season:round:handle — the handle naming whose seat it is.
  //
  // Every dependency is named INSIDE this block on purpose. Svelte tracks what a
  // reactive statement references syntactically, not what the functions it calls
  // reach for, so calling a helper that closed over `slotBoard` left this list
  // computed once with no board and never recomputed — every seat priced
  // identically, which is exactly the bug the seats were added to fix.
  $: pickOpts = ((slots, tm, ty, season, rounds, keeperMap, windowMode) => {
    const o = [];
    for (const yr of [String(season), String(season + 1)]) {
      for (let rd = 1; rd <= rounds; rd++) {
        for (const [h] of TEAMS) {
          const i = slots.indexOf(h);
          const price = pickValue(yr, rd, keeperMap, windowMode, {
            slot: i >= 0 ? i + 1 : null, teams: tm, type: ty, season,
          });
          o.push({ v: `${yr}:${rd}:${h}`, label: `${yr} R${rd} · ${TEAMSHORT[h] || h} (~${price})` });
        }
      }
    }
    return o;
  })(slotBoard?.slotHandles || [], teams, boardType, thisSeason, liveRounds, ks, md);

  // Same care here: assetVal is called from markup, which re-runs on any change,
  // so it may read the reactive values directly.
  function priceOf(season, round, handle) {
    const i = (slotBoard?.slotHandles || []).indexOf(handle);
    return pickValue(season, round, ks, md, {
      slot: i >= 0 ? i + 1 : null, teams, type: boardType, season: thisSeason,
    });
  }

  const parsePick = (key) => { const [yr, rd, h] = String(key).split(':'); return { yr, rd: +rd, h: h || null }; };
  const assetVal = (a) => {
    if (a.kind === 'p') { const row = byName(a.key); return row ? windowVal(row, ks, md) : 0; }
    const { yr, rd, h } = parsePick(a.key);
    return priceOf(yr, rd, h);
  };
  const assetLabel = (a) => {
    if (a.kind === 'p') return a.key;
    const { yr, rd, h } = parsePick(a.key);
    return `${yr} R${rd}${h ? ` (${TEAMSHORT[h] || h})` : ''}`;
  };
  const prem = (v) => v >= 180 ? 1.18 : v >= 150 ? 1.12 : v >= 120 ? 1.06 : 1.0;
  function sideEval(arr) { const vals = arr.map(assetVal).sort((a, b) => b - a); if (!vals.length) return { raw: 0, eff: 0, top: 0, count: 0 }; let eff = vals[0] * prem(vals[0]); for (let i = 1; i < vals.length; i++) eff += vals[i] * 0.45; return { raw: vals.reduce((s, v) => s + v, 0), eff: Math.round(eff), top: vals[0], count: vals.length }; }

  $: G = sideEval(give);
  $: T = sideEval(recv);

  const addAsset = (side, kind, val) => { if (!val) return; if (side === 'give') give = [...give, { kind, key: val }]; else recv = [...recv, { kind, key: val }]; };
  const rm = (side, i) => { if (side === 'give') give = give.filter((_, j) => j !== i); else recv = recv.filter((_, j) => j !== i); };

  function evaluate() {
    const ryanHit = [...give, ...recv].some((a) => a.kind === 'p' && isRyanPlayer(ks, a.key));
    if (ryanHit && !$unlocked) { result = { blocked: true }; return; }
    if (!give.length && !recv.length) { result = { empty: true }; return; }
    const diff = T.eff - G.eff;
    let head, tone;
    if (Math.abs(diff) <= 8) { head = 'FAIR POUR'; tone = 'ink'; }
    else if (diff > 0) { head = `YOU WIN BY ${diff}`; tone = 'neon'; }
    else { head = `FLEECED BY ${Math.abs(diff)}`; tone = 'red'; }
    const all = [...give, ...recv];
    let swing = all[0]; all.forEach((a) => { if (assetVal(a) > assetVal(swing)) swing = a; });
    // Each rationale is an array of {t, b?, cls?} segments — rendered as markup, no {@html}.
    const whys = [];
    whys.push([{ t: 'Not 50 + 50 = 100. Best asset at full value + a scarcity premium; every extra piece worth 45% (you start a fixed lineup).' }]);
    if (swing) whys.push([{ t: 'Swing piece: ' }, { t: assetLabel(swing), b: true }, { t: ` (${assetVal(swing)}). Whoever ends with the best player usually wins.` }]);
    if (recv.length && give.length) {
      if (T.top > G.top && recv.length <= give.length) whys.push([{ t: 'Consolidating up', cls: 'up' }, { t: ` into a bigger single asset (${T.top} vs ${G.top}).` }]);
      else if (G.top > T.top && give.length < recv.length) whys.push([{ t: 'De-consolidating', cls: 'down' }, { t: ` your best asset (${G.top}) into smaller pieces (${T.top} top).` }]);
    }
    whys.push([{ t: 'Window ' }, { t: md, b: true }, { t: ': ' + (md === 'winnow' ? 'final-year studs valued for 2026 only.' : md === 'balanced' ? 'both seasons rewarded equally.' : 'future picks and youth weighted up.') }]);
    result = {
      head, tone, diff,
      give: give.map((a) => ({ label: assetLabel(a), val: assetVal(a) })),
      recv: recv.map((a) => ({ label: assetLabel(a), val: assetVal(a) })),
      Geff: G.eff, Teff: T.eff, whys,
    };
  }
</script>

<section class="tab on">
  <div class="tradewrap">
  <div class="box">
    <div class="note" style="margin-bottom:10px">Pick players and picks from the dropdowns. This does not add 50 + 50 = 100. Depth is discounted and the single best asset carries a scarcity premium, so consolidating up into a stud beats hoarding mediums. Picks are valued as the real player you would land after 30 keepers are off the board — at <b>that pick's own seat</b>, on the snake, so a round-2 pick from slot 1 and one from slot 10 are not the same asset.</div>
    <div class="grid2">
      <div><div class="ksub">You give</div>
        <div class="siderow"><select bind:value={gp}><option value="">- player -</option>{#each playerOpts as p}<option value={p[1]}>{p[1]} ({p[2]}, {windowVal(p, ks, md)})</option>{/each}</select><button class="add" on:click={() => { addAsset('give', 'p', gp); gp = ''; }}>Add</button></div>
        <div class="siderow"><select data-testid="pick-give" bind:value={gk}><option value="">- pick -</option>{#each pickOpts as o}<option value={o.v}>{o.label}</option>{/each}</select><button class="add" on:click={() => { addAsset('give', 'k', gk); gk = ''; }}>Add</button></div>
        <div class="chiplist">{#each give as a, i}<span class="asset"><b>{assetVal(a)}</b> {#if a.kind === 'p'}<PlayerChip name={a.key} />{:else}{assetLabel(a)}{/if} <button type="button" class="rm" on:click={() => rm('give', i)} aria-label="Remove">×</button></span>{/each}</div>
        <div class="sidetot">{#if give.length}raw {G.raw} · effective <b>{G.eff}</b>{/if}</div>
      </div>
      <div><div class="ksub">You get</div>
        <div class="siderow"><select bind:value={tp}><option value="">- player -</option>{#each playerOpts as p}<option value={p[1]}>{p[1]} ({p[2]}, {windowVal(p, ks, md)})</option>{/each}</select><button class="add" on:click={() => { addAsset('get', 'p', tp); tp = ''; }}>Add</button></div>
        <div class="siderow"><select data-testid="pick-get" bind:value={tk}><option value="">- pick -</option>{#each pickOpts as o}<option value={o.v}>{o.label}</option>{/each}</select><button class="add" on:click={() => { addAsset('get', 'k', tk); tk = ''; }}>Add</button></div>
        <div class="chiplist">{#each recv as a, i}<span class="asset"><b>{assetVal(a)}</b> {#if a.kind === 'p'}<PlayerChip name={a.key} />{:else}{assetLabel(a)}{/if} <button type="button" class="rm" on:click={() => rm('get', i)} aria-label="Remove">×</button></span>{/each}</div>
        <div class="sidetot">{#if recv.length}raw {T.raw} · effective <b>{T.eff}</b>{/if}</div>
      </div>
    </div>
    <button class="go" on:click={evaluate}>Evaluate</button>
  </div>

  {#if result}
    <div class="verdictcol">
      {#if result.blocked}
        <div class="out"><div class="big bd">Access denied</div>Cannot use Ryan's players. 🔒 The commissioner does not negotiate through your little calculator.</div>
      {:else if result.empty}
        <div class="out">The table's empty. Deal someone in.</div>
      {:else}
        <Receipt heading="Trade Verdict" subhead="Bar Crawl Order · Trade Machine">
          <div class="rsection">You give</div>
          {#each result.give as g}<div class="line"><span>{g.label}</span><b>{g.val}</b></div>{/each}
          <div class="tot"><span>Effective</span><span>{result.Geff}</span></div>
          <div class="rgap"></div>
          <div class="rsection">You get</div>
          {#each result.recv as g}<div class="line"><span>{g.label}</span><b>{g.val}</b></div>{/each}
          <div class="tot"><span>Effective</span><span>{result.Teff}</span></div>
          <div class="rgap"></div>
          {#each result.whys as w}<p class="why">• {#each w as s}{#if s.b}<b>{s.t}</b>{:else if s.cls}<span class={s.cls}>{s.t}</span>{:else}{s.t}{/if}{/each}</p>{/each}
          <div class="verdict"><Stamp text={result.head} tone={result.tone} big seed={result.diff} /></div>
          <span slot="foot">* * * {result.head} * * *</span>
        </Receipt>
      {/if}
    </div>
  {/if}
  </div>
</section>

<style>
  /* Builder on the left, the printed verdict beside it once there's a deal. */
  .tradewrap { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px; align-items: start; }
  .tradewrap > :global(.box) { min-width: 0; margin-bottom: 0; }
  .verdictcol { min-width: 0; }
  .verdictcol :global(.out) { margin-top: 0; }
  .asset .rm { background: none; border: none; color: var(--muted); font-weight: 700; font-size: 15px; line-height: 1; cursor: pointer; padding: 2px 6px; margin: -4px -4px -4px 0; border-radius: 4px; }
  .asset .rm:hover { color: var(--stamp-red); background: rgba(214,69,60,.12); }
  .why .up { color: #2e7d46; font-weight: 700; }
  .why .down { color: #b5442f; font-weight: 700; }
  .rsection { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #5a5238; margin-bottom: 3px; }
  .rgap { height: 12px; }
  .verdict { display: flex; justify-content: center; margin: 16px 0 4px; }
</style>
