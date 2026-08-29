<script>
  // THE SHEET — a hidden draft board, re-scored under THIS league's rulebook.
  //
  // Not in nav.js on purpose. It exists at /sheet and nothing links to it.
  //
  // The premise: a stock ranking is misleading here. Our league pays SIX for a
  // passing TD (stock is four), half a point per rushing AND receiving first
  // down, and stacks fum on fum_lost. So every player is scored per game under
  // the league's own scoring_settings — pulled live, never transcribed — and
  // shown against a stock half-PPR baseline so you can see how far he moves.
  //
  // OFFENCE ONLY, deliberately. The league does start an IDP_FLEX, but it's a
  // last-round filler that gets picked after the draft is decided, so modelling
  // it earns nothing and costs plenty: defenders would need their own shared
  // replacement level (a DE and an LB compete for that one seat, so four
  // separate levels is simply the wrong maths) and every IDP scoring rule would
  // ride along in the coverage check as noise. The engine still handles IDP in
  // full — the scope call lives here, in one Set and one filter.
  //
  // Refresh re-pulls everything. Your own order is yours, saved locally, and
  // one button puts the standard board back.
  import { onDestroy } from 'svelte';
  import { link } from '../lib/router.js';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { draftSheetQuery, playersQuery } from '../api/queries';
  import { userHandleMap } from '../api/league';
  import { TEAMSHORT } from '../lib/data.js';
  import {
    buildSheet, applyOrder, moveInOrder, coverage, slotDemand, STOCK_SCORING,
  } from '../lib/engine/sheet.ts';

  const qc = useQueryClient();
  const sheetQ = createQuery(draftSheetQuery());
  const playersQ = createQuery(playersQuery());

  let refreshing = false;
  async function refresh() {
    refreshing = true;
    try {
      await qc.invalidateQueries({ queryKey: ['draftsheet'] });
      await qc.refetchQueries({ queryKey: ['draftsheet'] });
    } finally { refreshing = false; }
  }

  // DRAFT NIGHT. Off by default, because a board that reorders under your finger
  // mid-thought is worse than a stale one — but with it on, the picks endpoint
  // is re-read every thirty seconds and the men who have gone strike themselves
  // off without you touching anything.
  let liveMode = false;
  let liveTimer = null;
  $: {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    if (liveMode) liveTimer = setInterval(refresh, 30_000);
  }
  onDestroy(() => { if (liveTimer) clearInterval(liveTimer); });

  // ---- your own list (saved locally, standard board one click away) ----
  const LS = 'bcs_sheet_order_v1';
  const readLS = () => { try { const v = localStorage.getItem(LS); const a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
  let order = readLS();
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(order)); } catch { /* full */ } };
  let useMine = order.length > 0;
  // The WHOLE board seeds the order, the filtered view decides the neighbour.
  // Seeding from the view alone meant nudging one quarterback on the QB tab
  // hoisted all 42 of them above everyone else on the ALL board.
  function bump(id, d) {
    order = moveInOrder(order, built.rows.map((r) => r.id), view.map((r) => r.id), id, d);
    useMine = true;
    save();
  }
  function clearMine() { order = []; useMine = false; save(); }

  // ---- raw -> rows ----
  $: raw = $sheetQ.data || null;
  $: blob = $playersQ.data || null;            // id -> [name, pos, team]
  $: scoring = raw?.league?.scoring_settings || {};
  $: rosterPos = raw?.league?.roster_positions || [];
  $: teams = raw?.rosters?.length || 10;

  // Who already rosters whom, so the sheet can grey out the taken.
  $: uh = raw?.users ? userHandleMap(raw.users) : {};
  $: ownerById = (() => {
    const m = {};
    for (const r of raw?.rosters || []) {
      const h = uh[r.owner_id];
      for (const pid of r.players || []) m[String(pid)] = h || ('roster ' + r.roster_id);
    }
    return m;
  })();
  // ...but ROSTERED is not KEPT, and in this league that difference is the whole
  // draft. Everyone keeps three and redrafts the rest, so of the 144 rostered
  // men only 30 are actually off the board. Treating "rostered" as "taken" hid
  // Josh Allen — the best draftable player on it — along with Drake London,
  // Trey McBride, Pickens, Etienne and three dozen more.
  $: keptById = (() => {
    const m = {};
    for (const r of raw?.rosters || []) {
      const h = uh[r.owner_id];
      for (const pid of r.keepers || []) m[String(pid)] = h || ('roster ' + r.roster_id);
    }
    return m;
  })();
  $: anyKept = Object.keys(keptById).length > 0;

  // OFF THE BOARD, LIVE. Before the draft this holds the thirty keepers; on the
  // night it fills up pick by pick, so a refresh turns the sheet into the board
  // you are actually drafting off — everyone taken struck out, with the pick he
  // went at and who took him.
  $: gone = (() => {
    // TWO SOURCES, and both are needed. The keepers are declared on the roster
    // and are off the board whatever the draft feed says; the picks endpoint is
    // what fills up on the night. Reading only the picks endpoint worked for
    // this league by luck — it happens to carry the keepers as is_keeper picks —
    // and showed nothing at all for a league that declares them any other way.
    const m = {};
    for (const [id, h] of Object.entries(keptById)) m[id] = { keeper: true, by: h };
    for (const p of raw?.picks || []) {
      const id = String(p.player_id || '');
      if (!id) continue;
      const by = uh[p.picked_by] || rosterHandle[p.roster_id] || m[id]?.by || '';
      m[id] = { round: p.round, slot: p.draft_slot, by, keeper: !!p.is_keeper || !!m[id]?.keeper };
    }
    return m;
  })();
  $: rosterHandle = Object.fromEntries((raw?.rosters || []).map((r) => [r.roster_id, uh[r.owner_id]]));
  $: drafted = Object.values(gone).filter((g) => !g.keeper).length;
  $: pickCodeOf = (g) => `${g.round}.${String(g.slot).padStart(2, '0')}`;

  const FANTASY = new Set(['QB', 'RB', 'WR', 'TE']);
  // Slots only a defender can fill are dropped before the replacement fill, so
  // an unmodelled IDP_FLEX can't report its pool as having "run dry".
  const IDP_SLOTS = new Set(['IDP_FLEX', 'DL', 'LB', 'DB', 'IDP']);
  // Likewise their scoring rules: they're real, they're just out of scope here,
  // and listing them as unbacked would bury the one line that matters.
  const OUT_OF_SCOPE = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;

  $: inputs = (() => {
    if (!raw?.proj || !blob) return [];
    const out = [];
    for (const pid in raw.proj) {
      const info = blob[pid];
      if (!info || !info[0]) continue;
      const pos = (info[1] || '').toUpperCase();
      if (!FANTASY.has(pos)) continue;
      const line = raw.proj[pid] || {};
      const games = Number(line.gp ?? line.gms_active ?? 17) || 17;
      const prior = raw.priorStats?.[pid] || null;
      const priorGames = prior ? Number(prior.gp ?? prior.gms_active ?? 0) || 0 : 0;
      out.push({
        id: String(pid), name: info[0], pos, team: info[2] || 'FA',
        age: info[3] ?? null, exp: info[4] ?? null,
        games, proj: line, prior, priorGames,
        // Sleeper's OWN published half-PPR season total — the number on the
        // player's card in the app, which is what the other nine managers are
        // looking at. Carried through verbatim rather than re-derived.
        sleeperPts: Number(line.pts_half_ppr) || 0,
      });
    }
    return out;
  })();

  $: offenceScoring = Object.fromEntries(Object.entries(scoring).filter(([k]) => !OUT_OF_SCOPE.test(k)));
  // Score on the OFFENCE rules, not the full rulebook. Receivers and backs do
  // record the odd tackle after an interception, and return men score st_td, so
  // handing buildSheet all thirty rules quietly credited 145 of 470 offensive
  // rows with defensive and special-teams points on a board that says in its own
  // header that it does not model them. It also made the coverage panel a lie:
  // it judged the offence rules against lines built from everything.
  $: built = inputs.length
    ? buildSheet(inputs, offenceScoring, offenceSlots, teams)
    : { rows: [], levels: {}, dry: [], medBoost: 0 };
  // How far our own half-PPR re-score agrees with Sleeper's published number.
  // The Edge column is only worth anything if the baseline it is measured from
  // is genuinely theirs, so the page reports the agreement rather than claiming it.
  $: backfilled = built.rows.filter((r) => r.filled > 0).length;
  $: agree = (() => {
    const rows = built.rows.filter((r) => r.theirsFrom === 'sleeper');
    const ok = rows.filter((r) => r.matchesSleeper).length;
    return { checked: rows.length, ok, off: rows.length - ok };
  })();
  $: cov = inputs.length ? coverage(offenceScoring, built.rows.map((r) => r.line)) : { scoredKeys: [], missing: [] };
  $: offenceSlots = (rosterPos || []).filter((p) => !IDP_SLOTS.has(p));
  $: demand = offenceSlots.length ? slotDemand(offenceSlots, teams) : { dedicated: {}, flexes: [] };

  // ---- filters + sort ----
  const POS_TABS = ['ALL', 'QB', 'RB', 'WR', 'TE'];
  let posf = 'ALL';
  let q = '';
  let hideOwned = false;
  let hidePartial = false;
  let sortKey = 'vorpSeason';
  let sortDir = -1;
  let limit = 300;
  function sortBy(k) { if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = -1; } }

  const val = (r, k) => (k === 'owner' ? (ownerById[r.id] || '') : k === 'name' || k === 'pos' || k === 'team' ? r[k] : r[k]);
  $: filtered = built.rows.filter((r) => {
    if (posf !== 'ALL' && r.pos !== posf) return false;
    if (hideOwned && (gone[r.id] || (anyKept ? keptById[r.id] : ownerById[r.id]))) return false;
    if (hidePartial && r.partial) return false;
    const n = q.trim().toLowerCase();
    if (n && !r.name.toLowerCase().includes(n) && r.team.toLowerCase() !== n) return false;
    return true;
  });
  $: sorted = (() => {
    const rows = filtered.slice();
    rows.sort((a, b) => {
      const x = val(a, sortKey); const y = val(b, sortKey);
      const bothNum = typeof x === 'number' && typeof y === 'number';
      if (bothNum) return (x - y) * sortDir || a.ovRank - b.ovRank;
      const s = String(x || '').localeCompare(String(y || ''));
      return (s * -sortDir) || a.ovRank - b.ovRank;   // blanks trail
    });
    return rows;
  })();
  $: view = useMine ? applyOrder(sorted, order) : sorted;
  $: shown = view.slice(0, limit);
  $: pulled = raw?.pulledAt ? new Date(raw.pulledAt).toLocaleTimeString() : '';

  const pct = (x) => (x > 0 ? '+' : '') + (x * 100).toFixed(0) + '%';
  const n0 = (x) => (x == null ? '' : Math.round(x).toString());
  const n1 = (x) => (x == null ? '' : x.toFixed(1));
  const n2 = (x) => (x == null ? '' : x.toFixed(2));
  const plus = (x) => (x == null ? '' : (x > 0 ? '+' : '') + x.toFixed(0));

  // Every column says what it means, in one plain sentence. A board with
  // sixteen numbers on it is worthless if you have to remember what nine of
  // them are, and "Edge" in particular means something specific here that no
  // other site's Edge column means.
  const COLS = [
    ['name', 'Player', 'l', 'Who he is. Italic means Sleeper only projects him for part of the season.'],
    ['pos', 'Pos', 'l', 'What he plays.'],
    ['team', 'Tm', 'l', 'His NFL club.'],
    ['games', 'G', '', 'Games Sleeper expects him to play. Everything to the right is over this many games.'],
    ['theirs', 'They see', '', "Sleeper's own season projection — the number the other nine managers are looking at. Standard half-PPR, our rules ignored."],
    ['real', 'Really worth', '', "The same projected stats, scored under OUR rulebook: 6-point passing TDs, half a point per first down, fumbles counted twice."],
    ['gap', '+Pts', '', 'Really worth minus They see. The points this rulebook simply hands him.'],
    ['edgePts', 'Edge', '', 'The bit of that gain nobody else gets. Our rules lift the whole board, so this is the points he beats the average lift by — the column to sort on.'],
    ['ours', 'PPG', '', 'Really worth, per game.'],
    ['fd', '1D', '', 'Points per game that come purely from first downs — the rule no public ranking can see.'],
    ['vorpSeason', 'VORP', '', 'Points over a replacement-level starter across the season. What drafting him actually wins you versus taking the next man at his position.'],
    ['posRank', 'PosRk', '', 'His rank at his own position on this board.'],
    ['ovRank', 'OvRk', '', 'His rank on this board overall, by VORP.'],
    ['owner', 'Status', 'l', 'Kept, or the pick he was drafted at and who took him. Blank means still on the board.'],
  ];

  // THE COLUMN EXPLAINER. Rendered OUTSIDE the scrollport and positioned fixed,
  // because the header is sticky inside an `overflow: auto` box and a tooltip
  // drawn inside it gets clipped by its own container. Native `title` would not
  // be clipped but takes a second to appear, and a second is too long when you
  // are checking what a column means mid-draft.
  let tip = null;
  function showTip(e, text) {
    const r = e.currentTarget.getBoundingClientRect();
    tip = { text, x: Math.min(r.left, window.innerWidth - 300), y: r.bottom + 6 };
  }
  const hideTip = () => { tip = null; };
</script>

<section class="sheet" data-testid="sheet">
  <header class="shd">
    <a class="back" href="/board" use:link>← Big Board</a>
    <div class="ttl">
      <b>THE SHEET</b>
      <span class="sub">every player re-scored under this league's actual rulebook · not linked from anywhere</span>
    </div>
    <div class="acts">
      <button class="btn go" data-testid="sheet-refresh" on:click={refresh} disabled={refreshing || $sheetQ.isFetching}>
        {refreshing || $sheetQ.isFetching ? '↻ pulling…' : '↻ Refresh'}
      </button>
      <label class="chk live" title="Re-pull every 30 seconds. For draft night — leave it on and the board keeps itself current.">
        <input type="checkbox" bind:checked={liveMode} data-testid="sheet-live" /> live
      </label>
      {#if pulled}<span class="muted">pulled {pulled}</span>{/if}
    </div>
  </header>

  {#if $sheetQ.isLoading}
    <p class="note">Pulling the league rules, season projections and last season's stats…</p>
  {:else if $sheetQ.isError}
    <p class="note bad">Couldn't reach Sleeper. {String($sheetQ.error?.message || '')} — hit Refresh.</p>
  {:else if !built.rows.length}
    <p class="note">No projections came back for {raw?.season}. Sleeper publishes the season set closer to the year; hit Refresh later.</p>
  {:else}
    <!-- WHAT MAKES THIS LEAGUE DIFFERENT -->
    <div class="strips">
      <div class="strip">
        <div class="sh">The rulebook</div>
        <p>
          Pass TD <b>{scoring.pass_td ?? '—'}</b> (stock 4) ·
          Rec <b>{scoring.rec ?? 0}</b> ·
          Rush 1D <b>{scoring.rush_fd ?? 0}</b> · Rec 1D <b>{scoring.rec_fd ?? 0}</b> ·
          Fum <b>{scoring.fum ?? 0}</b> + lost <b>{scoring.fum_lost ?? 0}</b>
        </p>
        <p class="muted">Whole board inflated <b>{pct(built.medBoost)}</b> vs what Sleeper shows. <b>Edge</b> is measured against that tide, so it names who beats it rather than who rides it.</p>
      </div>
      <div class="strip">
        <div class="sh">The lineup ({teams} teams)</div>
        <p>{(rosterPos || []).filter((p) => !['BN', 'IR', 'TAXI'].includes(p)).join(' · ')}</p>
        <p class="muted">Offence only — the IDP_FLEX is a last-round filler and isn't modelled, so it sets no replacement level and takes nothing off this board.</p>
        <p class="muted">
          League-wide starts:
          {#each Object.entries(demand.dedicated) as [p, n]}<span>{p} {n} · </span>{/each}
          {#each demand.flexes as f}<span>{f.slot} {f.n} · </span>{/each}
        </p>
      </div>
      <div class="strip" data-testid="sheet-replacement">
        <div class="sh">Replacement (ppg)</div>
        <p>
          {#each Object.entries(built.levels).sort((a, b) => b[1] - a[1]).slice(0, 8) as [p, v]}
            <span class="rp">{p} <b>{n1(v)}</b></span>
          {/each}
        </p>
        {#if built.dry.length}<p class="muted bad">Pool ran dry filling: {built.dry.join(', ')} — those are floors, not real levels.</p>{/if}
      </div>
      <div class="strip">
        <div class="sh">Do these numbers match Sleeper?</div>
        <p class="muted" data-testid="sheet-agree">
          {#if agree.checked}
            Our half-PPR baseline reproduces <b>Sleeper's own published projection to the decimal for {agree.ok} of {agree.checked}</b> players.
            {#if agree.off}<span class="bad">{agree.off} {agree.off === 1 ? 'does not' : 'do not'}</span>, and {agree.off === 1 ? 'is' : 'are'} marked.{/if}
            So the <b>They see</b> column is their number, and the gap to <b>Really worth</b> is our rulebook and nothing else.
          {:else}
            Sleeper published no projections to check against.
          {/if}
        </p>
        <p class="muted">
          {built.rows.length} players scored · {built.rows.filter((r) => r.partial).length} on a part-season projection (held out of replacement)
          {#if backfilled} · {backfilled} had a rule Sleeper leaves out filled from his own last season{/if}.
        </p>
        {#if cov.missing.length}
          <p class="muted bad" data-testid="sheet-missing">
            {cov.missing.length} scored rule{cov.missing.length === 1 ? '' : 's'} had NO projected stat behind {cov.missing.length === 1 ? 'it' : 'them'}:
            <code>{cov.missing.join(' ')}</code> — those points are missing from every row.
          </p>
        {:else}
          <p class="muted">Every scored rule had data behind it.</p>
        {/if}
      </div>
    </div>

    <div class="bar">
      <span class="tabs">
        {#each POS_TABS as t}
          <button class="chip" class:on={posf === t} data-testid={'sheet-pos-' + t.toLowerCase()} on:click={() => (posf = t)}>{t}</button>
        {/each}
      </span>
      <input class="srch" placeholder="search name or team…" bind:value={q} data-testid="sheet-search" />
      <label class="chk"><input type="checkbox" bind:checked={hideOwned} data-testid="sheet-hidegone" /> hide gone</label>
      <label class="chk"><input type="checkbox" bind:checked={hidePartial} /> hide part-season</label>
      <span class="spacer"></span>
      <button class="chip" class:on={useMine} data-testid="sheet-mine" on:click={() => (useMine = !useMine)} disabled={!order.length}>
        my list{order.length ? ` (${order.length})` : ''}
      </button>
      <button class="chip" data-testid="sheet-standard" on:click={clearMine} disabled={!order.length}>back to standard</button>
      <span class="muted" data-testid="sheet-count">
        {view.length} shown of {built.rows.length}{#if drafted} · <b>{drafted} drafted</b>{/if}
      </span>
      {#each [300, 800, 99999] as n}
        <button class="chip mini" class:on={limit === n} on:click={() => (limit = n)}>{n === 99999 ? 'all' : n}</button>
      {/each}
    </div>

    <div class="wrap">
      <table data-testid="sheet-table">
        <thead>
          <tr>
            <th class="nrw">#</th>
            <th class="nrw">move</th>
            {#each COLS as [k, label, cls, tipText]}
              <th
                class={cls} class:act={sortKey === k}
                on:click={() => sortBy(k)}
                on:mouseenter={(e) => showTip(e, tipText)}
                on:mouseleave={hideTip}
                on:focus={(e) => showTip(e, tipText)}
                on:blur={hideTip}
                tabindex="0"
                title={tipText}
              >
                {label}{sortKey === k ? (sortDir < 0 ? ' ▼' : ' ▲') : ''}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each shown as r, i (r.id)}
            <tr class:owned={!!gone[r.id]} class:part={r.partial}>
              <td class="nrw muted">{i + 1}</td>
              <td class="nrw mv">
                <button on:click={() => bump(r.id, -1)} aria-label="Move {r.name} up" data-testid={'up-' + r.id}>▲</button>
                <button on:click={() => bump(r.id, 1)} aria-label="Move {r.name} down" data-testid={'down-' + r.id}>▼</button>
              </td>
              <td class="l nm">{r.name}{#if r.partial}<em class="tag" title="part-season projection">{r.games}G</em>{/if}</td>
              <td class="l"><span class="pos">{r.pos}</span></td>
              <td class="l muted">{r.team}</td>
              <td class="muted">{r.games}</td>
              <td class="theirs" title={r.theirsFrom === 'derived' ? 'Sleeper publishes no projection for him — this is our own half-PPR score of the same stats' : 'Sleeper’s published half-PPR projection'}>
                {n0(r.theirs)}{#if r.theirsFrom === 'derived'}<em class="q">?</em>{/if}
              </td>
              <td class="big">{n0(r.real)}</td>
              <td class="gap">{plus(r.gap)}</td>
              <td class="edge" class:up={r.edgePts > 3} class:dn={r.edgePts < -3}>{plus(r.edgePts)}</td>
              <td class="muted">{n2(r.ours)}</td>
              <td class:pos-good={r.fd > 0}>{r.fd ? n2(r.fd) : ''}</td>
              <td class="big">{n0(r.vorpSeason)}</td>
              <td class="muted">{r.pos}{r.posRank}</td>
              <td class="muted">{r.ovRank}</td>
              <td class="l muted stat" class:kept={!!gone[r.id]?.keeper}>
                {#if gone[r.id]}
                  {#if gone[r.id].keeper}KEPT{:else}<b>{pickCodeOf(gone[r.id])}</b>{/if}
                  {#if gone[r.id].by}<span class="by">{TEAMSHORT[gone[r.id].by] || gone[r.id].by}</span>{/if}
                {:else if ownerById[r.id]}
                  <span class="onros" title="on his roster now, but not kept — he goes back in the pool">{TEAMSHORT[ownerById[r.id]] || ownerById[r.id]}</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if tip}
      <div class="tip" style="left:{tip.x}px; top:{tip.y}px" role="tooltip">{tip.text}</div>
    {/if}

    <p class="foot muted">
      Season {raw.season} projections, backfilled from {raw.prior} actuals where Sleeper leaves a scored stat out.
      Everything per game. VORP is ppg minus the replacement level for that position, from a greedy fill of the real lineup.
      Your order is saved in this browser only.
    </p>
  {/if}
</section>

<style>
  .sheet { padding: 0 10px 30px; font-family: var(--mono); }
  .shd { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; padding: 8px 0 10px; }
  .back { font-size: 11px; color: var(--blue); text-decoration: none; }
  .back:hover { text-decoration: underline; }
  .ttl b { font-family: var(--display); font-weight: 800; font-size: 17px; letter-spacing: .04em; color: var(--chalk); }
  .ttl .sub { font-size: 10.5px; color: var(--muted); margin-left: 8px; }
  .acts { margin-left: auto; display: flex; align-items: center; gap: 10px; white-space: nowrap; }
  .btn { font-family: var(--mono); font-size: 12px; border: 1px solid var(--line); background: #fff; color: var(--chalk); border-radius: 8px; padding: 8px 14px; cursor: pointer; min-height: 36px; }
  .btn.go { background: var(--blue); border-color: var(--blue); color: #fff; font-weight: 700; }
  .btn:disabled { opacity: .55; cursor: default; }
  .note { font-size: 12.5px; color: var(--muted); line-height: 1.7; padding: 14px 0; }
  .note.bad, .muted.bad { color: var(--stamp-red); }
  .muted { color: var(--muted); }

  .strips { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 8px; margin-bottom: 10px; }
  .strip { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 8px 10px; min-width: 0; }
  .sh { font-family: var(--display); font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--blue-deep); margin-bottom: 4px; }
  .strip p { margin: 0 0 3px; font-size: 11px; line-height: 1.55; word-break: break-word; }
  .strip b { color: var(--chalk); }
  .rp { display: inline-block; margin-right: 9px; }
  code { font-size: 10px; background: var(--field-3); padding: 1px 4px; border-radius: 3px; }

  .bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .tabs { display: flex; gap: 4px; }
  .chip { font-family: var(--mono); font-size: 11px; border: 1px solid var(--line); background: #fff; color: var(--muted); border-radius: 7px; padding: 6px 11px; cursor: pointer; min-height: 32px; }
  .chip.on { background: var(--blue); border-color: var(--blue); color: #fff; }
  .chip:disabled { opacity: .45; cursor: default; }
  .chip.mini { padding: 5px 8px; font-size: 10px; min-height: 28px; }
  .srch { flex: 1 1 180px; min-width: 0; font-size: 12px; }
  .chk { font-size: 11px; color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
  .spacer { flex: 1 1 auto; }

  /* The board is its own scrollport so the page never scrolls sideways. */
  .wrap { overflow: auto; max-height: calc(100vh - 300px); border: 1px solid var(--line); border-radius: 8px; background: #fff; overscroll-behavior: contain; }
  table { border-collapse: collapse; width: 100%; font-size: 11.5px; font-variant-numeric: tabular-nums; }
  thead th {
    position: sticky; top: 0; z-index: 3; background: var(--field-3); color: var(--muted);
    font-weight: 600; font-size: 9.5px; letter-spacing: .05em; text-transform: uppercase;
    text-align: right; padding: 7px 6px; white-space: nowrap; cursor: pointer; border-bottom: 1px solid var(--line);
  }
  thead th.l { text-align: left; }
  thead th.act { color: var(--blue-deep); background: var(--blue-wash); }
  tbody td { padding: 4px 6px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
  tbody td.l { text-align: left; }
  tbody tr:hover { background: var(--blue-wash); }
  tr.owned { opacity: .5; }
  td.kept { color: var(--blue-deep); font-weight: 700; }
  tr.part .nm { font-style: italic; }
  .nm { font-family: var(--body); font-weight: 600; color: var(--chalk); max-width: 210px; overflow: hidden; text-overflow: ellipsis; }
  .tag { font-style: normal; font-size: 8.5px; background: var(--brass); color: #fff; border-radius: 3px; padding: 0 3px; margin-left: 5px; }
  .pos { font-size: 9px; font-weight: 700; color: var(--blue-deep); background: var(--blue-wash); border-radius: 3px; padding: 1px 4px; }
  .big { font-weight: 700; color: var(--chalk); }
  /* The three that matter read as a group: what they see, what it really is,
     and the gap — so the eye tracks left to right across one story. */
  td.theirs { color: var(--muted); }
  td.theirs .q { font-style: normal; color: var(--brass); font-size: 9px; margin-left: 2px; }
  td.gap { color: var(--purp); }
  .edge { font-weight: 700; }
  .edge.up { color: var(--good); }
  .edge.dn { color: var(--stamp-red); }
  td.stat .by { color: var(--muted); margin-left: 5px; font-size: 10px; }
  td.stat b { color: var(--blue-deep); }
  td.stat .onros { opacity: .55; font-size: 10px; }

  /* Rendered outside the scrollport: the sticky header lives inside an
     overflow box that would otherwise clip it. */
  .tip {
    position: fixed; z-index: 60; max-width: 290px;
    background: var(--ink); color: #fff; border-radius: 7px;
    padding: 7px 10px; font-size: 11px; line-height: 1.5;
    box-shadow: 0 6px 20px rgba(22, 32, 43, .28); pointer-events: none;
  }
  thead th:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
  .chk.live { border: 1px solid var(--line); border-radius: 7px; padding: 5px 9px; }
  .pos-good { color: var(--good); }
  .nrw { width: 30px; }
  .mv { white-space: nowrap; }
  .mv button { border: 1px solid var(--line); background: #fff; color: var(--muted); border-radius: 4px; width: 18px; height: 18px; font-size: 8px; line-height: 1; cursor: pointer; padding: 0; }
  .mv button:hover { border-color: var(--blue); color: var(--blue); }
  .foot { font-size: 10.5px; line-height: 1.6; margin-top: 8px; max-width: 110ch; }
</style>
