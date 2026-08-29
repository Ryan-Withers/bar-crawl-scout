<script>
  // THE LEDGER — who is actually kept, and who that puts back in the pool.
  //
  // This page used to be a form. You typed a name into a slot, tapped a pill to
  // say how sure you were, and the whole app priced players off your guess. That
  // was the right tool while keepers were a guess. They are locked now: Sleeper
  // carries each roster's three, so there is nothing to type and nothing to be
  // unsure about.
  //
  // What is worth showing instead is the consequence. Thirty men are off the
  // board and a hundred and twenty-five go back into it, including some very
  // good ones, and THAT is the thing you want in your head on draft day.
  import { createQuery } from '@tanstack/svelte-query';
  import { link } from '../lib/router.js';
  import { TEAMS, TEAMSHORT, RYAN, byName } from '../lib/data.js';
  import { keepers, keepersSource, unlocked } from '../lib/store.js';
  import { leagueQuery, usersQuery, rostersQuery, realDraftQuery, playersQuery, draftVaultQuery } from '../api/queries';
  import { userHandleMap, draftSlotBoard } from '../api/league';
  import {
    keeperLedger, keeperOwners, contracts, keeperBoard, keeperCells,
    pickCode, incompleteKeepers,
  } from '../lib/engine/keepers';
  import Stamp from './Stamp.svelte';
  import SeasonNote from './SeasonNote.svelte';

  const leagueQ = createQuery(leagueQuery());
  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const realQ = createQuery(realDraftQuery());
  const playersQ = createQuery(playersQuery());
  const vaultQ = createQuery(draftVaultQuery());

  const POS_INK = { QB: '#D6453C', RB: '#1D8A4E', WR: '#2F7FB8', TE: '#B08428' };

  $: users = $usersQ.data || [];
  $: rosters = $rostersQ.data || [];
  $: uh = userHandleMap(users);
  $: maxKeepers = Number($leagueQ.data?.settings?.max_keepers ?? 3);
  $: live = $keepersSource === 'live';
  $: mixed = $keepersSource === 'mixed';

  $: nameOf = (id) => {
    const p = $playersQ.data?.[String(id)];
    return p ? { name: p[0], pos: p[1] } : null;
  };
  $: ledger = rosters.length && $playersQ.data ? keeperLedger(rosters, uh, nameOf) : {};
  $: rosterOfHandle = Object.fromEntries(rosters.map((r) => [uh[r.owner_id], r.roster_id]));
  $: notLocked = incompleteKeepers(ledger, maxKeepers);

  // Last season's keepers, straight off last season's draft — so the contract
  // clock is derived rather than remembered.
  $: priorSeason = ($vaultQ.data || []).find((s) => Number(s.season) === Number($leagueQ.data?.season) - 1);
  $: priorOwners = priorSeason ? keeperOwners(priorSeason.picks) : {};

  // Where each manager's keepers actually sit on the board.
  $: sb = draftSlotBoard($realQ.data?.draft, $realQ.data?.traded, users, rosters);
  $: rounds = $realQ.data?.draft?.settings?.rounds || 15;
  $: rosterHandle = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));
  $: kBoard = sb ? keeperBoard(sb, rounds, ledger, $realQ.data?.picks, rosterHandle) : null;
  $: slotsOf = (h) => (kBoard ? keeperCells(kBoard).filter((c) => c.handle === h).map((c) => pickCode(c.pickNo, kBoard.teams)) : []);

  // WHO CAME BACK. Every man on a roster who is not one of the thirty returns to
  // the pool, and the good ones are the whole story of this draft.
  $: keptIdSet = new Set(Object.values(ledger).flat().map((m) => m.playerId));
  $: returning = (() => {
    if (!rosters.length || !$playersQ.data) return { ranked: [], offBoard: [] };
    const seen = new Set();
    const ranked = [];
    const offBoard = [];
    for (const r of rosters) {
      for (const id of r.players || []) {
        const key = String(id);
        if (keptIdSet.has(key) || seen.has(key)) continue;
        seen.add(key);
        const p = $playersQ.data[key];
        if (!p) continue;
        const row = byName(p[0]);
        // Anyone off the 200-row board still goes back in the pool — dropping
        // them silently hid two dozen men, the whole defensive cohort among
        // them, from a page whose one job is to say who is coming back.
        if (row) ranked.push({ id: key, name: row[1], pos: row[2], team: row[3], adp: row[5] });
        else offBoard.push({ id: key, name: p[0], pos: p[1] || '?', team: p[2] || 'FA' });
      }
    }
    ranked.sort((a, b) => a.adp - b.adp);
    offBoard.sort((a, b) => (a.pos === b.pos ? a.name.localeCompare(b.name) : a.pos.localeCompare(b.pos)));
    return { ranked, offBoard };
  })();
  $: backInPool = returning.ranked;
  $: offBoardPool = returning.offBoard;

  const teamName = (h) => TEAMSHORT[h] || h;
  // The projection fallback still uses the old store shape.
  $: fallback = $keepers;
  let poolOpen = true;
</script>

<section class="ledger">
  <div class="lednote"><SeasonNote page="keepers" /></div>

  {#if live}
    <p class="headline">
      <b>Locked.</b> All {TEAMS.length} managers have declared their {maxKeepers}, straight from
      Sleeper — {Object.values(ledger).flat().length} men off the board. Everyone else
      on every roster goes back into the draft.
    </p>
  {:else if mixed}
    <p class="warn">
      <b>Partly locked.</b> Sleeper has answered for some managers and not others.
      Anyone still short of {maxKeepers} below is showing a <b>projection</b>, not a fact.
    </p>
  {:else}
    <p class="warn">
      Showing the old <b>projections</b>, not the locked list — Sleeper hasn't answered yet.
      These are guesses and the app is pricing players off them.
    </p>
  {/if}
  {#if live && notLocked.length}
    <p class="warn">Still short of {maxKeepers}: {notLocked.join(', ')}.</p>
  {/if}

  <div class="grid">
    {#each TEAMS as t, ti}
      {@const h = t[0]}
      {@const men = ledger[h] || []}
      {@const cs = contracts(men, priorOwners, rosterOfHandle[h])}
      <div class="sheet" class:me={h === RYAN}>
        <div class="stitle">
          <a href="/managers/{h}" use:link>{teamName(h)}</a>
          <span>@{h}</span>
        </div>

        {#if h === RYAN && !$unlocked && !live}
          <div class="sealed">🔒 <b>CLASSIFIED.</b> The commissioner's ledger is sealed. Go beat someone you can read.</div>
        {:else if men.length}
          {#each cs as c, i}
            {@const m = men[i]}
            <div class="row" style="--pos:{POS_INK[m.pos] || 'var(--line)'}">
              <span class="pn">{m.name}</span>
              <span class="pos">{m.pos}</span>
              <span class="clock" title={c.yearsLeft === 1 ? 'Second straight year — he cannot be kept again' : 'Fresh keeper — he can be kept once more'}>
                {#each Array(c.yearsLeft) as _, y}<i>{26 + y}</i>{/each}
              </span>
              {#if c.yearsLeft === 1}<Stamp text="Last Call" tone="red" seed={ti * 4 + i} />{/if}
              {#if c.changedHands}<em class="moved" title="Kept by someone else last season">traded in</em>{/if}
            </div>
          {/each}
          {#if slotsOf(h).length}
            <div class="picks">Keeper picks: {slotsOf(h).join(' · ')}</div>
          {/if}
        {:else}
          {#each [0, 1, 2] as i}
            {@const s = (fallback[h] || [])[i] || ['', '']}
            <div class="row proj">
              <span class="pn">{s[0] || '—'}</span>
              <span class="cpill">{s[1] || 'L'}</span>
            </div>
          {/each}
        {/if}
      </div>
    {/each}
  </div>

  {#if (live || mixed) && backInPool.length}
    <div class="poolhead">
      <button class="ptoggle" on:click={() => (poolOpen = !poolOpen)} aria-expanded={poolOpen}>
        {poolOpen ? '▾' : '▸'} Back in the pool ({backInPool.length + offBoardPool.length})
      </button>
      <p class="note">
        Every man on a roster who was not one of the {Object.values(ledger).flat().length} kept, ranked by ADP.
        These are not free agents — they are the league's own players, returning to the draft.
      </p>
    </div>
    {#if poolOpen}
      <ol class="pool">
        {#each backInPool.slice(0, 60) as p}
          <li style="--pos:{POS_INK[p.pos] || 'var(--line)'}">
            <a href="/player/{encodeURIComponent(p.name)}" use:link>{p.name}</a>
            <span class="pt">{p.pos} · {p.team}</span>
            <span class="adp">ADP {p.adp}</span>
          </li>
        {/each}
      </ol>
      {#if backInPool.length > 60}
        <p class="note">…and {backInPool.length - 60} more. The full ordering lives on the <a href="/board" use:link>Big Board</a>.</p>
      {/if}
      {#if offBoardPool.length}
        <p class="note">
          Plus <b>{offBoardPool.length}</b> returning who sit outside the top-200 board, so they carry no ADP here —
          mostly defenders, for the IDP seat:
          {offBoardPool.slice(0, 24).map((p) => `${p.name} (${p.pos})`).join(', ')}{#if offBoardPool.length > 24}, and {offBoardPool.length - 24} more{/if}.
        </p>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .ledger { padding-top: 2px; }
  .lednote { margin-bottom: 14px; }
  .lednote :global(.note) { margin-top: 0; margin-bottom: 0; }
  .note { font-family: var(--mono); font-size: 12.5px; color: var(--muted); line-height: 1.7; max-width: 78ch; }
  .note a { color: var(--blue); }
  .headline {
    font-family: var(--body); font-size: 15px; line-height: 1.6; color: var(--chalk);
    margin: 0 0 14px; max-width: 78ch; border-left: 3px solid var(--blue-sky); padding-left: 12px;
  }
  .warn {
    font-family: var(--mono); font-size: 12px; color: var(--stamp-red); line-height: 1.6;
    border-left: 3px solid var(--stamp-red); padding-left: 12px; margin: 0 0 14px; max-width: 78ch;
  }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; }
  .sheet {
    background: #fff; color: var(--chalk); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px 16px 16px;
  }
  .sheet.me { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue-wash); }
  .stitle {
    font-family: var(--display); font-weight: 800; font-size: 14px; text-transform: uppercase;
    letter-spacing: .02em; padding-bottom: 9px; border-bottom: 2px solid var(--line); margin-bottom: 4px;
    display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  }
  .stitle a { color: var(--chalk); text-decoration: none; }
  .stitle a:hover { color: var(--blue); }
  .stitle span { font-family: var(--mono); font-size: 10.5px; color: var(--muted); font-weight: 400; text-transform: none; }
  .sealed { font-family: var(--mono); font-size: 12px; color: var(--muted); padding: 14px 2px; line-height: 1.6; }

  .row {
    display: flex; align-items: center; gap: 8px; padding: 9px 0 9px 9px; min-height: 40px;
    border-bottom: 1px solid var(--line); border-left: 3px solid var(--pos); flex-wrap: wrap;
  }
  .row:last-of-type { border-bottom: none; }
  .row.proj { border-left-color: var(--line); opacity: .75; }
  .pn { font-family: var(--body); font-weight: 700; font-size: 13.5px; color: var(--chalk); flex: 1 1 auto; min-width: 0; }
  .pos { font-family: var(--mono); font-size: 10px; color: var(--muted); }
  .cpill {
    font-family: var(--mono); font-size: 10.5px; font-weight: 700; padding: 3px 7px;
    border-radius: 4px; border: 1.5px solid var(--muted); color: var(--muted);
  }
  .clock { display: inline-flex; align-items: center; gap: 4px; flex: none; }
  .clock i {
    display: grid; place-items: center; width: 23px; height: 23px; border-radius: 50%;
    border: 1.5px solid var(--line); font-family: var(--mono); font-size: 9px; font-style: normal; color: var(--muted);
  }
  .moved { font-family: var(--mono); font-size: 9.5px; color: var(--brass); font-style: normal; }
  .picks { font-family: var(--mono); font-size: 10.5px; color: var(--muted); padding-top: 10px; }

  .poolhead { margin-top: 26px; padding-top: 18px; border-top: 2px solid var(--line); }
  .ptoggle {
    font-family: var(--display); font-weight: 800; font-size: 15px; text-transform: uppercase; letter-spacing: .02em;
    background: none; border: none; color: var(--blue-deep); cursor: pointer; padding: 0 0 6px; min-height: 40px;
  }
  ol.pool {
    list-style: none; padding: 0; margin: 12px 0 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 6px;
  }
  ol.pool li {
    display: flex; align-items: baseline; gap: 8px; background: #fff;
    border: 1px solid var(--line); border-left: 3px solid var(--pos); border-radius: 8px; padding: 9px 11px;
  }
  ol.pool a { font-family: var(--body); font-weight: 700; font-size: 13px; color: var(--chalk); text-decoration: none; }
  ol.pool a:hover { color: var(--blue); }
  .pt { font-family: var(--mono); font-size: 10px; color: var(--muted); }
  .adp { font-family: var(--mono); font-size: 10px; color: var(--muted); margin-left: auto; }
</style>
