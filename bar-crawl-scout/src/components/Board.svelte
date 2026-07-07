<script>
  import { PLAYERS, TAGS, TAGTXT, RYAN } from '../lib/data.js';
  import {
    windowVal, r26, r27, pts26, pts27, isAvailable, isFinalYr, ownerOf, rosterOwner,
  } from '../lib/models.js';
  import { keepers, mode, board, rosterOwn } from '../lib/store.js';

  const SORTS = [
    { v: 'win', l: 'WIN (overall, mode)' },
    { v: 'r26', l: '2026 value' },
    { v: 'r27', l: '2027 value' },
    { v: 'p26', l: '2026 points' },
    { v: 'p27', l: '2027 points' },
    { v: 'adp', l: 'ADP' },
  ];
  const POS = ['ALL', 'FLEX', 'RB', 'WR', 'TE', 'QB'];
  const SORT_COLS = [
    { k: 'r26', l: 'R26' }, { k: 'r27', l: 'R27' }, { k: 'p26', l: 'P26' },
    { k: 'p27', l: 'P27' }, { k: 'win', l: 'WIN' }, { k: 'adp', l: 'ADP' },
  ];

  let sortKey = 'win';
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

  const tm = (p) => (p[3] === 'FA' ? 'FA' : p[3] + ' · bye ' + p[4]);
  const tagsOf = (name) => bd.tags[name] || [];

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

  function computeRows(ks, md, own, bd, sortKey, posFilter, poolOnly, hideDrafted, q, tagFilter) {
    let list = PLAYERS.filter((p) => {
      if (poolOnly && !isAvailable(ks, p[1])) return false;
      if (posFilter === 'FLEX') { if (!['RB', 'WR', 'TE'].includes(p[2])) return false; }
      else if (posFilter !== 'ALL' && p[2] !== posFilter) return false;
      if (q && !p[1].toLowerCase().includes(q)) return false;
      if (tagFilter && !(bd.tags[p[1]] || []).includes(tagFilter)) return false;
      if (hideDrafted && bd.drafted.includes(p[1])) return false;
      return true;
    });
    const dir = { win: -1, r26: -1, r27: -1, p26: -1, p27: -1, adp: 1 }[sortKey] || -1;
    const val = (p) => sortKey === 'win' ? windowVal(p, ks, md) : sortKey === 'r26' ? r26(p) : sortKey === 'r27' ? r27(p, ks) : sortKey === 'p26' ? pts26(p) : sortKey === 'p27' ? pts27(p, ks) : p[5];
    list = list.slice().sort((a, b) => { const va = val(a), vb = val(b); if (va < vb) return -1 * dir; if (va > vb) return dir; return a[5] - b[5]; });
    let prevW = null;
    return list.map((p) => {
      const w = windowVal(p, ks, md), dr = bd.drafted.includes(p[1]), kept = !isAvailable(ks, p[1]);
      let tier = false;
      if (sortKey === 'win' && prevW !== null && !dr && (prevW - w) >= 14) tier = true;
      if (!dr) prevW = w;
      return { p, w, dr, kept, tier };
    });
  }

  $: rows = computeRows(ks, md, own, bd, sortKey, posFilter, poolOnly, hideDrafted, q, tagFilter);

  function toggleDraft(name) {
    board.update((b) => { const j = b.drafted.indexOf(name); if (j >= 0) b.drafted.splice(j, 1); else b.drafted.push(name); return b; });
  }
  function toggleTag(name, k) {
    board.update((b) => { const cur = b.tags[name] || []; const i = cur.indexOf(k); if (i >= 0) cur.splice(i, 1); else cur.push(k); if (cur.length) b.tags[name] = cur; else delete b.tags[name]; return b; });
  }
</script>

<section class="tab on">
  <div class="note"><b>One board, everything.</b> Database, rankings and live draft sheet in one. <b>WIN</b> is the master metric, sorted best to worst in the current window mode; click any column header to pivot. The <b>draft</b> button crosses players off as they go.</div>

  <div class="toolbar">
    <select bind:value={sortKey}>
      {#each SORTS as s}<option value={s.v}>{s.l}</option>{/each}
    </select>
    <div class="chips">
      {#each POS as pos}
        <span class="chip" class:on={posFilter === pos} on:click={() => (posFilter = pos)} role="button" tabindex="0">{pos === 'ALL' ? 'All pos' : pos}</span>
      {/each}
    </div>
    <div class="chips">
      <span class="chip" class:on={poolOnly} on:click={() => (poolOnly = !poolOnly)} role="button" tabindex="0">In pool only</span>
      <span class="chip" class:on={hideDrafted} on:click={() => (hideDrafted = !hideDrafted)} role="button" tabindex="0">Hide drafted</span>
    </div>
    <select class="tagfiltersel" bind:value={tagFilter}>
      <option value="">Filter by tag</option>
      {#each TAGS as t}<option value={t.k}>{t.l}</option>{/each}
    </select>
    <input class="search" placeholder="Search player..." spellcheck="false" autocomplete="off" bind:value={q} />
  </div>

  <div class="tablewrap">
    <table id="boardtable">
      <thead><tr>
        <th>#</th><th>Player</th><th>Status</th>
        {#each SORT_COLS as c}
          <th class="sortable" class:activesort={sortKey === c.k} on:click={() => (sortKey = c.k)}>{c.l}</th>
        {/each}
        <th>Act</th>
      </tr></thead>
      <tbody>
        {#each rows as row, i (row.p[1])}
          <tr class:drafted={row.dr} class:tierrow={row.tier}>
            <td class="rk"><span class="rknum">{i + 1}</span></td>
            <td>
              <span class="pname">{row.p[1]}</span>
              <span class="pmeta">{row.p[2]} · {tm(row.p)}</span>
              {#if TAGTXT[row.p[6]]}<span class="t-pill {TAGTXT[row.p[6]][0]}">{TAGTXT[row.p[6]][1]}</span>{/if}
              {#each tagsOf(row.p[1]) as k}{@const t = TAGS.find((x) => x.k === k)}{#if t}<span class="ptag" style="background:{t.c}22;color:{t.c}">{t.l}</span>{/if}{/each}
            </td>
            <td>
              {#if status(row.p[1]).kind === 'classified'}
                <span class="badge b-u">🔒 CLASSIFIED</span>
              {:else if status(row.p[1]).kind === 'watch'}
                <span class="badge b-pool">POOL</span><span class="badge b-u">WATCH {status(row.p[1]).owner}</span>
              {:else if status(row.p[1]).kind === 'keeper'}
                {@const s = status(row.p[1])}
                <span class="badge {s.cls}">{s.label}</span> <span class="pmeta">{s.owner} · {s.yr}</span>
              {:else if status(row.p[1]).kind === 'on'}
                <span class="badge b-pool">POOL</span> <span class="pmeta">on {status(row.p[1]).owner}</span>
              {:else}
                <span class="badge b-pool">POOL</span>
              {/if}
            </td>
            <td class="r26">{r26(row.p)}</td>
            <td class="r27">{r27(row.p, ks)}{#if isFinalYr(ks, row.p[1])}<span class="pmeta"> repl</span>{/if}</td>
            <td class="pts">{pts26(row.p)}</td>
            <td class="pts">{pts27(row.p, ks) || '-'}</td>
            <td class="win">{row.w}</td>
            <td class="adp">{row.p[5]}</td>
            <td class="actcell">
              {#if row.kept}
                <span class="pmeta">kept</span>
              {:else}
                <button class="draftbtn" class:on={row.dr} on:click={() => toggleDraft(row.p[1])}>{row.dr ? '✓ drafted' : 'draft'}</button>
              {/if}
              <button class="tagbtn" class:has={tagsOf(row.p[1]).length} class:open={openTag === row.p[1]} title="Tag this player" on:click={() => (openTag = openTag === row.p[1] ? null : row.p[1])}>⚑</button>
            </td>
          </tr>
          {#if openTag === row.p[1]}
            <tr class="tagrow"><td></td><td colspan="9"><div class="tagpick"><span class="tglbl">Tags:</span>
              {#each TAGS as t}
                {@const on = tagsOf(row.p[1]).includes(t.k)}
                <span class="tg" class:on on:click={() => toggleTag(row.p[1], t.k)} role="button" tabindex="0" style={on ? `background:${t.c}22;color:${t.c};border-color:${t.c}` : ''}>{t.l}</span>
              {/each}
            </div></td></tr>
          {/if}
        {:else}
          <tr><td colspan="10" class="pmeta" style="padding:18px">No players match.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
