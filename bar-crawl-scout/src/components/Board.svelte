<script>
  import { PLAYERS, BYUNAME, TAGS, TAGTXT, RYAN } from '../lib/data.js';
  import {
    windowVal, r26, r27, pts26, pts27, isAvailable, isFinalYr, ownerOf, rosterOwner,
  } from '../lib/models.js';
  import { keepers, mode, board, rosterOwn } from '../lib/store.js';
  import PlayerChip from './PlayerChip.svelte';

  const SORTS = [
    { v: 'win', l: 'WIN (overall, mode)' }, { v: 'r26', l: '2026 value' }, { v: 'r27', l: '2027 value' },
    { v: 'p26', l: '2026 points' }, { v: 'p27', l: '2027 points' }, { v: 'adp', l: 'ADP' },
  ];
  const POS = ['ALL', 'FLEX', 'RB', 'WR', 'TE', 'QB'];
  const COLS = [
    { k: 'rank', l: '#' }, { k: 'r26', l: 'R26' }, { k: 'r27', l: 'R27' }, { k: 'p26', l: 'P26' },
    { k: 'p27', l: 'P27' }, { k: 'win', l: 'WIN' }, { k: 'adp', l: 'ADP' },
  ];
  const SORT_COLS = COLS.filter((c) => c.k !== 'rank');

  let sortKey = 'win';
  let viewSort = null;
  let posFilter = 'ALL';
  let poolOnly = true;
  let hideDrafted = false;
  let q = '';
  let tagFilter = '';
  let openTag = null;

  $: ks = $keepers;
  $: md = $mode;
  $: own = $rosterOwn;
  $: bd = $board;
  $: views = bd.views;
  $: av = sortKey.indexOf('view:') === 0 ? (views.find((v) => v.id === sortKey.slice(5)) || null) : null;
  $: canOrder = !!av && !viewSort && !q;

  const tm = (p) => (p[3] === 'FA' ? 'FA' : p[3] + ' · bye ' + p[4]);
  const tagsOf = (name) => bd.tags[name] || [];
  const seedOrder = (ks, md) => PLAYERS.map((p) => ({ p, w: windowVal(p, ks, md) })).sort((a, b) => b.w - a.w).map((x) => x.p[1]);
  function reconcile(view, ks, md) {
    const names = new Set(PLAYERS.map((p) => p[1]));
    const ord = (view.order || []).filter((n) => names.has(n));
    const have = new Set(ord);
    seedOrder(ks, md).forEach((n) => { if (!have.has(n)) ord.push(n); });
    return ord;
  }

  function status(name) {
    const k = ownerOf(ks, name);
    if (k) {
      if (k.owner === RYAN) return { kind: 'classified' };
      if (k.conf === 'U') return { kind: 'watch', owner: k.owner };
      return { kind: 'keeper', cls: k.conf === 'VL' ? 'b-vl' : 'b-l', label: k.conf === 'VL' ? 'VERY LIKELY' : 'LIKELY', owner: k.owner, yr: isFinalYr(ks, name) ? 'final' : '2yr' };
    }
    const ro = rosterOwner(own, name);
    if (ro && ro !== RYAN) return { kind: 'on', owner: ro };
    return { kind: 'pool' };
  }

  function sortByKey(list, key, ks, md) {
    const dir = { win: -1, r26: -1, r27: -1, p26: -1, p27: -1, adp: 1 }[key] || -1;
    const val = (p) => key === 'win' ? windowVal(p, ks, md) : key === 'r26' ? r26(p) : key === 'r27' ? r27(p, ks) : key === 'p26' ? pts26(p) : key === 'p27' ? pts27(p, ks) : p[5];
    return list.slice().sort((a, b) => { const va = val(a), vb = val(b); if (va < vb) return -1 * dir; if (va > vb) return dir; return a[5] - b[5]; });
  }

  function computeRows(ks, md, own, bd, av, sortKey, viewSort, posFilter, poolOnly, hideDrafted, q, tagFilter) {
    let list;
    if (av) {
      list = reconcile(av, ks, md).map((n) => BYUNAME[n.toLowerCase()]).filter(Boolean);
      if (viewSort) list = sortByKey(list, viewSort, ks, md);
    } else {
      list = sortByKey(PLAYERS, sortKey, ks, md);
    }
    list = list.filter((p) => {
      if (poolOnly && !isAvailable(ks, p[1])) return false;
      if (posFilter === 'FLEX') { if (!['RB', 'WR', 'TE'].includes(p[2])) return false; }
      else if (posFilter !== 'ALL' && p[2] !== posFilter) return false;
      if (q && !p[1].toLowerCase().includes(q)) return false;
      if (tagFilter && !(bd.tags[p[1]] || []).includes(tagFilter)) return false;
      if (hideDrafted && bd.drafted.includes(p[1])) return false;
      return true;
    });
    let prevW = null;
    return list.map((p) => {
      const w = windowVal(p, ks, md), dr = bd.drafted.includes(p[1]), kept = !isAvailable(ks, p[1]);
      let tier = false;
      if (!av && sortKey === 'win' && prevW !== null && !dr && (prevW - w) >= 14) tier = true;
      if (!dr) prevW = w;
      return { p, w, dr, kept, tier };
    });
  }

  $: rows = computeRows(ks, md, own, bd, av, sortKey, viewSort, posFilter, poolOnly, hideDrafted, q, tagFilter);

  const toggleDraft = (name) => board.update((b) => { const j = b.drafted.indexOf(name); if (j >= 0) b.drafted.splice(j, 1); else b.drafted.push(name); return b; });
  const toggleTag = (name, k) => board.update((b) => { const cur = b.tags[name] || []; const i = cur.indexOf(k); if (i >= 0) cur.splice(i, 1); else cur.push(k); if (cur.length) b.tags[name] = cur; else delete b.tags[name]; return b; });

  function onSortChange(e) {
    const v = e.target.value;
    if (v === '__new') { newView(); return; }
    sortKey = v; viewSort = null; openTag = null;
    if (v.indexOf('view:') === 0) { const id = v.slice(5); board.update((b) => { const view = b.views.find((x) => x.id === id); if (view) view.order = reconcile(view, ks, md); return b; }); }
  }
  function clickCol(k) {
    if (av) { viewSort = k === 'rank' ? null : k; return; }
    if (k === 'rank') return;
    sortKey = k; viewSort = null;
  }
  function newView() {
    const name = prompt('Name your draft board (e.g. My targets):', 'Draft board ' + (views.length + 1));
    if (!name || !name.trim()) return;
    const id = 'v' + Date.now();
    const order = av ? reconcile(av, ks, md) : seedOrder(ks, md);
    board.update((b) => { b.views = [...b.views, { id, name: name.trim().slice(0, 40), order }]; return b; });
    sortKey = 'view:' + id; viewSort = null; openTag = null;
  }
  function renameView() {
    if (!av) return;
    const n = prompt('Rename this board:', av.name);
    if (n && n.trim()) board.update((b) => { const v = b.views.find((x) => x.id === av.id); if (v) v.name = n.trim().slice(0, 40); return b; });
  }
  function deleteView() {
    if (!av) return;
    if (confirm('Delete the board "' + av.name + '"? Your drafted marks stay.')) { const id = av.id; board.update((b) => { b.views = b.views.filter((v) => v.id !== id); return b; }); sortKey = 'win'; }
  }
  function resetView() {
    if (!av) return;
    if (confirm('Reset "' + av.name + '" back to the WIN order? Drafted marks and tags stay.')) { const id = av.id; board.update((b) => { const v = b.views.find((x) => x.id === id); if (v) v.order = seedOrder(ks, md); return b; }); viewSort = null; }
  }
  function backToRanking() { viewSort = null; q = ''; tagFilter = ''; posFilter = 'ALL'; poolOnly = true; }
  function move(name, act) {
    if (!av) return;
    const displayed = rows.map((r) => r.p[1]);
    const di = displayed.indexOf(name);
    if (di < 0) return;
    board.update((b) => {
      const view = b.views.find((v) => v.id === av.id); if (!view) return b;
      const ord = view.order;
      const moveBefore = (tg) => { const i = ord.indexOf(name); if (i < 0) return; ord.splice(i, 1); let j = ord.indexOf(tg); if (j < 0) j = 0; ord.splice(j, 0, name); };
      const moveAfter = (tg) => { const i = ord.indexOf(name); if (i < 0) return; ord.splice(i, 1); let j = ord.indexOf(tg); if (j < 0) j = ord.length - 1; ord.splice(j + 1, 0, name); };
      if (act === 'up' && di > 0) moveBefore(displayed[di - 1]);
      else if (act === 'dn' && di < displayed.length - 1) moveAfter(displayed[di + 1]);
      else if (act === 'top' && di > 0) moveBefore(displayed[0]);
      return b;
    });
  }
</script>

<section class="tab on">
  <div class="note"><b>One board, everything.</b> Database, rankings and live draft sheet in one. <b>WIN</b> is the master metric, sorted best to worst in the current window mode; click any column header to pivot. <b>Build your own draft board</b> from the dropdown, rank with the arrows, and the <b>draft</b> button crosses players off as they go.</div>

  <div class="toolbar">
    <select value={sortKey} on:change={onSortChange}>
      <optgroup label="Default rankings">{#each SORTS as s}<option value={s.v}>{s.l}</option>{/each}</optgroup>
      {#if views.length}<optgroup label="My draft boards">{#each views as v}<option value={'view:' + v.id}>{v.name}</option>{/each}</optgroup>{/if}
      <optgroup label="———"><option value="__new">+ Build a new draft board</option></optgroup>
    </select>
    {#if av && !canOrder}<span class="chip primary" on:click={backToRanking} role="button" tabindex="0">↕ Back to my ranking</span>{/if}
    {#if av}<span class="chip" on:click={renameView} role="button" tabindex="0">Rename</span>{/if}
    {#if av}<span class="chip" on:click={deleteView} role="button" tabindex="0">Delete</span>{/if}
    {#if av}<span class="chip" on:click={resetView} role="button" tabindex="0">Reset to WIN order</span>{/if}
    <div class="chips">
      {#each POS as pos}<span class="chip" class:on={posFilter === pos} on:click={() => (posFilter = pos)} role="button" tabindex="0">{pos === 'ALL' ? 'All pos' : pos}</span>{/each}
    </div>
    <div class="chips">
      <span class="chip" class:on={poolOnly} on:click={() => (poolOnly = !poolOnly)} role="button" tabindex="0">In pool only</span>
      <span class="chip" class:on={hideDrafted} on:click={() => (hideDrafted = !hideDrafted)} role="button" tabindex="0">Hide drafted</span>
    </div>
    <select class="tagfiltersel" bind:value={tagFilter}>
      <option value="">Filter by tag</option>{#each TAGS as t}<option value={t.k}>{t.l}</option>{/each}
    </select>
    <input class="search" placeholder="Search player..." spellcheck="false" autocomplete="off" bind:value={q} />
  </div>

  <div class="tablewrap">
    <table id="boardtable">
      <thead><tr>
        <th class="sortable" class:activesort={av && !viewSort} on:click={() => clickCol('rank')}>#</th>
        <th>Player</th><th>Status</th>
        {#each SORT_COLS as c}
          <th class="sortable" class:activesort={av ? viewSort === c.k : sortKey === c.k} on:click={() => clickCol(c.k)}>{c.l}</th>
        {/each}
        <th>Act</th>
      </tr></thead>
      <tbody>
        {#each rows as row, i (row.p[1])}
          <tr class:drafted={row.dr} class:tierrow={row.tier} class:editing={canOrder}>
            <td class="rk">
              {#if canOrder}<span class="ord"><button on:click={() => move(row.p[1], 'up')} title="Move up">▲</button><button on:click={() => move(row.p[1], 'top')} title="Send to top">⤒</button><button on:click={() => move(row.p[1], 'dn')} title="Move down">▼</button></span>{/if}
              <span class="rknum">{i + 1}</span>
            </td>
            <td>
              <span class="pname"><PlayerChip name={row.p[1]} /></span>
              <span class="pmeta">{row.p[2]} · {tm(row.p)}</span>
              {#if TAGTXT[row.p[6]]}<span class="t-pill {TAGTXT[row.p[6]][0]}">{TAGTXT[row.p[6]][1]}</span>{/if}
              {#each tagsOf(row.p[1]) as k}{@const t = TAGS.find((x) => x.k === k)}{#if t}<span class="ptag" style="background:{t.c}22;color:{t.c}">{t.l}</span>{/if}{/each}
            </td>
            <td>
              {#if status(row.p[1]).kind === 'classified'}<span class="badge b-u">🔒 CLASSIFIED</span>
              {:else if status(row.p[1]).kind === 'watch'}<span class="badge b-pool">POOL</span><span class="badge b-u">WATCH {status(row.p[1]).owner}</span>
              {:else if status(row.p[1]).kind === 'keeper'}{@const s = status(row.p[1])}<span class="badge {s.cls}">{s.label}</span> <span class="pmeta">{s.owner} · {s.yr}</span>
              {:else if status(row.p[1]).kind === 'on'}<span class="badge b-pool">POOL</span> <span class="pmeta">on {status(row.p[1]).owner}</span>
              {:else}<span class="badge b-pool">POOL</span>{/if}
            </td>
            <td class="r26">{r26(row.p)}</td>
            <td class="r27">{r27(row.p, ks)}{#if isFinalYr(ks, row.p[1])}<span class="pmeta"> repl</span>{/if}</td>
            <td class="pts">{pts26(row.p)}</td>
            <td class="pts">{pts27(row.p, ks) || '-'}</td>
            <td class="win">{row.w}</td>
            <td class="adp">{row.p[5]}</td>
            <td class="actcell">
              {#if row.kept}<span class="pmeta">kept</span>{:else}<button class="draftbtn" class:on={row.dr} on:click={() => toggleDraft(row.p[1])}>{row.dr ? '✓ drafted' : 'draft'}</button>{/if}
              <button class="tagbtn" class:has={tagsOf(row.p[1]).length} class:open={openTag === row.p[1]} title="Tag this player" on:click={() => (openTag = openTag === row.p[1] ? null : row.p[1])}>⚑</button>
            </td>
          </tr>
          {#if openTag === row.p[1]}
            <tr class="tagrow"><td></td><td colspan="9"><div class="tagpick"><span class="tglbl">Tags:</span>
              {#each TAGS as t}{@const on = tagsOf(row.p[1]).includes(t.k)}<span class="tg" class:on on:click={() => toggleTag(row.p[1], t.k)} role="button" tabindex="0" style={on ? `background:${t.c}22;color:${t.c};border-color:${t.c}` : ''}>{t.l}</span>{/each}
            </div></td></tr>
          {/if}
        {:else}
          <tr><td colspan="10" class="pmeta" style="padding:18px">No players match.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
