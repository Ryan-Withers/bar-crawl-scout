<script>
  // THE WAR ROOM — a live draft room, not a form with a table under it.
  // The app chrome hides on /mock, so this page owns the whole screen: a lobby
  // you configure, a board that runs the show, and a debrief that hands out
  // grades. Everything that can be pure lives in lib/engine/mockdraft.ts.
  import { onDestroy } from 'svelte';
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMS, TEAMSHORT, PLAYERS, BYUNAME, RYAN, byName } from '../lib/data.js';
  import { windowVal, isAvailable } from '../lib/models.js';
  import { keepers } from '../lib/store.js';
  import { leagueQuery, usersQuery, rostersQuery, realDraftQuery, playersQuery } from '../api/queries';
  import { draftSlotBoard, userHandleMap } from '../api/league';
  import { keeperBoard, keeperLedger, liveSequence, liveSequenceMeta, liveCells } from '../lib/engine/keepers';
  import {
    createMock, makePick, gradeMock, currentHandle, shuffle, sequenceFromSlots, recapText, shortName,
    autoPickName, queueTop, toggleQueued, moveQueued, pruneQueue,
    pushSnapshot, undoLast, rewindToHandle, pickCode,
    focusWindow, focusOf, flexPositions, needPositions,
  } from '../lib/engine/mockdraft.ts';
  import DraftLobby from './draft/DraftLobby.svelte';
  import ClockBar from './draft/ClockBar.svelte';
  import DraftBoard from './draft/DraftBoard.svelte';
  import PlayerPool from './draft/PlayerPool.svelte';
  import QueuePanel from './draft/QueuePanel.svelte';
  import RosterPanel from './draft/RosterPanel.svelte';
  import FeedPanel from './draft/FeedPanel.svelte';
  import PickReveal from './draft/PickReveal.svelte';
  import Debrief from './draft/Debrief.svelte';

  const leagueQ = createQuery(leagueQuery());
  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const realQ = createQuery(realDraftQuery());
  const playersQ = createQuery(playersQuery());

  // ---- pool & league shape (skill board only — no K/DEF on the board) ----
  const SKILL = new Set(['QB', 'RB', 'WR', 'TE']);
  $: ks = $keepers;
  $: pool = PLAYERS
    .filter((p) => SKILL.has(p[2]) && isAvailable(ks, p[1]))
    .map((p) => ({
      name: p[1], pos: p[2], team: p[3], bye: p[4] || 0, stage: p[6] || '',
      v: { winnow: windowVal(p, ks, 'winnow'), balanced: windowVal(p, ks, 'balanced'), future: windowVal(p, ks, 'future') },
    }));
  $: positions = $leagueQ.data?.roster_positions || ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'];
  $: mockPositions = positions.filter((p) => !['K', 'DEF', 'IDP_FLEX', 'IR', 'TAXI'].includes(p));
  $: slots = mockPositions.filter((p) => p !== 'BN');
  $: rosterSize = mockPositions.length;

  // ---- THE LIVE BOARD ----
  //
  // The live draft is NOT "the first N rounds". Keepers sit at the bottom, and
  // Sleeper puts each man's keepers on the latest picks he still OWNS — so the
  // two managers who sold a 15th have a keeper riding up into round 12, and the
  // two who bought them keep a live pick in round 13. Truncating the board at a
  // round count hands one pair a pick they do not have and takes one off the
  // other pair.
  //
  // So: build the whole 15-round board, mark the keeper cells where they really
  // fall, and let what is left BE the sequence.
  $: draftRounds = $realQ.data?.draft?.settings?.rounds || 15;
  $: maxKeepers = Number($leagueQ.data?.settings?.max_keepers ?? 3);
  $: liveLedger = ($rostersQ.data && $usersQ.data && $playersQ.data)
    ? keeperLedger($rostersQ.data, userHandleMap($usersQ.data), (id) => {
        const p = $playersQ.data[String(id)];
        return p ? { name: p[0], pos: p[1] } : null;
      })
    : {};
  $: rosterHandle = Object.fromEntries(($rostersQ.data || []).map((r) => [r.roster_id, userHandleMap($usersQ.data || [])[r.owner_id]]));
  $: kBoard = slotBoard ? keeperBoard(slotBoard, draftRounds, liveLedger, $realQ.data?.picks, rosterHandle) : null;
  $: realSeq = kBoard ? liveSequence(kBoard) : null;
  $: realSeqMeta = kBoard ? liveSequenceMeta(kBoard) : null;
  // The fallback when Sleeper is unreachable: rounds minus the keeper allowance.
  // rosterSize excludes the IDP_FLEX seat, so count rounds off the DRAFT, not the
  // trimmed roster — that off-by-one ran every mock a full round short.
  $: mockRounds = Math.max(1, draftRounds - maxKeepers);

  const toMockPlayer = (name) => {
    // byName, not a raw BYUNAME hit: Sleeper says "Kenneth Walker" where the
    // board says "Kenneth Walker III", and a miss here silently leaves a team
    // one keeper short rather than erroring.
    const p = byName(name);
    if (!p || !SKILL.has(p[2])) return null;
    return { name: p[1], pos: p[2], team: p[3], bye: p[4] || 0, stage: p[6] || '', v: { winnow: windowVal(p, ks, 'winnow'), balanced: windowVal(p, ks, 'balanced'), future: windowVal(p, ks, 'future') } };
  };
  const keepersOf = (h) => ((ks[h] || []).slice(0, 3).map((s) => s && s[0]).filter(Boolean).map(toMockPlayer).filter(Boolean));

  // ---- the REAL board: Sleeper draft slots + traded picks -> pick ownership ----
  const HANDLESET = new Set(TEAMS.map(([h]) => h));
  $: slotBoard = draftSlotBoard($realQ.data?.draft, $realQ.data?.traded, $usersQ.data || [], $rostersQ.data || []);
  $: realOk = !!slotBoard && slotBoard.slotHandles.length === TEAMS.length && slotBoard.slotHandles.every((h) => HANDLESET.has(h));
  let orderSource = 'real'; // 'real' (Sleeper slots + trades) | 'custom'
  $: useReal = orderSource === 'real' && realOk;
  $: round1 = realOk ? slotBoard.slotHandles.map((h, i) => {
    const ov = slotBoard.overrides.find((o) => o.round === 1 && o.slot === i + 1);
    return { slot: i + 1, handle: ov ? ov.handle : h, via: ov ? h : null };
  }) : [];
  // Count the trades that land on a pick somebody will actually make. Filtering
  // by round dropped the round-12 trade, which is live for eight of the ten.
  $: liveKeys = kBoard ? new Set(liveCells(kBoard).map((c) => `${c.round}:${c.slot}`)) : null;
  $: tradeCount = realOk
    ? (liveKeys
        ? slotBoard.overrides.filter((o) => liveKeys.has(`${o.round}:${o.slot}`)).length
        : slotBoard.overrides.filter((o) => o.round <= mockRounds).length)
    : 0;

  // ---- persisted lobby settings ----
  const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } };
  const defaultPersonas = () => Object.fromEntries(TEAMS.map(([h]) => [h, { window: 50, chaos: 50 }]));
  let personas = { ...defaultPersonas(), ...readLS('bcs_mock_personas', {}) };
  const savePersonas = () => { personas = { ...personas }; writeLS('bcs_mock_personas', personas); };
  const setPersona = (h, patch) => { personas[h] = { ...personas[h], ...patch }; savePersonas(); };
  const resetPersonas = () => { personas = defaultPersonas(); savePersonas(); };

  let order = TEAMS.map(([h]) => h);
  const shuffleOrder = () => { order = shuffle(order, Date.now() & 0xffff); };
  shuffleOrder();
  const moveOrder = (i, d) => { const j = i + d; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; order = [...order]; };

  let seat = RYAN;
  let spectate = false;
  let clockLen = readLS('bcs_mock_clock', 0); // seconds on YOUR pick; 0 = no clock
  const setClock = (s) => { clockLen = s; writeLS('bcs_mock_clock', s); };

  // ---- draft state ----
  let phase = 'lobby';       // lobby | live | done
  let st = null;
  let hist = [];             // snapshots taken BEFORE each pick — the undo stack
  let grades = null;
  let boardType = 'snake';
  let speed = 700;           // ms a bot spends "thinking"
  let mobileTab = 'board';   // board | players | team | feed
  let boardCmp;

  const nm = (h) => TEAMSHORT[h] || h;
  const isUserTurn = () => !spectate && !!st && !st.done && currentHandle(st) === seat;
  $: userTurn = !spectate && !!st && !st.done && currentHandle(st) === seat;
  $: myRoster = st && seat ? st.rosters[seat] || [] : [];
  $: keeperCount = st && seat ? (st.cfg.teams.find((t) => t.handle === seat)?.keepers.length || 0) : 0;
  $: myPersona = personas[seat] || { window: 50, chaos: 50 };

  // ---- YOUR FOCUS — win-now / balanced / future, changeable any time --------
  // The persona dial stays the source of truth so the lobby slider and the
  // three buttons can't disagree. Mid-draft it also has to reach INTO the
  // running state: cfg carries the persona the autopick bot drafts with, so a
  // focus change has to land there too or your board and your autopick split.
  $: myFocus = focusOf(myPersona.window);
  function setFocus(f) {
    setPersona(seat, { window: focusWindow(f) });
    if (st && !spectate) {
      const t = st.cfg.teams.find((x) => x.handle === seat);
      if (t) { t.persona = { ...t.persona, window: focusWindow(f) }; st = st; }
    }
  }
  // What the pool's FLX button accepts, and which positions still start for you.
  $: flexPos = flexPositions(slots);
  $: myNeeds = (!spectate && st) ? needPositions(myRoster, slots) : [];
  $: canUndo = phase === 'live' && hist.length > 0;
  $: canUndoMine = phase === 'live' && !spectate && !userTurn && hist.some((s) => currentHandle(s) === seat);

  // Where your first pick lands, previewed in the lobby.
  $: previewSeq = useReal
    ? (realSeq || sequenceFromSlots(slotBoard.slotHandles, slotBoard.overrides, mockRounds, slotBoard.type))
    : null;
  $: yourFirstPick = spectate ? '' : (() => {
    const i = previewSeq ? previewSeq.indexOf(seat) : order.indexOf(seat);
    return i >= 0 ? pickCode(i + 1, TEAMS.length) : '';
  })();

  // ---- MY QUEUE (persisted — it's your board, it should survive a refresh) ----
  let queue = (() => { const q = readLS('bcs_mock_queue', []); return Array.isArray(q) ? q.filter((n) => typeof n === 'string') : []; })();
  const saveQueue = () => writeLS('bcs_mock_queue', queue);
  const star = (name) => { queue = toggleQueued(queue, name); saveQueue(); };
  const moveQ = (i, d) => { queue = moveQueued(queue, i, d); saveQueue(); };
  const removeQ = (name) => { queue = queue.filter((n) => n !== name); saveQueue(); };
  const tidyQ = () => { queue = pruneQueue(queue, st ? st.pool : []); saveQueue(); };
  $: queueTopName = st && !st.done ? queueTop(st.pool, queue) : null;

  // ---- the reveal ----
  let reveal = null;
  let revealTimer = null;
  function dismissReveal() { if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; } reveal = null; }
  function announce(p, quick, hold) {
    if (!p || quick) return;
    if (revealTimer) clearTimeout(revealTimer);
    reveal = p;
    const ms = hold || Math.max(1300, Math.min(2400, pace * 2.2));
    revealTimer = setTimeout(() => { reveal = null; revealTimer = null; }, ms);
  }

  // ---- bot pacing: they think, they don't teleport ----
  let runMode = 'idle';      // idle | auto | toMe | toEnd
  let runTimer = null;
  let pace = 700;
  let thinking = false;

  function stopRun() {
    runMode = 'idle'; thinking = false;
    if (runTimer) { clearTimeout(runTimer); runTimer = null; }
  }
  function startRun(mode) {
    if (runMode === mode) { stopRun(); return; }   // the controls toggle
    stopRun();
    if (!st || st.done) return;
    runMode = mode;
    pace = mode === 'toEnd' ? Math.min(speed, 260) : mode === 'toMe' ? Math.min(speed, 440) : speed;
    schedule();
  }
  function schedule() {
    if (runMode === 'idle') return;
    if (!st || st.done) { stopRun(); finish(); return; }
    if (runMode !== 'toEnd' && isUserTurn()) { stopRun(); return; }
    thinking = true;
    runTimer = setTimeout(() => {
      runTimer = null;
      if (runMode === 'idle') { thinking = false; return; }
      thinking = false;
      stepOnce();
      if (runMode === 'toEnd') pace = Math.max(28, Math.round(pace * 0.88));
      schedule();
    }, pace);
  }

  // One pick by whoever is up. Simming through YOUR seat drafts your queue.
  function stepOnce() {
    if (!st || st.done) return;
    const h = currentHandle(st);
    const mine = !spectate && h === seat;
    const queued = mine ? queueTop(st.pool, queue) : null;
    hist = pushSnapshot(hist, st);
    st = queued ? makePick(st, queued) : makePick(st);
    announce(st.log[st.log.length - 1], pace < 200);
  }

  function finish() {
    if (st && st.done && phase === 'live') {
      stopRun(); disarmClock(); dismissReveal();
      grades = gradeMock(st);
      phase = 'done';
      saveHistory();
    }
  }

  // ---- your pick ----
  function pick(name) {
    if (!isUserTurn() || !st.pool.some((p) => p.name === name)) return;
    stopRun(); disarmClock();
    hist = pushSnapshot(hist, st);
    st = makePick(st, name);
    queue = queue.filter((n) => n !== name); saveQueue();
    pace = speed;
    announce(st.log[st.log.length - 1], false, 2800);   // your own pick gets the long look
    if (st.done) { finish(); return; }
    startRun('toMe');
  }
  function autoPick() {
    if (!isUserTurn()) return;
    const name = autoPickName(st, queue);
    if (name) pick(name);
  }

  // ---- undo: a mock is practice ----
  function applyUndo({ stack, state }) {
    if (!state) return;
    stopRun(); disarmClock(); dismissReveal();
    hist = stack; st = state;
    if (phase === 'done') { phase = 'live'; grades = null; }
    clockArmedAt = -1;
  }
  const undo = () => applyUndo(undoLast(hist));
  const undoMine = () => applyUndo(rewindToHandle(hist, seat));

  // ---- the pick clock ----
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
      if (clockLeft <= 0) { disarmClock(); if (isUserTurn()) autoPick(); }
    }, 1000);
  }
  $: if (phase === 'live' && userTurn && clockLen > 0 && st && clockArmedAt !== st.cursor) armClock(st.cursor);
  $: if (clockTimer && (phase !== 'live' || !userTurn)) disarmClock();

  // On a phone the pool is where the action is — jump there when you're up.
  let turnSeen = -1;
  $: if (userTurn && st && turnSeen !== st.cursor) { turnSeen = st.cursor; mobileTab = 'players'; }
  $: if (mobileTab === 'board' && boardCmp) boardCmp.follow();

  onDestroy(() => { stopRun(); disarmClock(); if (revealTimer) clearTimeout(revealTimer); });

  // ---- start / restart ----
  function start(seed = Date.now() & 0x7fffffff) {
    const teams = TEAMS.map(([h, t]) => ({
      handle: h, team: t.replace(' (YOU)', ''),
      persona: { ...personas[h] },
      keepers: keepersOf(h),
      isUser: !spectate && h === seat,
    }));
    boardType = useReal ? slotBoard.type : 'snake';
    const cfg = { teams, order: useReal ? slotBoard.slotHandles.slice() : [...order], slots, rosterSize, seed, pool };
    if (useReal) {
      cfg.sequence = realSeq || sequenceFromSlots(slotBoard.slotHandles, slotBoard.overrides, mockRounds, slotBoard.type);
      // The board needs the real coordinates or it will draw a tidy grid over a
      // ragged draft and put two picks in the wrong managers' columns.
      if (realSeq && realSeqMeta) cfg.sequenceMeta = realSeqMeta;
    }
    stopRun(); disarmClock(); dismissReveal();
    st = createMock(cfg);
    hist = []; grades = null; clockArmedAt = -1; turnSeen = -1;
    phase = 'live';
    mobileTab = 'board';
    if (st.done) { finish(); return; }
    startRun(spectate ? 'auto' : 'toMe');
  }
  function toLobby() { stopRun(); disarmClock(); dismissReveal(); phase = 'lobby'; }

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
      window.prompt('Copy it yourself, champ:', text);
    }
  }

  const MTABS = [['board', 'Board', '🗺'], ['players', 'Players', '🧾'], ['team', 'My team', '👤'], ['feed', 'Feed', '📣']];
</script>

<section class="warroom" class:inroom={phase === 'live'}>
  <div class="wrtop">
    <a href="/board" use:link class="back">← Big Board</a>
    <div class="wrtitle">THE WAR ROOM <span>· mock draft</span></div>
    {#if phase !== 'lobby'}
      <button class="ghost" data-testid="new-setup" on:click={toLobby}>New setup</button>
    {/if}
  </div>

  {#if phase === 'lobby'}
    <p class="blurb">
      Everyone's keepers are locked out of the pool — you draft the rest. The order comes straight off Sleeper,
      <b>traded picks included</b>, or roll your own. Star players into <b>your queue</b> and the room drafts them
      for you when the clock runs out. Skill positions only.
    </p>
    <DraftLobby
      teams={TEAMS.map(([h, t]) => [h, t.replace(' (YOU)', '')])}
      {nm} bind:seat bind:spectate {clockLen} bind:orderSource {realOk} {slotBoard} {round1} {tradeCount}
      bind:order {personas} rounds={mockRounds} {rosterSize} {yourFirstPick} {history}
      focus={myFocus} onFocus={setFocus}
      onStart={() => start()} onClock={setClock} onShuffle={shuffleOrder} onMoveOrder={moveOrder}
      onPersona={setPersona} onResetPersonas={resetPersonas}
    />

  {:else if phase === 'live' && st}
    <ClockBar
      {st} {seat} {spectate} {userTurn} {nm} {thinking} {runMode} {clockLen} {clockLeft} {speed}
      running={runMode !== 'idle'} {canUndo} {canUndoMine}
      onPlay={() => startRun('auto')} onPause={stopRun}
      onSimToMe={() => startRun('toMe')} onSimToEnd={() => startRun('toEnd')}
      onSpeed={(ms) => { speed = ms; if (runMode !== 'idle') { const m = runMode; stopRun(); startRun(m); } }}
      onUndo={undo} onUndoMine={undoMine}
    />

    <div class="room">
      <section class="pane board" class:show={mobileTab === 'board'} aria-label="Draft board">
        <DraftBoard bind:this={boardCmp} {st} {boardType} {seat} {spectate} {nm} />
      </section>

      <div class="lower">
        <section class="pane players" class:show={mobileTab === 'players'} aria-label="Player pool">
          <PlayerPool
            pool={st.pool} {userTurn} {queue} windowPref={myPersona.window}
            focus={myFocus} onFocus={spectate ? null : setFocus}
            {flexPos} needs={myNeeds}
            onPick={pick} onStar={star} onAutoPick={autoPick}
          />
        </section>

        <section class="pane team" class:show={mobileTab === 'team'} aria-label="My team">
          {#if !spectate}
            <QueuePanel
              {queue} pool={st.pool} {userTurn}
              onMove={moveQ} onRemove={removeQ} onPick={pick} onTidy={tidyQ}
            />
            <RosterPanel roster={myRoster} {slots} {rosterSize} {keeperCount} />
          {:else}
            <div class="spectating">
              <div class="hd">Spectating</div>
              <p>No seat this run — all {TEAMS.length} GMs are drafting themselves. Hit ▶ auto or ⏭ sim to end and watch the board fill.</p>
            </div>
          {/if}
        </section>

        <section class="pane feed" class:show={mobileTab === 'feed'} aria-label="Pick feed">
          <FeedPanel {st} {seat} {spectate} {nm} />
        </section>
      </div>
    </div>

    {#if userTurn}
      <div class="thumbbar">
        <button class="thumbdraft" data-testid="thumb-draft" on:click={autoPick}>
          {queueTopName ? `DRAFT ${shortName(queueTopName)}` : 'AUTOPICK — best available'}
        </button>
      </div>
    {/if}

    <nav class="mtabs" aria-label="Draft room views" data-testid="mobile-tabs">
      {#each MTABS as [id, label, icon]}
        <button class:on={mobileTab === id} data-testid={'mobile-tab-' + id} on:click={() => (mobileTab = id)}>
          <span class="mico" aria-hidden="true">{icon}</span>
          <span class="mlbl">{label}</span>
          {#if id === 'team' && queue.length}<em class="badge">{queue.length}</em>{/if}
        </button>
      {/each}
    </nav>

  {:else if phase === 'done' && grades}
    <Debrief
      {st} {grades} {seat} {spectate} {nm} {slots} {rosterSize} {keeperCount} {boardType} {copied}
      onCopy={copyRecap} onRunItBack={() => start()}
    />
  {/if}

  <PickReveal
    pick={phase === 'live' ? reveal : null}
    teams={st ? st.cfg.order.length : 10}
    {nm}
    mine={!spectate && !!reveal && reveal.handle === seat}
    onSkip={dismissReveal}
  />
</section>

<style>
  /* The room owns the whole screen — the wider the window, the more of the
     board you see at once. No column cap here on purpose. */
  .warroom { max-width: none; padding: 6px 16px 0; min-width: 0; }
  @media (min-width: 1000px) { .warroom { padding: 8px 24px 0; } }
  .wrtop { display: flex; align-items: center; gap: 14px; padding: 6px 0 10px; border-bottom: 2px solid var(--blue); margin-bottom: 12px; flex-wrap: wrap; }
  .back { font-family: var(--mono); font-size: 12px; color: var(--blue); text-decoration: none; min-height: 40px; display: inline-flex; align-items: center; }
  .wrtitle { font-family: var(--display); font-weight: 800; font-size: clamp(17px, 3vw, 24px); color: var(--blue-deep); letter-spacing: .01em; }
  .wrtitle span { font-family: var(--mono); font-weight: 400; font-size: 11px; color: var(--muted); }
  .ghost { margin-left: auto; font-family: var(--mono); font-size: 11px; background: var(--field-2); border: 1px solid var(--line); color: var(--chalk); border-radius: 8px; padding: 8px 12px; cursor: pointer; min-height: 38px; }
  .blurb { font-family: var(--mono); font-size: 12px; color: var(--muted); line-height: 1.7; max-width: 80ch; margin: 0 0 12px; }
  .blurb b { color: var(--chalk); }

  .room { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .lower { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, .85fr); gap: 12px; align-items: start; min-width: 0; }
  .pane { min-width: 0; }
  .pane.team { display: flex; flex-direction: column; gap: 12px; }
  .spectating { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .spectating .hd { font-family: var(--display); font-weight: 800; font-size: 12px; text-transform: uppercase; color: var(--chalk); }
  .spectating p { font-family: var(--mono); font-size: 10.5px; color: var(--muted); line-height: 1.6; margin: 6px 0 0; }

  /* Phone furniture: hidden on desktop, the whole navigation on a phone. */
  .mtabs, .thumbbar { display: none; }

  @media (max-width: 1180px) {
    .lower { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
    .pane.feed { grid-column: 1 / -1; }
  }

  @media (max-width: 860px) {
    .warroom { padding-bottom: 124px; }
    .wrtop { padding: 2px 0 8px; margin-bottom: 8px; row-gap: 0; }
    .wrtitle { order: 3; flex-basis: 100%; }
    .back { min-height: 36px; }
    /* In the room the board is the page — the title goes, the way out stays. */
    .inroom .wrtitle { display: none; }
    .inroom .wrtop { border-bottom: none; padding: 0 0 4px; margin-bottom: 6px; }

    .lower { display: block; }
    .pane { display: none; }
    .pane.show { display: block; }
    .pane.team.show { display: flex; }

    .mtabs {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 45; display: flex;
      background: var(--paper); border-top: 1px solid var(--line);
      padding-bottom: env(safe-area-inset-bottom, 0);
      box-shadow: 0 -6px 18px -12px rgba(28, 46, 64, .5);
    }
    .mtabs button {
      flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; min-height: 56px; border: none; background: none; cursor: pointer; color: var(--muted);
      font-family: var(--body); padding: 6px 2px;
    }
    .mtabs button.on { color: var(--blue); box-shadow: inset 0 3px 0 var(--blue); }
    .mico { font-size: 15px; line-height: 1; }
    .mlbl { font-size: 10px; font-weight: 700; }
    .badge { position: absolute; top: 6px; right: 22%; font-style: normal; font-family: var(--mono); font-size: 8.5px; color: #fff; background: var(--brass); border-radius: 9px; padding: 1px 5px; }

    .thumbbar {
      position: fixed; left: 0; right: 0; bottom: 56px; z-index: 46; display: block;
      padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
      background: linear-gradient(to top, var(--paper) 62%, rgba(255, 255, 255, 0));
    }
    .thumbdraft {
      width: 100%; min-height: 52px; font-family: var(--display); font-weight: 800; font-size: 15px;
      text-transform: uppercase; letter-spacing: .03em; background: var(--blue); color: #fff; border: none;
      border-radius: 12px; padding: 14px; cursor: pointer; box-shadow: 0 10px 20px -12px rgba(47, 127, 184, .95);
    }
    .thumbdraft:active { background: var(--blue-deep); }
  }
</style>
