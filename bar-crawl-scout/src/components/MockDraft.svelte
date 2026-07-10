<script>
  // THE WAR ROOM — mock draft simulator. A separate room you step into:
  // the app chrome hides on /mock and this page runs the show.
  import { onDestroy } from 'svelte';
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMS, TEAMSHORT, PLAYERS, BYUNAME, RYAN } from '../lib/data.js';
  import { windowVal, isAvailable } from '../lib/models.js';
  import { keepers, mode } from '../lib/store.js';
  import { leagueQuery, usersQuery, rostersQuery, realDraftQuery } from '../api/queries';
  import { draftSlotBoard } from '../api/league';
  import { createMock, makePick, gradeMock, currentHandle, roundOf, shuffle, blendValue, unfilledStarters, sequenceFromSlots, shortName, recapText } from '../lib/engine/mockdraft.ts';
  import PlayerChip from './PlayerChip.svelte';

  const leagueQ = createQuery(leagueQuery());
  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const realQ = createQuery(realDraftQuery());

  // ---- pool & league shape (skill board only — no K/DEF on the board) ----
  const SKILL = new Set(['QB', 'RB', 'WR', 'TE']);
  $: ks = $keepers;
  $: pool = PLAYERS
    .filter((p) => SKILL.has(p[2]) && isAvailable(ks, p[1]))
    .map((p) => ({
      name: p[1], pos: p[2], team: p[3], bye: p[4] || 0,
      v: { winnow: windowVal(p, ks, 'winnow'), balanced: windowVal(p, ks, 'balanced'), future: windowVal(p, ks, 'future') },
    }));
  $: positions = $leagueQ.data?.roster_positions || ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'];
  $: mockPositions = positions.filter((p) => !['K', 'DEF', 'IDP_FLEX', 'IR', 'TAXI'].includes(p));
  $: slots = mockPositions.filter((p) => p !== 'BN');
  $: rosterSize = mockPositions.length;
  $: mockRounds = Math.max(1, rosterSize - 3);

  const toMockPlayer = (name) => {
    const p = BYUNAME[(name || '').toLowerCase()];
    if (!p || !SKILL.has(p[2])) return null;
    return { name: p[1], pos: p[2], team: p[3], bye: p[4] || 0, v: { winnow: windowVal(p, ks, 'winnow'), balanced: windowVal(p, ks, 'balanced'), future: windowVal(p, ks, 'future') } };
  };
  const keepersOf = (h) => ((ks[h] || []).slice(0, 3).map((s) => s && s[0]).filter(Boolean).map(toMockPlayer).filter(Boolean));

  // ---- the REAL board: Sleeper draft slots + traded picks -> who owns each pick ----
  const HANDLESET = new Set(TEAMS.map(([h]) => h));
  $: slotBoard = draftSlotBoard($realQ.data?.draft, $realQ.data?.traded, $usersQ.data || [], $rostersQ.data || []);
  $: realOk = !!slotBoard && slotBoard.slotHandles.length === TEAMS.length && slotBoard.slotHandles.every((h) => HANDLESET.has(h));
  let orderSource = 'real'; // 'real' (Sleeper slots + trades) | 'custom' (shuffle your own)
  $: useReal = orderSource === 'real' && realOk;
  // Round-1 preview for the setup card: base slot owner, overridden by trades.
  $: round1 = realOk ? slotBoard.slotHandles.map((h, i) => {
    const ov = slotBoard.overrides.find((o) => o.round === 1 && o.slot === i + 1);
    return { slot: i + 1, handle: ov ? ov.handle : h, via: ov ? h : null };
  }) : [];
  $: tradeCount = realOk ? slotBoard.overrides.filter((o) => o.round <= mockRounds).length : 0;

  // ---- personas (persisted) + custom order ----
  const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } };
  const defaultPersonas = () => Object.fromEntries(TEAMS.map(([h]) => [h, { window: 50, chaos: 50 }]));
  let personas = { ...defaultPersonas(), ...readLS('bcs_mock_personas', {}) };
  const savePersonas = () => { personas = { ...personas }; writeLS('bcs_mock_personas', personas); };
  const PRESETS = [
    ['By the book', { chaos: 0 }], ['Chaotic', { chaos: 90 }],
    ['Win-now', { window: 10 }], ['Future', { window: 90 }], ['Balanced', { window: 50, chaos: 50 }],
  ];
  const applyPreset = (h, patch) => { personas[h] = { ...personas[h], ...patch }; savePersonas(); };

  let order = TEAMS.map(([h]) => h);
  const shuffleOrder = () => { order = shuffle(order, Date.now() & 0xffff); };
  shuffleOrder();
  const moveOrder = (i, d) => { const j = i + d; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; order = [...order]; };

  let seat = RYAN;        // which team you control
  let spectate = false;   // sim all 10, you just watch
  let clockLen = readLS('bcs_mock_clock', 0); // seconds per YOUR pick; 0 = no clock
  const setClock = (s) => { clockLen = s; writeLS('bcs_mock_clock', s); };
  const CLOCKS = [[0, 'off'], [30, '30s'], [60, '60s'], [90, '90s']];

  // ---- draft state ----
  let phase = 'setup';    // setup | live | done
  let st = null;
  let grades = null;
  let boardType = 'snake';
  let speed = 700;        // ms per bot pick when auto-playing
  let playing = false;
  let timer = null;
  let q = '';
  let sortBy = 'me';      // 'me' (your persona blend) | 'balanced'

  function start(seed = Date.now() & 0x7fffffff) {
    const teams = TEAMS.map(([h, t]) => ({
      handle: h, team: t.replace(' (YOU)', ''),
      persona: { ...personas[h] },
      keepers: keepersOf(h),
      isUser: !spectate && h === seat,
    }));
    boardType = useReal ? slotBoard.type : 'snake';
    const cfg = { teams, order: useReal ? slotBoard.slotHandles.slice() : [...order], slots, rosterSize, seed, pool };
    if (useReal) cfg.sequence = sequenceFromSlots(slotBoard.slotHandles, slotBoard.overrides, mockRounds, slotBoard.type);
    st = createMock(cfg);
    grades = null;
    clockArmedAt = -1;
    phase = 'live';
    if (spectate) play(); else toMyPick();
    checkDone();
  }

  const onClock = () => st && !st.done && currentHandle(st);
  $: userTurn = st && !spectate && onClock() === seat && !st.done;

  // Auto-play: one bot pick per `speed` ms, pausing when you're up.
  function stepBot() {
    if (!st || st.done || userTurn) { pause(); return; }
    st = makePick(st);
    checkDone();
    if (userTurn) pause();
  }
  function play() { stopFF(); if (playing) return; playing = true; timer = setInterval(stepBot, speed); }
  function pause() { playing = false; if (timer) { clearInterval(timer); timer = null; } }
  function setSpeed(ms) { speed = ms; if (playing) { pause(); play(); } }

  // Fast-forward: tick the picks through ONE BY ONE so the board fills before
  // your eyes — "sim to my pick" at a steady clip, "sim to end" accelerating.
  let ffwd = false;
  let ffTimer = null;
  function stopFF() { ffwd = false; if (ffTimer) { clearTimeout(ffTimer); ffTimer = null; } }
  const atUser = () => !spectate && st && !st.done && currentHandle(st) === seat;
  function runFF(stop, ms, accel = 1) {
    pause(); stopFF();
    ffwd = true;
    const tickOnce = (delay) => {
      ffTimer = setTimeout(() => {
        if (!st || st.done || stop()) { stopFF(); return; }
        st = makePick(st);
        checkDone();
        if (!st || st.done || stop()) { stopFF(); return; }
        tickOnce(Math.max(30, delay * accel));
      }, delay);
    };
    tickOnce(ms);
  }
  function toMyPick() { if (ffwd) { stopFF(); return; } runFF(atUser, 260); }
  function toEnd() { if (ffwd) { stopFF(); return; } runFF(() => false, 200, 0.93); }
  function pick(name) { if (!userTurn) return; st = makePick(st, name); checkDone(); if (st && !st.done) runFF(atUser, 260); }
  function autoPick() { if (!userTurn) return; st = makePick(st); checkDone(); if (st && !st.done) runFF(atUser, 260); }
  function checkDone() {
    if (st && st.done && phase === 'live') {
      pause(); stopFF(); grades = gradeMock(st); phase = 'done'; saveHistory();
    }
  }

  // The pick clock: your picks are on a timer (like a real draft night).
  // Arms once per turn (keyed by cursor), auto-picks at zero. Bots are exempt.
  let clockLeft = 0;
  let clockTimer = null;
  let clockArmedAt = -1;
  function disarmClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }
  function armClock(cursor) {
    disarmClock();
    clockArmedAt = cursor;
    clockLeft = clockLen;
    clockTimer = setInterval(() => {
      clockLeft -= 1;
      if (clockLeft <= 0) { disarmClock(); if (userTurn) autoPick(); }
    }, 1000);
  }
  $: if (phase === 'live' && userTurn && clockLen > 0 && st && clockArmedAt !== st.cursor) armClock(st.cursor);
  $: if (clockTimer && (phase !== 'live' || !userTurn)) disarmClock();
  const fmtClock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

  onDestroy(() => { pause(); stopFF(); disarmClock(); });

  // ---- your live pick list ----
  $: myPersona = personas[seat] || { window: 50, chaos: 50 };
  $: available = st ? [...st.pool]
    .map((p) => ({ ...p, me: Math.round(blendValue(p, myPersona.window)) }))
    .sort((a, b) => (sortBy === 'me' ? b.me - a.me : b.v.balanced - a.v.balanced))
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.pos.toLowerCase() === q.toLowerCase())
    : [];
  $: myRoster = st ? st.rosters[seat] || [] : [];
  $: myHoles = st ? unfilledStarters(myRoster, slots) : [];

  // ---- history ----
  let history = readLS('bcs_mock_history', []);
  function saveHistory() {
    const entry = {
      at: new Date().toLocaleString(), seed: st.cfg.seed, order: st.cfg.order,
      rows: grades.rows.map((r) => ({ handle: r.handle, total: r.total, grade: r.grade, lean: r.lean })),
      log: st.log.map((p) => ({ o: p.overall, r: p.round, h: p.handle, n: p.player.name, pos: p.player.pos })),
    };
    history = [entry, ...history].slice(0, 10);
    writeLS('bcs_mock_history', history);
  }
  let viewOld = null;

  // ---- copy the debrief for the group chat ----
  let copied = false;
  async function copyRecap() {
    const text = recapText(st, grades, {
      nameOf: nm,
      seat: spectate ? undefined : seat,
      when: new Date().toLocaleDateString(),
      url: 'https://ryan-withers.github.io/bar-crawl-scout/mock',
    });
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 2500);
    } catch {
      // Clipboard blocked (old browser / no permission): show the text instead.
      window.prompt('Copy it yourself, champ:', text);
    }
  }

  // ---- the wall board: slots across, rounds down, filling in live ----
  const nm = (h) => TEAMSHORT[h] || h;
  const POSC = { QB: '#B07818', RB: '#1D8A4E', WR: '#2F7FB8', TE: '#8A4FBF' };
  $: Ncols = st ? st.cfg.order.length : 0;
  $: gridOk = st && Ncols > 0 && st.seq.length % Ncols === 0;
  $: totalRounds = gridOk ? st.seq.length / Ncols : 0;
  // seq index for (0-based round r, 0-based column c): even rounds reverse on a snake.
  const seqIdx = (r, c, N) => r * N + (boardType === 'snake' && r % 2 === 1 ? N - 1 - c : c);

  // Keep the on-the-clock cell in view as the picks tick through.
  let boardEl;
  $: if (boardEl && st) followClock(st.cursor);
  function followClock() {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      const el = boardEl && boardEl.querySelector('.cur');
      if (!el || !boardEl) return;
      const br = boardEl.getBoundingClientRect(); const er = el.getBoundingClientRect();
      boardEl.scrollLeft += er.left - br.left - br.width / 2 + er.width / 2;
      boardEl.scrollTop += er.top - br.top - br.height / 2 + er.height / 2;
    });
  }
</script>

<section class="warroom">
  <div class="wrtop">
    <a href="/board" use:link class="back">← Draft Room</a>
    <div class="wrtitle">THE WAR ROOM <span>· mock draft simulator</span></div>
    {#if phase !== 'setup'}<button class="ghost" on:click={() => { pause(); stopFF(); phase = 'setup'; viewOld = null; }}>New setup</button>{/if}
  </div>

  {#if phase === 'setup'}
    <p class="blurb">Everyone's keepers are locked out of the pool — you draft the rest. The order comes straight off Sleeper — <b>traded picks included</b> — or roll your own. Every computer GM has two dials: <b>window</b> (win-now ↔ future) and <b>chaos</b> (by the book ↔ anything can happen). Skill positions only — K/DEF aren't on the board, draft those with your gut on the day.</p>

    <div class="setgrid">
      <div class="setcard">
        <div class="sethd">Your seat</div>
        <select bind:value={seat} disabled={spectate}>
          {#each TEAMS as [h, t]}<option value={h}>{t.replace(' (YOU)', '')}</option>{/each}
        </select>
        <label class="chk"><input type="checkbox" bind:checked={spectate} /> Spectate — sim all 10, I'll watch</label>
        <div class="clockrow" class:dim={spectate}>
          <span class="clocklbl">⏱ Pick clock</span>
          {#each CLOCKS as [s, label]}
            <button class="mini" class:on={clockLen === s} disabled={spectate} on:click={() => setClock(s)}>{label}</button>
          {/each}
        </div>
        {#if clockLen && !spectate}<div class="meta">Clock hits zero on your pick → best available, no mercy.</div>{/if}
        <div class="meta">{rosterSize} roster spots · keepers count · ~{mockRounds} rounds</div>
      </div>

      <div class="setcard">
        <div class="sethd">Draft order
          {#if realOk}
            <span class="srcchips">
              <button class="mini" class:on={orderSource === 'real'} on:click={() => (orderSource = 'real')}>🏛 real board</button>
              <button class="mini" class:on={orderSource === 'custom'} on:click={() => (orderSource = 'custom')}>🎲 custom</button>
            </span>
          {:else}
            <button class="mini" on:click={shuffleOrder}>🎲 shuffle</button>
          {/if}
        </div>
        {#if useReal}
          <div class="meta">Sleeper {slotBoard.season} board · {slotBoard.type} · {tradeCount} traded pick{tradeCount === 1 ? '' : 's'} honored</div>
          <ol class="orderlist">
            {#each round1 as r}
              <li><span class="on">{r.slot}</span> {nm(r.handle)}
                {#if r.via}<em class="via">via {nm(r.via)}</em>{/if}
              </li>
            {/each}
          </ol>
        {:else}
          {#if realOk}<div class="meta"><button class="mini" on:click={shuffleOrder}>🎲 shuffle</button></div>{/if}
          <ol class="orderlist">
            {#each order as h, i}
              <li><span class="on">{i + 1}</span> {nm(h)}
                <span class="arrows">
                  <button class="mini" on:click={() => moveOrder(i, -1)} disabled={i === 0} aria-label="up">↑</button>
                  <button class="mini" on:click={() => moveOrder(i, 1)} disabled={i === order.length - 1} aria-label="down">↓</button>
                </span>
              </li>
            {/each}
          </ol>
        {/if}
      </div>
    </div>

    <div class="sethd big">The GMs <span class="sub">defaults: everyone balanced · sliders are per-team</span></div>
    <div class="personas">
      {#each TEAMS as [h, t]}
        <div class="pcard" class:you={h === seat && !spectate}>
          <div class="pname">{t.replace(' (YOU)', '')} {#if h === seat && !spectate}<em>YOU</em>{/if}</div>
          <label class="slide">
            <span class="ends"><i>WIN-NOW</i><i>FUTURE</i></span>
            <input type="range" min="0" max="100" bind:value={personas[h].window} on:change={savePersonas} aria-label="{nm(h)} window" />
          </label>
          <label class="slide">
            <span class="ends"><i>BY THE BOOK</i><i>CHAOTIC</i></span>
            <input type="range" min="0" max="100" bind:value={personas[h].chaos} on:change={savePersonas} aria-label="{nm(h)} chaos" />
          </label>
          <div class="presets">
            {#each PRESETS as [label, patch]}<button class="mini" on:click={() => applyPreset(h, patch)}>{label}</button>{/each}
          </div>
        </div>
      {/each}
    </div>

    <button class="go" on:click={() => start()}>▶ Start the mock</button>

    {#if history.length}
      <div class="sethd big">Past mocks <span class="sub">saved on this device</span></div>
      <div class="hist">
        {#each history as hEntry, i}
          <button class="histrow" on:click={() => (viewOld = viewOld === i ? null : i)}>
            <span>{hEntry.at}</span>
            <span class="hgrades">{hEntry.rows.slice(0, 3).map((r) => `${nm(r.handle)} ${r.grade}`).join(' · ')}</span>
          </button>
          {#if viewOld === i}
            <div class="histboard">
              {#each hEntry.rows as r, ri}<div class="hrow"><b>#{ri + 1}</b> {nm(r.handle)} <span class="hg">{r.grade}</span> <span class="hl">{r.lean}</span> <span class="ht">{r.total}</span></div>{/each}
            </div>
          {/if}
        {/each}
      </div>
    {/if}

  {:else if phase === 'live'}
    <div class="clockbar" class:yours={userTurn}>
      {#if userTurn}
        <b>YOU'RE ON THE CLOCK</b> — Rd {roundOf(st)}, pick {st.log.length + 1}
        {#if clockLen > 0}<span class="pickclock" class:low={clockLeft <= 10}>⏱ {fmtClock(clockLeft)}</span>{/if}
      {:else if !st.done}
        <b>Rd {roundOf(st)} · Pick {st.log.length + 1}</b> — {nm(onClock())} thinking…
      {/if}
      <span class="controls">
        {#if !spectate}<button on:click={toMyPick} disabled={userTurn && !ffwd}>{ffwd ? '⏹ stop' : '⏩ sim to my pick'}</button>{/if}
        <button on:click={playing ? pause : play} disabled={userTurn || ffwd}>{playing ? '⏸ pause' : '▶ auto'}</button>
        <button on:click={toEnd}>{ffwd ? '⏹ stop' : '⏭ sim to end'}</button>
        <span class="speed">
          <button class:on={speed === 1200} on:click={() => setSpeed(1200)}>slow</button>
          <button class:on={speed === 700} on:click={() => setSpeed(700)}>med</button>
          <button class:on={speed === 250} on:click={() => setSpeed(250)}>fast</button>
        </span>
      </span>
    </div>

    {#if gridOk}
      <div class="dboardwrap" bind:this={boardEl}>
        <table class="dboard">
          <thead><tr><th class="rd"></th>{#each st.cfg.order as h, c}<th><i>{c + 1}</i> {h}</th>{/each}</tr></thead>
          <tbody>
            {#each Array(totalRounds) as _, r}
              <tr><td class="rd">{r + 1}</td>
                {#each Array(Ncols) as _, c}
                  {@const idx = seqIdx(r, c, Ncols)}
                  {@const p = st.log[idx]}
                  <td class="dcell" class:cur={idx === st.cursor} class:mine={!spectate && st.seq[idx] === seat}>
                    {#if p}
                      <span class="dpk" class:fresh={p.overall === st.log.length} style="--pc:{POSC[p.player.pos] || '#5C6B7A'}"><b>{shortName(p.player.name)}</b><i>{p.player.pos} · {p.handle}</i></span>
                    {:else if idx === st.cursor}
                      <span class="onclk">⏱ {st.seq[idx]}</span>
                    {:else}
                      <span class="todo">{st.seq[idx]}</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <div class="livegrid">
      <div class="poolpane">
        {#if userTurn}
          <div class="pickhd">Make your pick <button class="mini" on:click={autoPick}>🤖 autopick</button></div>
          <div class="poolbar">
            <input class="search" placeholder="search name or pos…" bind:value={q} />
            <button class="mini" class:on={sortBy === 'me'} on:click={() => (sortBy = 'me')}>my board</button>
            <button class="mini" class:on={sortBy === 'balanced'} on:click={() => (sortBy = 'balanced')}>balanced</button>
          </div>
        {:else}
          <div class="pickhd">Best available</div>
        {/if}
        <div class="pool">
          {#each available.slice(0, 30) as p (p.name)}
            <div class="prow">
              <span class="pos" style="--pc:{POSC[p.pos] || '#5C6B7A'}">{p.pos}</span>
              <span class="pn">{p.name} <small>{p.team}{p.bye ? ' · bye ' + p.bye : ''}</small></span>
              <span class="pv" title="your blend / balanced">{p.me}</span>
              {#if userTurn}<button class="pickbtn" on:click={() => pick(p.name)}>PICK</button>{/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="sidepane">
        <div class="pickhd">Latest picks</div>
        <div class="log">
          {#each [...st.log].reverse().slice(0, 12) as p (p.overall)}
            <div class="lrow"><span class="lo">{p.overall}</span> <b>{nm(p.handle)}</b> {p.player.name} <span class="pos sm" style="--pc:{POSC[p.player.pos] || '#5C6B7A'}">{p.player.pos}</span></div>
          {/each}
          {#if !st.log.length}<div class="lrow muted">No picks yet — hit ▶</div>{/if}
        </div>
        {#if !spectate}
          <div class="pickhd">Your roster <span class="sub">{myRoster.length}/{rosterSize}</span></div>
          <div class="mine">
            {#each myRoster as p, i}
              <div class="lrow"><span class="pos sm" style="--pc:{POSC[p.pos] || '#5C6B7A'}">{p.pos}</span> {p.name}{#if i < 3}<em class="ktag">K</em>{/if}</div>
            {/each}
          </div>
          {#if myHoles.length}<div class="need">Still need: {myHoles.join(', ')}</div>{/if}
        {/if}
      </div>
    </div>

  {:else if phase === 'done' && grades}
    <div class="donebar">🏁 Mock complete — {st.log.length} picks.
      <button class="ghost copybtn" class:did={copied} on:click={copyRecap}>{copied ? '✓ copied — go stir the pot' : '📋 copy for the group chat'}</button>
      <button class="ghost" on:click={() => start()}>🔁 run it back (new seed)</button>
    </div>

    <div class="sethd big">Draft grades</div>
    <div class="gradeboard">
      {#each grades.rows as r, i}
        <div class="grow" class:you={r.handle === seat && !spectate}>
          <span class="grk">#{i + 1}</span>
          <span class="gnm">{nm(r.handle)}</span>
          <span class="glean">{r.lean}</span>
          <span class="gpos">{Object.entries(r.posCounts).map(([p, n]) => `${n}${p}`).join(' ')}</span>
          <span class="gtot">{r.total}</span>
          <span class="ggr">{r.grade}</span>
        </div>
      {/each}
    </div>

    {#if grades.steals.length || grades.reaches.length}
      <div class="twocol">
        <div>
          <div class="sethd big">💎 Steals</div>
          {#each grades.steals as p}<div class="srow">{p.player.name} <small>to {nm(p.handle)} — pick {p.overall}, board #{p.boardRank}</small></div>
          {:else}<div class="srow muted">None — a disciplined room.</div>{/each}
        </div>
        <div>
          <div class="sethd big">🚨 Reaches</div>
          {#each grades.reaches as p}<div class="srow">{p.player.name} <small>by {nm(p.handle)} — pick {p.overall}, board #{p.boardRank}</small></div>
          {:else}<div class="srow muted">None flagged.</div>{/each}
        </div>
      </div>
    {/if}

    {#if !spectate}
      <div class="sethd big">Your team</div>
      <div class="focus">
        {#each myRoster as p, i}
          <div class="lrow"><span class="pos sm" style="--pc:{POSC[p.pos] || '#5C6B7A'}">{p.pos}</span> <PlayerChip name={p.name} />{#if i < 3}<em class="ktag">KEEPER</em>{/if} <span class="pv">{p.v.balanced}</span></div>
        {/each}
        {#if myHoles.length}<div class="need">Unfilled starters: {myHoles.join(', ')}</div>{:else}<div class="need ok">✓ Full legal lineup drafted</div>{/if}
      </div>
    {/if}

    <div class="sethd big">The full board</div>
    {#if gridOk}
      <div class="dboardwrap full">
        <table class="dboard">
          <thead><tr><th class="rd"></th>{#each st.cfg.order as h, c}<th><i>{c + 1}</i> {h}</th>{/each}</tr></thead>
          <tbody>
            {#each Array(totalRounds) as _, r}
              <tr><td class="rd">{r + 1}</td>
                {#each Array(Ncols) as _, c}
                  {@const idx = seqIdx(r, c, Ncols)}
                  {@const p = st.log[idx]}
                  <td class="dcell" class:mine={!spectate && st.seq[idx] === seat}>
                    {#if p}<span class="dpk" style="--pc:{POSC[p.player.pos] || '#5C6B7A'}"><b>{shortName(p.player.name)}</b><i>{p.player.pos} · {p.handle}</i></span>{/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</section>

<style>
  .warroom { max-width: 1100px; padding-top: 10px; }
  .wrtop { display: flex; align-items: center; gap: 14px; padding: 10px 0 14px; border-bottom: 2px solid var(--blue); margin-bottom: 14px; flex-wrap: wrap; }
  .back { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--accent); text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
  .wrtitle { font-family: 'Archivo Black', sans-serif; font-size: clamp(18px, 3vw, 26px); color: var(--blue-deep); }
  .wrtitle span { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); }
  .ghost { margin-left: auto; font-family: 'IBM Plex Mono', monospace; font-size: 11px; background: var(--field-3); border: 1px solid var(--line); color: var(--chalk); border-radius: 7px; padding: 7px 12px; cursor: pointer; }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); line-height: 1.7; max-width: 80ch; } .blurb b { color: var(--chalk); }

  .setgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0; }
  .setcard { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
  .sethd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sethd.big { margin-top: 22px; } .sethd .sub { font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 400; text-transform: none; color: var(--muted); }
  .srcchips { display: flex; gap: 5px; }
  .chk { display: flex; gap: 8px; align-items: center; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--chalk); margin-top: 10px; cursor: pointer; }
  .clockrow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .clockrow.dim { opacity: .45; }
  .clocklbl { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--chalk); }
  .pickclock { font-family: 'Archivo Black', sans-serif; font-size: 15px; color: var(--blue-deep); background: #fff; border: 1px solid var(--blue); border-radius: 7px; padding: 3px 10px; }
  .pickclock.low { color: #fff; background: var(--stamp-red); border-color: var(--stamp-red); animation: clockpulse .9s ease-in-out infinite; }
  @keyframes clockpulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
  .meta { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); margin-top: 10px; }
  .orderlist { list-style: none; margin: 0; padding: 0; }
  .orderlist li { display: flex; align-items: center; gap: 8px; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--chalk); padding: 3px 0; flex-wrap: wrap; }
  .orderlist .on { color: var(--accent); font-weight: 700; width: 20px; }
  .via { font-style: normal; font-size: 9px; color: var(--muted); background: var(--field-3); border-radius: 3px; padding: 1px 6px; }
  .arrows { margin-left: auto; display: flex; gap: 4px; }
  .mini { font-family: 'IBM Plex Mono', monospace; font-size: 10px; background: var(--field-3); border: 1px solid var(--line); color: var(--chalk); border-radius: 5px; padding: 3px 8px; cursor: pointer; min-height: 26px; }
  .mini.on { background: var(--blue); color: #fff; border-color: var(--blue); }
  .mini:disabled { opacity: .35; cursor: default; }

  .personas { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; }
  .pcard { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .pcard.you { border-color: var(--blue); box-shadow: 0 3px 12px -6px rgba(47,127,184,.4); }
  .pname { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 13.5px; color: var(--chalk); margin-bottom: 8px; }
  .pname em { font-style: normal; font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: #fff; background: var(--blue); border-radius: 3px; padding: 1px 6px; margin-left: 6px; }
  .slide { display: block; margin-bottom: 6px; }
  .ends { display: flex; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: .06em; color: var(--muted); }
  .slide input[type=range] { width: 100%; accent-color: var(--blue); }
  .presets { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }

  .go { font-family: 'Archivo Black', sans-serif; font-size: 16px; text-transform: uppercase; background: var(--blue); color: #fff; border: none; border-radius: 10px; padding: 14px 26px; cursor: pointer; margin-top: 18px; min-height: 48px; }
  .go:hover { background: var(--blue-deep); }

  .hist { display: flex; flex-direction: column; gap: 6px; }
  .histrow { display: flex; justify-content: space-between; gap: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 8px; padding: 9px 12px; cursor: pointer; color: var(--chalk); text-align: left; }
  .hgrades { color: var(--muted); }
  .histboard { background: var(--field-3); border-radius: 8px; padding: 8px 12px; }
  .hrow { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--chalk); display: flex; gap: 10px; padding: 2px 0; }
  .hrow .hg { color: var(--blue); font-weight: 700; } .hrow .hl, .hrow .ht { color: var(--muted); margin-left: auto; }

  .clockbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--chalk); margin-bottom: 12px; box-shadow: 0 6px 14px -8px rgba(28,46,64,.25); }
  .clockbar.yours { border-color: var(--blue); background: var(--blue-wash); }
  .controls { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .controls button { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; background: #fff; border: 1px solid var(--line); color: var(--chalk); border-radius: 6px; padding: 6px 10px; cursor: pointer; min-height: 32px; }
  .controls button:disabled { opacity: .4; }
  .speed { display: flex; gap: 3px; } .speed button.on { background: var(--blue); color: #fff; border-color: var(--blue); }

  /* THE WALL BOARD — slots across, rounds down, filling in pick by pick. */
  .dboardwrap { overflow: auto; max-height: 330px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 6px; margin-bottom: 12px; scroll-behavior: smooth; }
  .dboardwrap.full { max-height: none; }
  .dboard { border-collapse: collapse; font-family: 'IBM Plex Mono', monospace; font-size: 10px; }
  .dboard th { position: sticky; top: 0; z-index: 2; background: var(--barroom-lift); font-size: 8.5px; text-transform: uppercase; color: var(--muted); padding: 4px 5px; text-align: left; max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dboard th i { font-style: normal; color: var(--blue); font-weight: 700; }
  .dboard .rd { position: sticky; left: 0; z-index: 1; background: var(--barroom-lift); color: var(--muted); font-weight: 700; padding: 2px 6px; }
  .dboard th.rd { z-index: 3; }
  .dcell { min-width: 88px; max-width: 110px; border: 1px dashed var(--line); padding: 2px 3px; vertical-align: top; }
  .dcell.mine { background: rgba(130, 201, 252, 0.10); }
  .dcell.cur { background: var(--blue-wash); box-shadow: inset 0 0 0 2px var(--blue); }
  .dpk { display: block; border-left: 3px solid var(--pc); padding: 1px 5px; }
  .dpk b { display: block; color: var(--chalk); font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dpk i { font-style: normal; color: var(--muted); font-size: 8.5px; white-space: nowrap; }
  .dpk.fresh { animation: dpop .4s ease; }
  @keyframes dpop { 0% { transform: scale(.7); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  .todo { color: var(--muted); opacity: .6; font-size: 8.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .dcell.mine .todo { color: var(--blue-deep); opacity: .9; font-weight: 700; }
  .onclk { color: var(--blue-deep); font-weight: 700; font-size: 9px; white-space: nowrap; display: block; }

  .livegrid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; align-items: start; }
  .poolpane, .sidepane { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .pickhd { font-family: 'Archivo Black', sans-serif; font-size: 12px; text-transform: uppercase; color: var(--chalk); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .pickhd .sub { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); }
  .poolbar { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; } .poolbar .search { flex: 1; min-width: 140px; }
  .pool { max-height: 56vh; overflow-y: auto; }
  .prow { display: flex; align-items: center; gap: 9px; padding: 6px 2px; border-bottom: 1px dashed var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .pos { flex: none; width: 30px; text-align: center; font-size: 9px; font-weight: 700; color: #fff; background: var(--pc); border-radius: 4px; padding: 2px 0; }
  .pos.sm { width: 26px; font-size: 8px; }
  .pn { flex: 1; color: var(--chalk); min-width: 0; } .pn small { color: var(--muted); font-size: 10px; }
  .pv { font-weight: 700; color: var(--blue-deep); }
  .pickbtn { font-family: 'Archivo Black', sans-serif; font-size: 10px; background: var(--blue); color: #fff; border: none; border-radius: 6px; padding: 6px 11px; cursor: pointer; min-height: 30px; }
  .log, .mine { margin-bottom: 8px; }
  .lrow { display: flex; align-items: center; gap: 7px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--chalk); padding: 3px 0; }
  .lrow .lo { color: var(--muted); width: 26px; text-align: right; } .lrow.muted, .muted { color: var(--muted); }
  .ktag { font-style: normal; font-size: 8px; color: #fff; background: var(--brass); border-radius: 3px; padding: 1px 5px; }
  .need { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--stamp-red); }
  .need.ok { color: var(--good); }

  .donebar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--chalk); background: var(--blue-wash); border: 1px solid var(--blue); border-radius: 10px; padding: 10px 14px; }
  .copybtn { background: var(--blue); color: #fff; border-color: var(--blue); }
  .copybtn.did { background: var(--good); border-color: var(--good); }
  .gradeboard { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; }
  .grow { display: grid; grid-template-columns: 34px 1fr auto auto 56px 40px; gap: 10px; align-items: center; padding: 8px 4px; border-bottom: 1px dashed var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .grow:last-child { border-bottom: none; } .grow.you { background: var(--blue-wash); border-radius: 6px; }
  .grk { color: var(--muted); font-weight: 700; } .gnm { font-family: 'Archivo', sans-serif; font-weight: 700; color: var(--chalk); }
  .glean, .gpos { color: var(--muted); font-size: 10px; } .gtot { text-align: right; font-weight: 700; color: var(--chalk); }
  .ggr { font-family: 'Archivo Black', sans-serif; font-size: 16px; color: var(--blue); text-align: center; }
  .twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .srow { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--chalk); padding: 4px 0; border-bottom: 1px dashed var(--line); }
  .srow small { color: var(--muted); }
  .focus { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }

  @media (max-width: 760px) {
    .setgrid, .livegrid, .twocol { grid-template-columns: 1fr; }
    .grow { grid-template-columns: 28px 1fr auto 36px; }
    .glean, .gpos { display: none; }
    .pool { max-height: 44vh; }
    .dboardwrap { max-height: 260px; }
    .dcell { min-width: 76px; }

    /* Compact header: back link + New setup share row 1, the title takes row 2. */
    .wrtop { padding: 4px 0 8px; margin-bottom: 10px; row-gap: 0; }
    .wrtitle { order: 3; flex-basis: 100%; }
    .back { min-height: 38px; }

    /* Clock controls: full-width row, evenly stretched, thumb-sized. */
    .clockbar { padding: 8px 10px; font-size: 12px; }
    .controls { margin-left: 0; width: 100%; }
    .controls > button { flex: 1 1 auto; min-height: 42px; }
    .speed button { min-height: 42px; padding: 6px 12px; }

    /* Thumb-sized actions: PICK, autopick/sort/preset chips, order arrows. */
    .pickbtn { min-height: 40px; padding: 8px 14px; }
    .prow { padding: 8px 2px; }
    .mini { min-height: 34px; padding: 5px 10px; }
    .go { width: 100%; }
  }
</style>
