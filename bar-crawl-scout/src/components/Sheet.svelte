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
  import { TEAMSHORT, byName } from '../lib/data.js';
  import { board } from '../lib/store.js';
  import {
    buildSheet, coverage, slotDemand, adpKeyFor, STOCK_SCORING,
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

  // ---- YOUR BOARD, which is a COLUMN and not a MODE ----
  //
  // Moving a player used to mean "put him at position N in a shadow copy of the
  // whole board", and that copy then had to REPLACE whatever you had sorted by.
  // Hence the old bug, and hence the real question underneath it: how do you
  // rank men yourself and still read the data in order?
  //
  // By making your rank a column. A star puts a man on your board and he takes
  // the next number; the arrows move him within it; and that number shows on his
  // row in EVERY sort. Sort by My to see your board in your order. Sort by VORP
  // or ADP and your numbers are still there, beside the data, so the places you
  // disagree with the board are visible instead of hidden — a man you have third
  // sitting fourteenth on VORP is you backing a hunch, and you can see it.
  //
  // Two ideas collapse into one, which is the other half of the fix: a favourite
  // and a hand-ranked man were always the same thing.
  $: myBoard = $board.favs || [];
  $: myRankOf = (n) => { const i = myBoard.indexOf(n); return i < 0 ? null : i + 1; };
  const onBoard = (n) => (($board.favs || []).indexOf(n) >= 0);
  const toggleFav = (n) => board.update((b) => {
    const list = Array.isArray(b.favs) ? b.favs.slice() : [];
    const i = list.indexOf(n);
    if (i >= 0) list.splice(i, 1); else list.push(n);
    return { ...b, favs: list };
  });
  // Up and down move him one place on YOUR board. They do nothing to anybody
  // else and nothing to the sort, which is the entire point.
  const bumpFav = (n, d) => board.update((b) => {
    const list = Array.isArray(b.favs) ? b.favs.slice() : [];
    const i = list.indexOf(n);
    const j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return b;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...b, favs: list };
  });
  const clearMine = () => board.update((b) => ({ ...b, favs: [] }));

  // ---- raw -> rows ----
  $: raw = $sheetQ.data || null;
  $: blob = $playersQ.data || null;            // id -> [name, pos, team]
  $: scoring = raw?.league?.scoring_settings || {};
  $: rosterPos = raw?.league?.roster_positions || [];
  $: rounds = Number(raw?.draft?.settings?.rounds) || 15;
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
        // The PRICE. Set by every league in the world, not by ours — which is
        // exactly why it can be wrong here.
        adp: Number(line[adpKey]) || null,
        // And the mainstream half-PPR price, for the same player, alongside it.
        adpMarket: Number(line.adp_half_ppr) || null,
        adpPpr: Number(line.adp_ppr) || null,
        pprPts: Number(line.pts_ppr) || null,
        // The only number on the board that is not Sleeper's opinion of itself:
        // the FantasyPros consensus, which aggregates ESPN, Yahoo, CBS and NFL.
        // Sleeper's API publishes no other site's ADP, so this is what there is.
        adpConsensus: (byName(info[0]) || [])[5] || null,
      });
    }
    return out;
  })();

  // Sleeper serves the ADP that matches the league FORMAT — ours is IDP with one
  // quarterback — and reading a different one shows a price nobody in the room
  // has seen. adp_half_ppr was out by four to twenty places on every man checked.
  $: adpKey = adpKeyFor(rosterPos, scoring);
  // Twice the picks in our own draft: past that Sleeper's column is filler.
  $: adpCap = Math.max(120, teams * rounds * 2);
  $: offenceScoring = Object.fromEntries(Object.entries(scoring).filter(([k]) => !OUT_OF_SCOPE.test(k)));
  // Score on the OFFENCE rules, not the full rulebook. Receivers and backs do
  // record the odd tackle after an interception, and return men score st_td, so
  // handing buildSheet all thirty rules quietly credited 145 of 470 offensive
  // rows with defensive and special-teams points on a board that says in its own
  // header that it does not model them. It also made the coverage panel a lie:
  // it judged the offence rules against lines built from everything.
  // The men who are already gone cannot set the replacement level. Thirty are
  // kept in this league and they are overwhelmingly backs and receivers, so
  // filling the lineup with them sets the bar where it would be in somebody
  // else's league and understates every RB and WR you can actually take.
  $: goneIds = new Set(Object.keys(gone));
  $: built = inputs.length
    ? buildSheet(inputs, offenceScoring, offenceSlots, teams, 17, goneIds, adpCap)
    : { rows: [], levels: {}, dry: [], medBoost: 0, tide: 1 };
  // The same board WITHOUT that correction, purely to say how much it was worth.
  $: worldLevels = inputs.length
    ? buildSheet(inputs, offenceScoring, offenceSlots, teams).levels
    : {};
  // How far our own half-PPR re-score agrees with Sleeper's published number.
  // The Edge column is only worth anything if the baseline it is measured from
  // is genuinely theirs, so the page reports the agreement rather than claiming it.
  $: fumbled = built.rows.filter((r) => r.fumAdj < 0).length;
  $: agree = (() => {
    const rows = built.rows.filter((r) => r.marketFrom === 'sleeper');
    const ok = rows.filter((r) => r.matchesSleeper).length;
    return { checked: rows.length, ok, off: rows.length - ok };
  })();
  $: cov = inputs.length ? coverage(offenceScoring, built.rows.map((r) => r.line)) : { scoredKeys: [], missing: [] };
  $: offenceSlots = (rosterPos || []).filter((p) => !IDP_SLOTS.has(p));
  $: demand = offenceSlots.length ? slotDemand(offenceSlots, teams) : { dedicated: {}, flexes: [] };

  // ---- FAVOURITES AND YOUR OWN TAGS ----
  //
  // Both live on the existing board record, keyed by player name, so a star put
  // on a man here is the same star the Big Board knows about. Free text rather
  // than a fixed list: the useful tag on draft night is "handcuff for Gibbs" or
  // "ask Imy about", and no list written in advance contains those.
  $: favs = new Set($board.favs || []);
  $: customTags = $board.custom || {};
  const isFav = (n) => onBoard(n);
  $: tagsOf = (n) => customTags[n] || [];
  const addTag = (n, raw) => {
    const t = String(raw || '').trim().slice(0, 24);
    if (!t) return;
    board.update((b) => {
      const c = { ...(b.custom || {}) };
      const cur = (c[n] || []).slice();
      if (!cur.includes(t)) cur.push(t);
      c[n] = cur;
      return { ...b, custom: c };
    });
  };
  const dropTag = (n, t) => board.update((b) => {
    const c = { ...(b.custom || {}) };
    const cur = (c[n] || []).filter((x) => x !== t);
    if (cur.length) c[n] = cur; else delete c[n];
    return { ...b, custom: c };
  });
  // Remembered, because a page you have to re-collapse every visit is a page
  // that annoys you every visit.
  const NOTES_LS = 'bcs_sheet_notes_v1';
  let showNotes = (() => { try { return localStorage.getItem(NOTES_LS) === '1'; } catch { return false; } })();
  const setNotes = (v) => { showNotes = v; try { localStorage.setItem(NOTES_LS, v ? '1' : '0'); } catch { /* blocked */ } };

  let openTag = null;
  let tagDraft = '';
  // Every tag anyone has actually used, so the filter row is yours rather than
  // a menu of options nobody picked.
  $: allTags = [...new Set(Object.values(customTags).flat())].sort();
  $: rookieCount = built.rows.filter((r) => r.rookie).length;

  // What the Status column used to say, moved onto the row itself: the column
  // was a third of the board's width for a fact you need once a pick.
  $: statusOf = (r) => {
    const g = gone[r.id];
    if (g) {
      const who = g.by ? ` — ${TEAMSHORT[g.by] || g.by}` : '';
      return g.keeper ? `Kept${who}` : `Drafted ${pickCodeOf(g)}${who}`;
    }
    const o = ownerById[r.id];
    return o ? `On ${TEAMSHORT[o] || o}'s roster now, but not kept — he goes back in the pool` : '';
  };

  // ---- filters + sort ----
  // FLEX is a real seat in this lineup — two of them — so it is a real way to
  // look at the board: everyone who can fill one, ranked against each other.
  const POS_TABS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX'];
  const FLEX_POS = new Set(['RB', 'WR', 'TE']);
  let posf = 'ALL';
  let q = '';
  let hideOwned = false;
  let hidePartial = false;
  let rookiesOnly = false;
  let favsOnly = false;
  let tagFilter = '';
  let sortKey = 'vorpSeason';
  let sortDir = -1;
  let limit = 300;
  // WHICH WAY IS "BEST" depends on the column, and a sort that opens the wrong
  // way makes you click twice every time. On every points column — Sleeper,
  // Actual, VORP, Value, Gain — more is better, so the first click puts the
  // biggest at the top. On a PRICE it is the other way round: an ADP of 16 means
  // he goes in the second round and an ADP of 200 means nobody wants him, so the
  // first click has to put the LOWEST first or the board opens on the men you
  // will never draft.
  const ASC_FIRST = new Set(['adp', 'adpMarket', 'adpPpr', 'adpConsensus', 'myRank']);
  function sortBy(k) {
    if (sortKey === k) sortDir = -sortDir;
    else { sortKey = k; sortDir = ASC_FIRST.has(k) ? 1 : -1; }
  }

  const val = (r, k) => (k === 'owner' ? (ownerById[r.id] || '') : k === 'name' || k === 'pos' || k === 'team' ? r[k] : r[k]);
  // Your rank travels with the row, so it can be shown in any sort and sorted on
  // like any other column.
  $: ranked = built.rows.map((r) => ({ ...r, myRank: myRankOf(r.name) }));
  $: filtered = ranked.filter((r) => {
    if (posf === 'FLEX' ? !FLEX_POS.has(r.pos) : posf !== 'ALL' && r.pos !== posf) return false;
    if (hideOwned && (gone[r.id] || (anyKept ? keptById[r.id] : ownerById[r.id]))) return false;
    if (hidePartial && r.partial) return false;
    if (rookiesOnly && !r.rookie) return false;
    if (favsOnly && !favs.has(r.name)) return false;
    if (tagFilter && !tagsOf(r.name).includes(tagFilter)) return false;
    const n = q.trim().toLowerCase();
    if (n && !r.name.toLowerCase().includes(n) && r.team.toLowerCase() !== n) return false;
    return true;
  });
  $: sorted = (() => {
    const rows = filtered.slice();
    rows.sort((a, b) => {
      const x = val(a, sortKey); const y = val(b, sortKey);
      // BLANKS ALWAYS TRAIL, whichever way you are sorting. ADP, Value and Gain
      // are null for anyone the market has no read on — several hundred men —
      // and treating null as a value put all of them at the top of the board the
      // moment you sorted by the column you most wanted to sort by.
      const xn = x == null || x === '';
      const yn = y == null || y === '';
      if (xn !== yn) return xn ? 1 : -1;
      if (xn && yn) return a.ovRank - b.ovRank;
      const bothNum = typeof x === 'number' && typeof y === 'number';
      if (bothNum) return (x - y) * sortDir || a.ovRank - b.ovRank;
      const s = String(x).localeCompare(String(y));
      return (s * -sortDir) || a.ovRank - b.ovRank;
    });
    return rows;
  })();
  $: view = sorted;
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
    ['sleeper', 'Sleeper', '', 'WHAT YOUR LEAGUEMATES SEE. Exactly the PTS number in your Sleeper draft room — their projection, scored under our league rules by them. This column IS that column, digit for digit.'],
    ['adjusted', 'Actual', '', 'THE REAL PROJECTION — every scored rule in the league, applied. Sleeper\u2019s number plus the one rule they cannot carry: we dock a point per fumble as well as for losing it, and no projection counts plain fumbles. Usually a point or two, occasionally seven.'],
    ['adp', 'ADP', '', 'The ADP in YOUR draft room. Sleeper serves the one matching our format — IDP with one quarterback — and this is the price you will actually pay. Nothing about it knows our thirty keepers are gone.'],
    ['adpMarket', 'ADP½', '', 'The mainstream half-PPR ADP — what every ranking, article and mock outside your draft room quotes.'],
    ['adpPpr', 'ADP1', '', 'Full-PPR ADP. Our scoring is half a point a catch plus half a point a first down, so it sits BETWEEN half and full PPR — these two bracket where he really belongs.'],
    ['adpConsensus', 'FP', '', 'The FantasyPros consensus half-PPR ADP, which aggregates ESPN, Yahoo, CBS and NFL. The only price here that is not Sleeper marking its own homework.'],
    ['vorpSeason', 'VORP', '', 'Season points over a replacement starter AT HIS POSITION, from the pool you can really draft. What taking him actually wins you. Sleeper does not compute this at all.'],
    ['myRank', 'My', '', 'Where YOU have him. Star a man to put him on your board and he takes the next number; the arrows move him within it. It shows in every sort, so the places you disagree with the board stay visible — a man you have third sitting fourteenth on VORP is you backing a hunch.'],
    ['slip', 'Value', '', 'HOW UNDERVALUED HE IS, in draft places: how much later the market lets him go than his VORP says he is worth. Positive is cheap.'],
    ['surplus', 'Gain', '', 'AND BY HOW MUCH, in points: how much more he wins you than the man the market prices him alongside. A big slip is worth nothing if the two men are worth the same \u2014 this is the number that says whether it matters.'],
    ['market', 'Market', '', 'The same player under standard half-PPR, which is what ADP is built from. Shown because it explains the price, not because anyone in our room drafts on it.'],
    ['ours', 'PPG', '', 'The Sleeper number, per game — his rate under OUR rules.'],
    ['pprPpg', 'PPG1', '', 'The same per-game rate under full PPR. A possession receiver scores here more like a full-PPR player than a half-PPR one, because we pay half a point a catch AND half a point a first down — so this is the closer public rate for him, and the further one for a back who never catches.'],
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
      <span class="sub">your draft room's own numbers, against the scoring the market prices them on · not linked from anywhere</span>
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
    <!-- WHAT MAKES THIS LEAGUE DIFFERENT.
         Collapsed by default and remembered: it is worth reading once and then
         being out of the way, because the board is what you came for. -->
    <button class="explain" data-testid="sheet-explain" on:click={() => setNotes(!showNotes)} aria-expanded={showNotes}>
      {showNotes ? '▾' : '▸'} how this board works
    </button>
    {#if showNotes}
    <div class="strips">
      <div class="strip">
        <div class="sh">The rulebook</div>
        <p>
          Pass TD <b>{scoring.pass_td ?? '—'}</b> (stock 4) ·
          Rec <b>{scoring.rec ?? 0}</b> ·
          Rush 1D <b>{scoring.rush_fd ?? 0}</b> · Rec 1D <b>{scoring.rec_fd ?? 0}</b> ·
          Fum <b>{scoring.fum ?? 0}</b> + lost <b>{scoring.fum_lost ?? 0}</b>
        </p>
        <p class="muted">These rules lift the board <b>{pct(built.medBoost)}</b> over the half-PPR the market prices on — but they lift almost everybody, and barely reorder anyone. The gap that pays is <b>Value</b>, not this one.</p>
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
        <div class="sh">What Sleeper isn't doing</div>
        <p class="muted">
          Their PTS is right and this page matches it. What they never work out is what a man is worth
          <b>over the next one at his position</b> — so their board sorts by points and puts the best
          quarterback on top, when the gap from him to a startable QB is the smallest gap on the board.
        </p>
        <p>
          Replacement, per game, from the pool you can <b>actually draft</b>:
          {#each ['RB', 'WR', 'QB', 'TE'] as p}
            {#if built.levels[p] != null}
              <span class="rp">{p} <b>{n1(built.levels[p])}</b>{#if worldLevels[p] != null && Math.abs(worldLevels[p] - built.levels[p]) >= 0.05}<em class="wl" title="where it would sit if the {goneIds.size} men already gone were still available">was {n1(worldLevels[p])}</em>{/if}</span>
            {/if}
          {/each}
        </p>
        {#if goneIds.size}
          <p class="muted">
            The {goneIds.size} already gone are mostly backs and receivers, so the bar at those two drops and
            every one you can still take is worth more than the world's ADP thinks. Nothing Sleeper publishes knows that.
          </p>
        {/if}
        {#if built.dry.length}<p class="muted bad">Pool ran dry filling: {built.dry.join(', ')} — those are floors, not real levels.</p>{/if}
      </div>
      <div class="strip">
        <div class="sh">Do these numbers match Sleeper?</div>
        <p class="muted" data-testid="sheet-agree">
          <b>Yes — on purpose.</b> <b>Sleeper</b> is the PTS column in your draft room, digit for digit, and
          <b>ADP</b> is the price beside it. Sleeper already applies this league's scoring to its own projection,
          so there is no edge in re-scoring it and this page does not pretend there is: it reproduces their
          numbers and then does the two things they never do.
        </p>
        <p class="muted">
          <b>Actual</b> is their projection with the one rule they cannot carry folded in — we dock a point per
          fumble as well as for losing it, and no projection counts plain fumbles. It is usually a point or two.
          <b>Value</b> and <b>Gain</b> are the answer to the only question a draft board can really help with:
          who the market lets you have later than he is worth here, and by how many points.
        </p>
        <p class="muted">
          {built.rows.length} players scored · {built.rows.filter((r) => r.partial).length} on a part-season projection (held out of replacement)
          {#if fumbled} · {fumbled} carry a fumble estimate inside <b>Actual</b>{/if}.
        </p>
        {#if cov.missing.length}
          <p class="muted bad" data-testid="sheet-missing">
            {cov.missing.length} scored rule{cov.missing.length === 1 ? '' : 's'} had NO projected stat behind {cov.missing.length === 1 ? 'it' : 'them'}:
            <code>{cov.missing.join(' ')}</code> — so those points are missing from Sleeper's number too, for everyone.
            {#if cov.missing.includes('fum')}The big one is <code>fum</code>, and it has its own column.{/if}
          </p>
        {:else}
          <p class="muted">Every scored rule had data behind it.</p>
        {/if}
      </div>
    </div>
    {/if}

    <div class="bar">
      <span class="tabs">
        {#each POS_TABS as t}
          <button class="chip" class:on={posf === t} data-testid={'sheet-pos-' + t.toLowerCase()} on:click={() => (posf = t)}>{t}</button>
        {/each}
      </span>
      <input class="srch" placeholder="search name or team…" bind:value={q} data-testid="sheet-search" />
      <button class="chip" class:on={rookiesOnly} data-testid="sheet-rookies" on:click={() => (rookiesOnly = !rookiesOnly)}>
        rookies{#if rookieCount}<b class="ct">{rookieCount}</b>{/if}
      </button>
      <button class="chip" class:on={favsOnly} data-testid="sheet-favs" on:click={() => (favsOnly = !favsOnly)} disabled={!favs.size}>
        ★ favs{#if favs.size}<b class="ct">{favs.size}</b>{/if}
      </button>
      {#each allTags as t}
        <button class="chip tagchip" class:on={tagFilter === t} on:click={() => (tagFilter = tagFilter === t ? '' : t)}>{t}</button>
      {/each}
      <label class="chk"><input type="checkbox" bind:checked={hideOwned} data-testid="sheet-hidegone" /> hide gone</label>
      <label class="chk"><input type="checkbox" bind:checked={hidePartial} /> hide part-season</label>
      <span class="spacer"></span>
      <button class="chip" class:on={sortKey === 'myRank'} data-testid="sheet-mine"
              on:click={() => sortBy('myRank')} disabled={!myBoard.length}>
        my board{myBoard.length ? ` (${myBoard.length})` : ''}
      </button>
      <button class="chip" data-testid="sheet-standard" on:click={clearMine} disabled={!myBoard.length}>clear</button>
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
                {#if r.myRank}
                  <button on:click={() => bumpFav(r.name, -1)} disabled={r.myRank === 1}
                          aria-label="Move {r.name} up your board" data-testid={'up-' + r.id}>▲</button>
                  <button on:click={() => bumpFav(r.name, 1)} disabled={r.myRank === myBoard.length}
                          aria-label="Move {r.name} down your board" data-testid={'down-' + r.id}>▼</button>
                {:else}
                  <span class="mvoff" title="star him to put him on your board, then these move him">·</span>
                {/if}
              </td>
              <td class="l nm" title={statusOf(r)}>
                <button class="fav" class:on={isFav(r.name)} on:click|stopPropagation={() => toggleFav(r.name)}
                        aria-label={isFav(r.name) ? `Unstar ${r.name}` : `Star ${r.name}`} data-testid={'fav-' + r.id}>{isFav(r.name) ? '★' : '☆'}</button>
                <span class="pn">{r.name}</span>
                {#if r.rookie}<em class="tag rk" title="2026 rookie — from Sleeper's years of experience, not a guess">R</em>{/if}
                {#if r.partial}<em class="tag" title="part-season projection">{r.games}G</em>{/if}
                {#each tagsOf(r.name) as t}<em class="tag ct">{t}</em>{/each}
                <button class="tagbtn" on:click|stopPropagation={() => (openTag = openTag === r.name ? null : r.name)}
                        aria-label="Tag {r.name}" data-testid={'tag-' + r.id}>⚑</button>
              </td>
              <td class="l"><span class="pos">{r.pos}</span></td>
              <td class="l muted">{r.team}</td>
              <td class="muted">{r.games}</td>
              <td class="big" title="the PTS column in your Sleeper draft room">{n1(r.sleeper)}</td>
              <td class="big">{n1(r.adjusted)}</td>
              <td class="muted">{r.adp != null ? r.adp.toFixed(1) : '—'}</td>
              <td class="muted alt">{r.adpMarket != null ? r.adpMarket.toFixed(1) : '—'}</td>
              <td class="muted alt">{r.adpPpr != null ? r.adpPpr.toFixed(1) : '—'}</td>
              <td class="muted alt">{r.adpConsensus != null ? r.adpConsensus.toFixed(1) : '—'}</td>
              <td class="big">{n0(r.vorpSeason)}</td>
              <td class="my" class:mine={r.myRank}>{r.myRank ?? ''}</td>
              <td class="edge" class:up={r.slip > 12} class:dn={r.slip < -12} title={r.slip != null ? `the market has him ${r.adpRank}th, this board has him ${r.valueRank}th` : ''}>{r.slip != null ? plus(r.slip) : ''}</td>
              <td class="gain" class:up={r.surplus > 8} class:dn={r.surplus < -8}>{r.surplus != null ? plus(r.surplus) : ''}</td>
              <td class="theirs" title={r.marketFrom === 'derived' ? 'Sleeper publishes no half-PPR projection for him — this is our own score of the same stats' : 'Sleeper’s published half-PPR projection, what ADP is built on'}>
                {n0(r.market)}{#if r.marketFrom === 'derived'}<em class="q">?</em>{/if}
              </td>
              <td class="muted">{n2(r.ours)}</td>
              <td class="muted alt">{r.pprPpg ? n2(r.pprPpg) : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if openTag}
      <!-- Rendered outside the scrollport for the same reason the tooltip is:
           a popover inside an overflow box is clipped by it. -->
      <div class="tagbox" data-testid="tagbox">
        <div class="tbhd">{openTag}</div>
        <div class="tbtags">
          {#each tagsOf(openTag) as t}
            <button class="tg on" on:click={() => dropTag(openTag, t)} title="remove">{t} ×</button>
          {/each}
          {#if !tagsOf(openTag).length}<span class="muted">no tags yet</span>{/if}
        </div>
        <form on:submit|preventDefault={() => { addTag(openTag, tagDraft); tagDraft = ''; }}>
          <input bind:value={tagDraft} placeholder="add a tag…" maxlength="24" data-testid="tag-input" />
          <button type="submit" class="chip">add</button>
          <button type="button" class="chip" on:click={() => { openTag = null; tagDraft = ''; }}>done</button>
        </form>
        <p class="muted">Yours, saved in this browser. Anything you like — "handcuff", "ask Imy", "do not".</p>
      </div>
    {/if}

    {#if tip}
      <div class="tip" style="left:{tip.x}px; top:{tip.y}px" role="tooltip">{tip.text}</div>
    {/if}

    <p class="foot muted">
      Season {raw.season} projections. <b>Sleeper</b> is their own number, league-scored by them — the same figure as your draft room, and <b>ADP</b> the price beside it.
      <b>Actual</b> adds the one league rule no projection carries: a point per fumble as well as for losing it, estimated from {raw.prior}.
      <b>ADP½</b>, <b>ADP1</b> and <b>FP</b> are the half-PPR, full-PPR and FantasyPros consensus prices — our scoring sits between the first two, so they bracket him.
      <b>VORP</b> is season points over replacement at his position, from a greedy fill of the real lineup with the men already gone taken out.
      Hover any heading for what it means. Stars, tags and your order are saved in this browser only.
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
  .rp .wl { font-style: normal; color: var(--muted); font-size: 9.5px; margin-left: 3px; }
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
  td.alt { color: var(--muted); opacity: .7; }
  td.fum { color: var(--stamp-red); opacity: .75; font-size: 10.5px; }
  td.theirs .q { font-style: normal; color: var(--brass); font-size: 9px; margin-left: 2px; }
  td.gap { color: var(--purp); }
  .edge, .gain { font-weight: 700; }
  .gain.up { color: var(--good); }
  .gain.dn { color: var(--stamp-red); }
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

  /* Open the page on the board; the explanation is one tap away and stays shut. */
  .explain {
    font-family: var(--mono); font-size: 10.5px; color: var(--muted);
    background: none; border: 1px solid var(--line); border-radius: 7px;
    padding: 5px 10px; cursor: pointer; margin-bottom: 8px; min-height: 30px;
  }
  .explain:hover { color: var(--blue-deep); border-color: var(--blue); }

  .nm .pn { vertical-align: middle; }
  .fav {
    background: none; border: 0; cursor: pointer; padding: 0 4px 0 0;
    color: var(--line-strong, #c9d4de); font-size: 12px; line-height: 1;
  }
  .fav.on { color: var(--brass); }
  .fav:hover { color: var(--brass); }
  .tagbtn {
    background: none; border: 0; cursor: pointer; padding: 0 0 0 5px;
    color: var(--line-strong, #c9d4de); font-size: 10px; opacity: 0;
  }
  tbody tr:hover .tagbtn, .tagbtn:focus-visible { opacity: 1; }
  .tagbtn:hover { color: var(--blue); }
  .tag.rk { background: var(--purp); }
  .tag.ct { background: var(--blue-wash); color: var(--blue-deep); font-weight: 700; }
  .tagchip { border-color: var(--blue-sky); }
  /* The board must never look sorted while it is showing your order instead. */
  td.my { color: var(--muted); }
  td.my.mine { color: var(--brass); font-weight: 700; }
  .mvoff { color: var(--line); font-size: 9px; }
  .chip b.ct { margin-left: 5px; font-size: 9.5px; opacity: .8; }

  .tagbox {
    position: fixed; z-index: 70; left: 50%; transform: translateX(-50%);
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: min(360px, calc(100vw - 24px));
    background: #fff; border: 1px solid var(--blue); border-radius: 10px;
    padding: 10px 12px; box-shadow: 0 10px 30px rgba(28, 78, 116, .22);
  }
  .tbhd { font-family: var(--body); font-weight: 700; font-size: 13px; color: var(--ink); margin-bottom: 6px; }
  .tbtags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; font-size: 11px; }
  .tbtags .tg {
    font-family: var(--mono); font-size: 10.5px; border: 1px solid var(--blue-sky);
    background: var(--blue-wash); color: var(--blue-deep); border-radius: 6px;
    padding: 3px 7px; cursor: pointer; min-height: 26px;
  }
  .tagbox form { display: flex; gap: 5px; }
  .tagbox input { flex: 1 1 auto; min-width: 0; font-size: 12px; min-height: 32px; }
  .tagbox p { font-size: 10px; margin: 7px 0 0; line-height: 1.5; }
  .pos-good { color: var(--good); }
  .nrw { width: 30px; }
  .mv { white-space: nowrap; }
  .mv button { border: 1px solid var(--line); background: #fff; color: var(--muted); border-radius: 4px; width: 18px; height: 18px; font-size: 8px; line-height: 1; cursor: pointer; padding: 0; }
  .mv button:hover { border-color: var(--blue); color: var(--blue); }
  .foot { font-size: 10.5px; line-height: 1.6; margin-top: 8px; max-width: 110ch; }
</style>
