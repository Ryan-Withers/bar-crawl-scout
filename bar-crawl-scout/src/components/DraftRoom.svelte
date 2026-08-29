<script>
  // THE BOARD — the real 2026 draft, exactly as it stands.
  //
  // Ryan's ask: "view the draft board too, we put them at the bottom." The
  // keepers sit at the bottom of the grid, and the interesting part is that
  // "the bottom" is not a tidy block of three rounds. Sleeper fills a manager's
  // keepers into the LATEST picks he still OWNS, so the two men who sold a 15th
  // have a keeper riding up into round 12, and the two who bought them carry a
  // live pick in round 13. This page draws that, rather than describing it.
  import { createQuery } from '@tanstack/svelte-query';
  import { link } from '../lib/router.js';
  import { leagueQuery, usersQuery, rostersQuery, realDraftQuery, playersQuery, seasonTransactionsQuery } from '../api/queries';
  import { draftSlotBoard, userHandleMap } from '../api/league';
  import {
    keeperBoard, keeperLedger, liveCells, keeperCells, livePicksFor,
    livePickCounts, fullyLiveRounds, pickCode, incompleteKeepers,
  } from '../lib/engine/keepers';
  import { TEAMS, TEAMSHORT, RYAN } from '../lib/data.js';
  import { pendingMoves, outgoingByRoster, incomingByRoster } from '../lib/engine/principle';
  import SeasonNote from './SeasonNote.svelte';

  const leagueQ = createQuery(leagueQuery());
  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const realQ = createQuery(realDraftQuery());
  const playersQ = createQuery(playersQuery());
  const txnQ = createQuery(seasonTransactionsQuery());

  const POS_INK = { QB: '#D6453C', RB: '#1D8A4E', WR: '#2F7FB8', TE: '#B08428' };

  $: users = $usersQ.data || [];
  $: rosters = $rostersQ.data || [];
  $: uh = userHandleMap(users);
  $: draft = $realQ.data?.draft || null;
  $: rounds = draft?.settings?.rounds || 15;
  $: maxKeepers = Number($leagueQ.data?.settings?.max_keepers ?? 3);
  $: sb = draftSlotBoard(draft, $realQ.data?.traded, users, rosters);

  $: nameOf = (id) => {
    const p = $playersQ.data?.[String(id)];
    return p ? { name: p[0], pos: p[1] } : null;
  };
  $: ledger = rosters.length && $playersQ.data ? keeperLedger(rosters, uh, nameOf) : {};
  $: rosterHandle = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
  $: board = sb ? keeperBoard(sb, rounds, ledger, $realQ.data?.picks, rosterHandle) : null;

  $: slotHandles = sb?.slotHandles || [];
  $: byRound = board
    ? Array.from({ length: board.rounds }, (_, i) =>
        board.cells.filter((c) => c.round === i + 1).sort((a, b) => a.pickNo - b.pickNo))
    : [];
  $: counts = board ? livePickCounts(board) : {};
  $: clean = board ? fullyLiveRounds(board) : [];
  $: notLocked = incompleteKeepers(ledger, maxKeepers);
  $: mine = board ? livePicksFor(board, RYAN) : [];
  // A cell is drawn in draft order, so slot N of an even round sits in column N
  // just like an odd one — you read a manager's whole draft down one column.
  $: cellAt = (round, slot) => byRound[round - 1]?.find((c) => c.slot === slot) || null;

  // Deals agreed before the draft that execute after it. They do not change who
  // picks when — but they very much change the squad each man ends up with.
  $: pending = pendingMoves((($txnQ.data || []).flat()));
  $: rosterOfHandle = Object.fromEntries(rosters.map((r) => [uh[r.owner_id], r.roster_id]));
  $: outgoing = outgoingByRoster(pending);
  $: incoming = incomingByRoster(pending);

  $: squad = TEAMS.map(([h]) => {
    const kept = (ledger[h] || []).length;
    const live = counts[h] || 0;
    const owed = (outgoing[rosterOfHandle[h]] || []).length;
    const due = (incoming[rosterOfHandle[h]] || []).length;
    const settled = kept + live - owed + due;
    return {
      handle: h, kept, live, total: kept + live, delta: kept + live - rounds,
      owed, due, settled, settledDelta: settled - rounds,
    };
  }).sort((a, b) => b.live - a.live);

  let view = 'board';
</script>

<section class="room">
  <div class="lednote"><SeasonNote page="draftboard" /></div>

  {#if !board}
    <p class="note">Waiting on Sleeper for the draft order and the traded picks. If this stays put, the league has no draft with an assigned order yet.</p>
  {:else}
    <p class="headline">
      {rounds} rounds, {board.teams} teams — {board.cells.length} picks, of which
      <b>{keeperCells(board).length} are already spent on keepers</b> and
      <b>{liveCells(board).length} are live</b>.
      {#if board.source === 'derived'}
        The commissioner hasn't placed the keepers on the board yet, so their slots are worked out from what each manager still owns.
      {:else if board.source === 'mixed'}
        The commissioner has placed some of the keepers and not others; the rest are worked out from what each manager still owns.
      {:else if board.source === 'none'}
        Nobody has locked a keeper yet, so every pick below is live.
      {/if}
    </p>

    {#if notLocked.length}
      <p class="warn">Not locked yet: {notLocked.join(', ')} — the board below assumes what they hold today.</p>
    {/if}

    <p class="note">
      Rounds {clean.length ? `${clean[0]}–${clean[clean.length - 1]}` : '—'} are wholly live.
      After that it gets ragged, and that is the trades talking: a keeper takes the
      <i>latest pick its owner still holds</i>, so selling a 15th pushes a keeper up
      into round 12 and buying one leaves you a live pick in round 13.
    </p>

    <div class="vtabs">
      <button class="vtab" class:on={view === 'board'} on:click={() => (view = 'board')}>The board</button>
      <button class="vtab" class:on={view === 'mine'} on:click={() => (view = 'mine')}>Your picks ({mine.length})</button>
      <button class="vtab" class:on={view === 'squad'} on:click={() => (view = 'squad')}>Who holds what</button>
    </div>

    {#if view === 'board'}
      <div class="legend">
        <span class="lg"><i class="sw keep"></i> keeper — pick already spent</span>
        <span class="lg"><i class="sw live"></i> live</span>
        <span class="lg"><i class="sw traded"></i> changed hands</span>
      </div>
      <div class="boardwrap">
        <table class="board">
          <thead>
            <tr>
              <th class="rh">R</th>
              {#each slotHandles as h, i}
                <th title={TEAMSHORT[h] || h} class:me={h === RYAN}>{h === RYAN ? 'YOU' : h}<span class="sl">{i + 1}</span></th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each Array(board.rounds) as _, ri}
              <tr>
                <th class="rh">{ri + 1}</th>
                {#each slotHandles as _h, si}
                  {@const c = cellAt(ri + 1, si + 1)}
                  <td>
                    {#if c}
                      <span
                        class="cell"
                        class:keep={!!c.keeper}
                        class:traded={!!c.via}
                        class:me={c.handle === RYAN}
                        style="--pos:{POS_INK[c.keeper?.pos] || 'var(--line)'}"
                      >
                        <span class="pc">{pickCode(c.pickNo, board.teams)}</span>
                        {#if c.keeper}
                          <span class="pn">{c.keeper.name}</span>
                        {/if}
                        <span class="ow">
                          {c.handle === RYAN ? 'YOU' : c.handle}{#if c.via}<i> ← {c.via}</i>{/if}
                        </span>
                      </span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if view === 'mine'}
      <p class="note">
        Your {mine.length} live picks, in order. Everything else on your row of the
        board is either a keeper or a pick you traded away.
      </p>
      <ul class="mine">
        {#each mine as c}
          <li>
            <b>{pickCode(c.pickNo, board.teams)}</b>
            <span class="on">pick {c.pickNo} overall</span>
            {#if c.via}<em>bought from {c.via}</em>{:else}<em class="own">your own slot</em>{/if}
          </li>
        {/each}
      </ul>
      <p class="note">
        <!-- Counted, not assumed: it is three today because that is what he
             declared, and the board reads declarations rather than the settled
             squads. -->
        Your {(ledger[RYAN] || []).length} keepers — {(ledger[RYAN] || []).map((m) => m.name).join(', ') || '—'} —
        sit at {(keeperCells(board).filter((c) => c.handle === RYAN).map((c) => pickCode(c.pickNo, board.teams)).join(', ')) || '—'}.
      </p>
    {:else}
      <div class="tablewrap">
        <table class="squad">
          <thead>
            <tr>
              <th>Manager</th><th>Keepers</th><th>Live picks</th><th>Squad</th>
              {#if pending.length}<th>After the deals</th>{/if}
              <th>vs {rounds} spots</th>
            </tr>
          </thead>
          <tbody>
            {#each squad as s}
              <tr class:me={s.handle === RYAN}>
                <td><a href="/managers/{s.handle}" use:link>{s.handle === RYAN ? `${s.handle} (you)` : s.handle}</a></td>
                <td class="num">{s.kept}</td>
                <td class="num">{s.live}</td>
                <td class="num">{s.total}</td>
                {#if pending.length}
                  <td class="num">
                    {s.settled}
                    {#if s.owed || s.due}<i class="deal">{s.due ? `+${s.due}` : ''}{s.owed ? ` −${s.owed}` : ''}</i>{/if}
                  </td>
                {/if}
                <td class="num" class:over={s.settledDelta > 0} class:short={s.settledDelta < 0}>
                  {#if s.settledDelta > 0}{s.settledDelta} over — must cut{:else if s.settledDelta < 0}{-s.settledDelta} short{:else}exactly full{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="note">
        Traded picks mean nobody comes out even. The league still adds to
        {board.cells.length} — it has to — but a manager who bought picks drafts more
        men than he has room for and cuts the rest, and one who sold spends the season on waivers.
        {#if pending.length}
          The last two columns settle the {pending.length} keeper{pending.length === 1 ? '' : 's'} traded
          in principle, which land after the draft and are what each squad really ends up as.
        {/if}
      </p>
    {/if}
  {/if}
</section>

<style>
  .room { padding-top: 2px; }
  .lednote { margin-bottom: 14px; }
  .lednote :global(.note) { margin-top: 0; margin-bottom: 0; }
  .note { font-family: var(--mono); font-size: 12.5px; color: var(--muted); line-height: 1.7; max-width: 78ch; }
  .headline {
    font-family: var(--body); font-size: 15px; line-height: 1.6; color: var(--chalk);
    margin: 0 0 12px; max-width: 78ch; border-left: 3px solid var(--blue-sky); padding-left: 12px;
  }
  .warn {
    font-family: var(--mono); font-size: 12px; color: var(--stamp-red);
    border-left: 3px solid var(--stamp-red); padding-left: 12px; margin: 0 0 12px;
  }

  .vtabs { display: flex; gap: 6px; margin: 14px 0 12px; flex-wrap: wrap; }
  .vtab {
    font-family: var(--body); font-weight: 700; font-size: 13px; border: 1px solid var(--line);
    background: #fff; color: var(--muted); border-radius: 9px; padding: 9px 14px; cursor: pointer; min-height: 42px;
  }
  .vtab.on { background: var(--blue-wash); border-color: var(--blue); color: var(--blue-deep); }

  .legend { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .lg {
    display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 11px;
    border: 1px solid var(--line); background: #fff; color: var(--muted); border-radius: 20px; padding: 6px 12px;
  }
  .sw { width: 10px; height: 10px; border-radius: 3px; border: 1px solid var(--line); }
  .sw.keep { background: var(--blue-wash); border-color: var(--blue); }
  .sw.live { background: #fff; }
  .sw.traded { background: #fff; border-color: var(--brass); border-left-width: 3px; }

  /* Ten columns will not fit a phone, so the board scrolls sideways rather than
     squashing every manager into an unreadable sliver. */
  .boardwrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  table.board { border-collapse: collapse; table-layout: fixed; width: 100%; min-width: 860px; }
  .board th {
    font-family: var(--mono); font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase;
    color: var(--muted); font-weight: 500; padding: 8px 5px; border-bottom: 1px solid var(--line);
    background: var(--field-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .board thead th.me { color: var(--blue-deep); background: var(--blue-wash); }
  .board th .sl { display: block; font-size: 8.5px; opacity: .6; }
  .board th.rh { width: 30px; text-align: center; }
  .board tbody th.rh {
    font-family: var(--display); font-weight: 800; font-size: 12px; color: var(--blue-deep);
    border-bottom: 1px solid var(--line); background: var(--field);
  }
  .board td { padding: 0; border-bottom: 1px solid var(--line); border-left: 1px solid var(--line); vertical-align: top; }

  .cell { display: block; padding: 6px 7px 7px; border-left: 3px solid var(--pos); min-height: 42px; }
  .cell.keep { background: var(--blue-wash); }
  .cell.traded { border-left-color: var(--brass); }
  .cell.me { box-shadow: inset 0 0 0 2px rgba(47, 127, 184, .28); }
  .pc { display: block; font-family: var(--mono); font-size: 9px; color: var(--muted); }
  .pn {
    display: block; font-family: var(--body); font-weight: 700; font-size: 12px; color: var(--chalk);
    line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ow { display: block; font-family: var(--mono); font-size: 9.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ow i { font-style: normal; color: var(--brass); }

  .mine { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 6px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }
  .mine li {
    display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
    border: 1px solid var(--line); border-left: 3px solid var(--blue); border-radius: 8px;
    background: #fff; padding: 10px 12px;
  }
  .mine b { font-family: var(--display); font-size: 15px; color: var(--blue-deep); }
  .mine .on { font-family: var(--mono); font-size: 10.5px; color: var(--muted); }
  .mine em { font-family: var(--mono); font-size: 10.5px; color: var(--brass); font-style: normal; margin-left: auto; }
  .mine em.own { color: var(--muted); }

  .tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  table.squad { border-collapse: collapse; width: 100%; min-width: 460px; }
  .squad th {
    font-family: var(--mono); font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase;
    color: var(--muted); font-weight: 500; text-align: left; padding: 10px 12px;
    border-bottom: 1px solid var(--line); background: var(--field-3);
  }
  .squad td { font-family: var(--body); font-size: 13.5px; color: var(--chalk); padding: 10px 12px; border-bottom: 1px solid var(--line); }
  .squad td a { color: var(--blue); text-decoration: none; }
  .squad tr.me td { background: var(--blue-wash); }
  .squad .num { font-family: var(--mono); font-size: 12.5px; }
  .squad .over { color: var(--stamp-red); }
  .squad .deal { font-style: normal; font-size: 10.5px; color: var(--good); margin-left: 5px; }
  .squad .short { color: var(--brass); }
</style>
