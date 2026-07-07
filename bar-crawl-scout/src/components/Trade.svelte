<script>
  import { PLAYERS, PICKVAL, BYUNAME } from '../lib/data.js';
  import { windowVal, pickValue, isRyanPlayer } from '../lib/models.js';
  import { keepers, mode } from '../lib/store.js';
  import Receipt from './Receipt.svelte';
  import Stamp from './Stamp.svelte';
  import PlayerChip from './PlayerChip.svelte';

  $: ks = $keepers;
  $: md = $mode;

  let give = [], recv = [];
  let gp = '', gk = '', tp = '', tk = '';
  let result = null;

  $: playerOpts = PLAYERS.slice().sort((a, b) => windowVal(b, ks, md) - windowVal(a, ks, md));
  $: pickOpts = (() => { const o = []; for (const yr of ['2026', '2027']) for (const rd in PICKVAL[yr]) o.push({ v: yr + ':' + rd, label: yr + ' R' + rd + ' (~' + pickValue(yr, +rd, ks, md) + ')' }); return o; })();

  const assetVal = (a) => a.kind === 'p' ? (BYUNAME[a.key.toLowerCase()] ? windowVal(BYUNAME[a.key.toLowerCase()], ks, md) : 0) : pickValue(a.key.split(':')[0], +a.key.split(':')[1], ks, md);
  const assetLabel = (a) => a.kind === 'p' ? a.key : (a.key.split(':')[0] + ' R' + a.key.split(':')[1]);
  const prem = (v) => v >= 180 ? 1.18 : v >= 150 ? 1.12 : v >= 120 ? 1.06 : 1.0;
  function sideEval(arr) { const vals = arr.map(assetVal).sort((a, b) => b - a); if (!vals.length) return { raw: 0, eff: 0, top: 0, count: 0 }; let eff = vals[0] * prem(vals[0]); for (let i = 1; i < vals.length; i++) eff += vals[i] * 0.45; return { raw: vals.reduce((s, v) => s + v, 0), eff: Math.round(eff), top: vals[0], count: vals.length }; }

  $: G = sideEval(give);
  $: T = sideEval(recv);

  const addAsset = (side, kind, val) => { if (!val) return; if (side === 'give') give = [...give, { kind, key: val }]; else recv = [...recv, { kind, key: val }]; };
  const rm = (side, i) => { if (side === 'give') give = give.filter((_, j) => j !== i); else recv = recv.filter((_, j) => j !== i); };

  function evaluate() {
    const ryanHit = [...give, ...recv].some((a) => a.kind === 'p' && isRyanPlayer(ks, a.key));
    if (ryanHit) { result = { blocked: true }; return; }
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
  <div class="box"><h3>Trade builder</h3>
    <div class="note" style="margin-bottom:10px">Pick players and picks from the dropdowns. This does not add 50 + 50 = 100. Depth is discounted and the single best asset carries a scarcity premium, so consolidating up into a stud beats hoarding mediums. Picks are valued as the real player you would land after 30 keepers are off the board.</div>
    <div class="grid2">
      <div><div class="ksub">You give</div>
        <div class="siderow"><select bind:value={gp}><option value="">- player -</option>{#each playerOpts as p}<option value={p[1]}>{p[1]} ({p[2]}, {windowVal(p, ks, md)})</option>{/each}</select><button class="add" on:click={() => { addAsset('give', 'p', gp); gp = ''; }}>Add</button></div>
        <div class="siderow"><select bind:value={gk}><option value="">- pick -</option>{#each pickOpts as o}<option value={o.v}>{o.label}</option>{/each}</select><button class="add" on:click={() => { addAsset('give', 'k', gk); gk = ''; }}>Add</button></div>
        <div class="chiplist">{#each give as a, i}<span class="asset"><b>{assetVal(a)}</b> {#if a.kind === 'p'}<PlayerChip name={a.key} />{:else}{assetLabel(a)}{/if} <button type="button" class="rm" on:click={() => rm('give', i)} aria-label="Remove">×</button></span>{/each}</div>
        <div class="sidetot">{#if give.length}raw {G.raw} · effective <b>{G.eff}</b>{/if}</div>
      </div>
      <div><div class="ksub">You get</div>
        <div class="siderow"><select bind:value={tp}><option value="">- player -</option>{#each playerOpts as p}<option value={p[1]}>{p[1]} ({p[2]}, {windowVal(p, ks, md)})</option>{/each}</select><button class="add" on:click={() => { addAsset('get', 'p', tp); tp = ''; }}>Add</button></div>
        <div class="siderow"><select bind:value={tk}><option value="">- pick -</option>{#each pickOpts as o}<option value={o.v}>{o.label}</option>{/each}</select><button class="add" on:click={() => { addAsset('get', 'k', tk); tk = ''; }}>Add</button></div>
        <div class="chiplist">{#each recv as a, i}<span class="asset"><b>{assetVal(a)}</b> {#if a.kind === 'p'}<PlayerChip name={a.key} />{:else}{assetLabel(a)}{/if} <button type="button" class="rm" on:click={() => rm('get', i)} aria-label="Remove">×</button></span>{/each}</div>
        <div class="sidetot">{#if recv.length}raw {T.raw} · effective <b>{T.eff}</b>{/if}</div>
      </div>
    </div>
    <button class="go" on:click={evaluate}>Evaluate</button>

    {#if result}
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
    {/if}
  </div>
</section>

<style>
  .asset .rm { background: none; border: none; color: var(--muted); font-weight: 700; font-size: 15px; line-height: 1; cursor: pointer; padding: 2px 6px; margin: -4px -4px -4px 0; border-radius: 4px; }
  .asset .rm:hover { color: var(--stamp-red); background: rgba(214,69,60,.12); }
  .why .up { color: #2e7d46; font-weight: 700; }
  .why .down { color: #b5442f; font-weight: 700; }
  .rsection { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #5a5238; margin-bottom: 3px; }
  .rgap { height: 12px; }
  .verdict { display: flex; justify-content: center; margin: 16px 0 4px; }
</style>
