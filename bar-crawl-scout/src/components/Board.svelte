<script>
  import { PLAYERS, BYUNAME, TAGS, TAGTXT, RYAN } from '../lib/data.js';
  import {
    windowVal, r26, r27, pts26, pts27, isAvailable, isFinalYr, ownerOf, rosterOwner,
  } from '../lib/models.js';
  import { keepers, mode, board, rosterOwn, unlocked } from '../lib/store.js';
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

  function status(name, unlockedVal) {
    const k = ownerOf(ks, name);
    if (k) {
      if (k.owner === RYAN && !unlockedVal) return { kind: 'classified' };
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
  <div class="note"><b>WIN</b> ranks everyone for your window; click any header to re-sort. <b>Build a draft board</b> from the dropdown to rank your own way — the <b>draft</b> button crosses players off live.</div>

  <div class="toolbar">
    <select value={sortKey} on:change={onSortChange}>
      <optgroup label="Default rankings">{#each SORTS as s}<option value={s.v}>{s.l}</option>{/each}</optgroup>
      {#if views.length}<optgroup label="My draft boards">{#each views as v}<option value={'view:' + v.id}>{v.name}</option>{/each}</optgroup>{/if}
      <optgroup label="———"><option value="__new">+ Build a new draft board</option></optgroup>
    </select>
    {#if av && !canOrder}<button type="button" class="chip primary" on:click={backToRanking}>↕ Back to my ranking</button>{/if}
    {#if av}<button type="button" class="chip" on:click={renameView}>Rename</button>{/if}
    {#if av}<button type="button" class="chip" on:click={deleteView}>Delete</button>{/if}
    {#if av}<button type="button" class="chip" on:click={resetView}>Reset to WIN order</button>{/if}
    <div class="chips">
      {#each POS as pos}<button type="button" class="chip" class:on={posFilter === pos} on:click={() => (posFilter = pos)}>{pos === 'ALL' ? 'All pos' : pos}</button>{/each}
    </div>
    <div class="chips">
      <button type="button" class="chip" class:on={poolOnly} on:click={() => (poolOnly = !poolOnly)}>In pool only</button>
      <button type="button" class="chip" class:on={hideDrafted} on:click={() => (hideDrafted = !hideDrafted)}>Hide drafted</button>
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
          {@const st = status(row.p[1], $unlocked)}
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
              {#if st.kind === 'classified'}<span class="badge b-u">🔒 CLASSIFIED</span>
              {:else if st.kind === 'watch'}<span class="badge b-pool">POOL</span><span class="badge b-u">WATCH {st.owner}</span>
              {:else if st.kind === 'keeper'}<span class="badge {st.cls}">{st.label}</span> <span class="pmeta">{st.owner} · {st.yr}</span>
              {:else if st.kind === 'on'}<span class="badge b-pool">POOL</span> <span class="pmeta">on {st.owner}</span>
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
              {#each TAGS as t}{@const on = tagsOf(row.p[1]).includes(t.k)}<button type="button" class="tg" class:on on:click={() => toggleTag(row.p[1], t.k)} style={on ? `background:${t.c}22;color:${t.c};border-color:${t.c}` : ''}>{t.l}</button>{/each}
            </div></td></tr>
          {/if}
        {:else}
          <tr><td colspan="10" class="pmeta" style="padding:18px">No players match.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  /* The Big Board owns its table styling (shared primitives like .box/.note/
     .toolbar/.chip stay global). Colour-variant leaf classes applied via
     template literals (b-vl/b-l/t-*) are :global so Svelte won't prune them. */
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { font-family: var(--mono); font-size: 11px; line-height: 1; border: 1px solid var(--line); background: var(--field-2); color: var(--muted); border-radius: 20px; padding: 7px 13px; cursor: pointer; }
  .chip.on { background: var(--accent); color: var(--on-neon); border-color: var(--accent); }
  .chip.primary { background: var(--accent); color: var(--on-neon); border-color: var(--accent); font-weight: 700; }
  .chip.primary:hover { filter: brightness(1.08); }

  .tablewrap { width: 100%; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: 12.5px; }
  thead th { position: sticky; top: 151px; background: var(--field-3); color: var(--muted); font-weight: 500; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; text-align: right; padding: 10px 9px; border-bottom: 1px solid var(--line); z-index: 4; white-space: nowrap; }
  thead th:nth-child(2) { text-align: left; }
  thead th.sortable { cursor: pointer; user-select: none; }
  thead th.sortable:hover { color: var(--chalk); }
  thead th.activesort { color: var(--accent); }
  tbody td { padding: 9px 9px; border-bottom: 1px solid var(--line); vertical-align: middle; text-align: right; white-space: nowrap; }
  tbody td:nth-child(2) { text-align: left; white-space: normal; }
  tbody tr:nth-child(odd) { background: rgba(255,255,255,.014); }
  tbody tr.drafted { opacity: .34; }
  tbody tr.drafted .pname { text-decoration: line-through; }
  tbody tr.tierrow td { border-top: 2px solid rgba(244,178,62,.4); }

  .rk { color: var(--muted); font-size: 11px; }
  td.rk { white-space: nowrap; }
  td.rk .rknum { vertical-align: middle; font-family: var(--mono); color: var(--muted); }
  tr.editing td.rk { background: rgba(244,178,62,.05); }
  .pname { font-family: var(--body); font-weight: 600; color: var(--chalk); font-size: 13.5px; }
  .r26 { color: var(--good); font-weight: 700; }
  .r27 { color: var(--cool); font-weight: 700; }
  .pts { color: var(--chalk); }
  .adp { color: var(--muted); }
  .win { font-family: var(--display); font-weight: 800; font-size: 17px; color: var(--accent); }

  .badge { display: inline-block; font-family: var(--display); font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: .03em; border-radius: 4px; padding: 2px 5px; margin-left: 4px; }
  .b-pool { background: rgba(79,178,134,.13); color: #7fcfa6; border: 1px solid rgba(79,178,134,.4); }
  .b-u { background: rgba(244,178,62,.12); color: #e8c074; border: 1px solid rgba(244,178,62,.35); }
  :global(.b-vl) { background: rgba(224,97,63,.16); color: #e89178; border: 1px solid rgba(224,97,63,.45); }
  :global(.b-l) { background: rgba(169,143,214,.14); color: #c3aee6; border: 1px solid rgba(169,143,214,.4); }

  .t-pill { display: inline-block; font-family: var(--mono); font-size: 9px; padding: 1px 5px; border-radius: 4px; margin-left: 4px; }
  :global(.t-riser) { background: rgba(244,178,62,.14); color: var(--accent); }
  :global(.t-winnow) { background: rgba(90,160,224,.14); color: var(--cool); }
  :global(.t-prime) { background: rgba(79,178,134,.14); color: var(--good); }
  :global(.t-rookie) { background: rgba(169,143,214,.14); color: var(--purp); }

  .ord { display: inline-flex; flex-direction: column; gap: 2px; vertical-align: middle; margin-right: 8px; }
  .ord button { font-family: var(--mono); background: rgba(244,178,62,.12); border: 1px solid var(--accent); color: var(--accent); border-radius: 5px; width: 30px; height: 22px; font-size: 11px; cursor: pointer; padding: 0; line-height: 1; display: flex; align-items: center; justify-content: center; }
  .ord button:hover { background: var(--accent); color: var(--on-neon); }
  .draftbtn { font-family: var(--mono); font-size: 10px; border-radius: 6px; padding: 5px 10px; border: 1px solid var(--line); background: var(--field-2); color: var(--muted); cursor: pointer; }
  .draftbtn.on { background: rgba(224,97,63,.2); color: #e89178; border-color: rgba(224,97,63,.5); }
  .actcell { white-space: nowrap; }
  .ptag { display: inline-block; font-family: var(--mono); font-size: 9px; font-weight: 700; letter-spacing: .04em; padding: 1px 5px; border-radius: 4px; margin-left: 5px; vertical-align: middle; }
  .tagbtn { font-size: 12px; line-height: 1; border-radius: 6px; padding: 4px 7px; border: 1px solid var(--line); background: var(--field-2); color: var(--muted); cursor: pointer; margin-left: 2px; }
  .tagbtn.has { color: var(--accent); border-color: rgba(244,178,62,.45); }
  .tagbtn.open { background: rgba(244,178,62,.16); color: var(--accent); border-color: var(--accent); }
  .tagrow td { background: rgba(244,178,62,.05); border-top: none; }
  .tagpick { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; padding: 7px 2px; }
  .tagpick .tglbl { font-family: var(--mono); font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-right: 2px; }
  .tagpick .tg { font-family: var(--mono); font-size: 11px; line-height: 1; padding: 6px 11px; border-radius: 16px; border: 1px solid var(--line); background: var(--field-2); color: var(--muted); cursor: pointer; user-select: none; }
  .tagpick .tg:hover { color: var(--chalk); }
  select.tagfiltersel { font-family: var(--mono); font-size: 12px; background: var(--field-2); color: var(--chalk); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; cursor: pointer; }

  @media (max-width: 760px) {
    thead th { top: 0; font-size: 9px; padding: 8px 7px; position: static; }
    .tablewrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    tbody td { padding: 8px 7px; }
    table { font-size: 11.5px; }
    .win { font-size: 15px; }
    .pname { font-size: 12.5px; }
    #boardtable th:nth-child(6), #boardtable td:nth-child(6),
    #boardtable th:nth-child(7), #boardtable td:nth-child(7),
    #boardtable th:nth-child(9), #boardtable td:nth-child(9) { display: none; }
    .chips { width: 100%; }
    .ord button { width: 30px; height: 30px; }
    .draftbtn { padding: 6px 10px; }
  }
  @media (max-width: 420px) {
    #boardtable th:nth-child(8), #boardtable td:nth-child(8) { font-size: 13px; }
  }
</style>
