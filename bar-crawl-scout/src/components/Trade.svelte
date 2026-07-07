<script>
  import { PLAYERS, PICKVAL, BYUNAME } from '../lib/data.js';
  import { windowVal, pickValue, isRyanPlayer } from '../lib/models.js';
  import { esc } from '../lib/util.js';
  import { keepers, mode } from '../lib/store.js';

  $: ks = $keepers;
  $: md = $mode;

  let give = [], recv = [];
  let gp = '', gk = '', tp = '', tk = '';
  let tout = '';

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
    if (ryanHit) { tout = '<div class="out"><div class="big bd">Access denied</div>Cannot use Ryan\'s players for analysis. 🔒 The commissioner does not negotiate through your little calculator. Build a deal that does not touch his roster.</div>'; return; }
    if (!give.length && !recv.length) { tout = '<div class="out">Add assets to each side.</div>'; return; }
    const diff = T.eff - G.eff; let head, cls;
    if (Math.abs(diff) <= 8) { head = 'Fair deal'; cls = ''; }
    else if (diff > 0) { head = 'You win this by ' + diff; cls = 'gd'; }
    else { head = 'You lose this by ' + Math.abs(diff); cls = 'bd'; }
    const all = [...give.map((a) => ({ a, side: 'give' })), ...recv.map((a) => ({ a, side: 'get' }))];
    let swing = all[0]; all.forEach((x) => { if (assetVal(x.a) > assetVal(swing.a)) swing = x; });
    const lines = [];
    lines.push('<b>Why:</b> this is not 50 + 50 = 100. Each side is scored as the best asset at full value plus a scarcity premium, with every extra piece worth only 45% (you start a fixed lineup, so depth is replaceable).');
    if (swing) lines.push('The swing piece is <span class="wk">' + esc(assetLabel(swing.a)) + '</span> (value ' + assetVal(swing.a) + '), the most valuable single asset in the deal. Whoever ends with the best player usually wins the trade.');
    if (recv.length && give.length) {
      if (T.top > G.top && recv.length <= give.length) lines.push('<span class="gd">You consolidate up</span> into a bigger single asset (' + T.top + ' vs ' + G.top + '). Good player plus good pick for one great player is a win, because one stud beats two mediums in a starting lineup.');
      else if (G.top > T.top && give.length < recv.length) lines.push('<span class="bd">You de-consolidate</span>, turning your best asset (' + G.top + ') into several smaller ones (' + T.top + ' top). Only do this if you are deep and desperate for bodies.');
    }
    lines.push('Window mode <b>' + md + '</b>: ' + (md === 'winnow' ? 'final-year studs are valued for 2026 only, so buying a one-year stud for a push is cheaper here than it looks.' : md === 'balanced' ? 'two-year control is rewarded equally across both seasons.' : 'future picks and young players are weighted up.'));
    tout = '<div class="out"><div class="big ' + cls + '">' + head + '</div>You give effective <b>' + G.eff + '</b> (' + give.length + ' assets), you get effective <b>' + T.eff + '</b> (' + recv.length + ' assets).<br><br>' + lines.map((l) => '• ' + l).join('<br><br>') + '</div>';
  }
</script>

<section class="tab on">
  <div class="box"><h3>Trade builder</h3>
    <div class="note" style="margin-bottom:10px">Pick players and picks from the dropdowns. This does not add 50 + 50 = 100. Depth is discounted and the single best asset carries a scarcity premium, so consolidating up into a stud beats hoarding mediums. Picks are valued as the real player you would land after 30 keepers are off the board.</div>
    <div class="grid2">
      <div><div class="ksub">You give</div>
        <div class="siderow"><select bind:value={gp}><option value="">- player -</option>{#each playerOpts as p}<option value={p[1]}>{p[1]} ({p[2]}, {windowVal(p, ks, md)})</option>{/each}</select><button class="add" on:click={() => { addAsset('give', 'p', gp); gp = ''; }}>Add</button></div>
        <div class="siderow"><select bind:value={gk}><option value="">- pick -</option>{#each pickOpts as o}<option value={o.v}>{o.label}</option>{/each}</select><button class="add" on:click={() => { addAsset('give', 'k', gk); gk = ''; }}>Add</button></div>
        <div class="chiplist">{#each give as a, i}<span class="asset"><b>{assetVal(a)}</b> {assetLabel(a)} <span on:click={() => rm('give', i)} role="button" tabindex="0">×</span></span>{/each}</div>
        <div class="sidetot">{#if give.length}raw {G.raw} · effective <b>{G.eff}</b>{/if}</div>
      </div>
      <div><div class="ksub">You get</div>
        <div class="siderow"><select bind:value={tp}><option value="">- player -</option>{#each playerOpts as p}<option value={p[1]}>{p[1]} ({p[2]}, {windowVal(p, ks, md)})</option>{/each}</select><button class="add" on:click={() => { addAsset('get', 'p', tp); tp = ''; }}>Add</button></div>
        <div class="siderow"><select bind:value={tk}><option value="">- pick -</option>{#each pickOpts as o}<option value={o.v}>{o.label}</option>{/each}</select><button class="add" on:click={() => { addAsset('get', 'k', tk); tk = ''; }}>Add</button></div>
        <div class="chiplist">{#each recv as a, i}<span class="asset"><b>{assetVal(a)}</b> {assetLabel(a)} <span on:click={() => rm('get', i)} role="button" tabindex="0">×</span></span>{/each}</div>
        <div class="sidetot">{#if recv.length}raw {T.raw} · effective <b>{T.eff}</b>{/if}</div>
      </div>
    </div>
    <button class="go" on:click={evaluate}>Evaluate</button>
    {@html tout}
  </div>
</section>
