<script>
  // THE DEBRIEF — your grade first and enormous, then the room, then the
  // receipts: steals, reaches, your team, the full board, and the paste-ready
  // recap for the group chat.
  import PlayerChip from '../PlayerChip.svelte';
  import DraftBoard from './DraftBoard.svelte';
  import RosterPanel from './RosterPanel.svelte';
  import { pickCode } from '../../lib/engine/mockdraft.ts';
  import { posColor } from './theme.js';

  export let st;
  export let grades;
  export let seat = null;
  export let spectate = false;
  export let nm = (h) => h;
  export let slots = [];
  export let rosterSize = 0;
  export let keeperCount = 3;
  export let boardType = 'snake';
  export let copied = false;
  export let onCopy = () => {};
  export let onRunItBack = () => {};

  $: teamsN = st ? st.cfg.order.length : 0;
  $: rows = grades ? grades.rows : [];
  $: myRow = !spectate && seat ? rows.find((r) => r.handle === seat) : null;
  $: heroRow = myRow || rows[0] || null;
  $: heroRank = heroRow ? rows.indexOf(heroRow) + 1 : 0;
  $: myRoster = st && seat ? st.rosters[seat] || [] : [];
  $: myPicks = st && seat ? st.log.filter((p) => p.handle === seat) : [];

  function verdict(rank, n, mine) {
    if (!n) return '';
    if (rank === 1) return mine ? 'You won the room. Say nothing, screenshot everything.' : 'Best board in the room.';
    if (rank <= Math.ceil(n / 3)) return mine ? 'Top of the table — that roster starts fast.' : 'Top of the table.';
    if (rank <= Math.ceil((n * 2) / 3)) return mine ? 'Middle of the pack. Fine. Not a headline.' : 'Middle of the pack.';
    return mine ? 'Rough night. Run it back and let the queue do the work.' : 'A long season ahead.';
  }
</script>

<div class="debrief" data-testid="debrief">
  <div class="donebar">
    <b>🏁 Mock complete</b> <span>{st.log.length} picks · {teamsN} teams</span>
    <span class="dacts">
      <button class="ghost copybtn" class:did={copied} data-testid="copy-recap" on:click={onCopy}>
        {copied ? '✓ copied — go stir the pot' : '📋 copy for the group chat'}
      </button>
      <button class="ghost" data-testid="run-it-back" on:click={onRunItBack}>🔁 run it back</button>
    </span>
  </div>

  {#if heroRow}
    <div class="reveal" class:mine={!!myRow} data-testid="my-grade">
      <div class="rleft">
        <span class="kicker">{myRow ? 'Your draft grade' : 'Best draft in the room'}</span>
        <b class="grade">{heroRow.grade}</b>
      </div>
      <div class="rright">
        <b class="who">{nm(heroRow.handle)}</b>
        <span class="rank">
          #{heroRank} of {rows.length} · {heroRow.picks} pick{heroRow.picks === 1 ? '' : 's'} ·
          {heroRow.perPick > 0 ? '+' : ''}{heroRow.perPick} per pick vs the board · {heroRow.lean}
        </span>
        <span class="verdict">{verdict(heroRank, rows.length, !!myRow)}</span>
        <span class="pos">
          squad {heroRow.squad} ({heroRow.kept} kept + {heroRow.total} drafted) ·
          {Object.entries(heroRow.posCounts).map(([p, n]) => `${n}${p}`).join(' · ')}
        </span>
        {#if heroRow.overCap > 0}
          <span class="cap">{heroRow.overCap} over the roster limit — that many get cut</span>
        {/if}
      </div>
    </div>
  {/if}

  <div class="sethd big">The room</div>
  <p class="gradenote">
    Ranked on value taken per pick against what the board said each slot was worth —
    not on the raw haul. Picks get traded here, so the biggest haul usually just
    means the most picks.
  </p>
  <div class="gradeboard" data-testid="grade-board">
    {#each rows as r, i}
      <div class="grow" class:you={!spectate && r.handle === seat}>
        <span class="grk">#{i + 1}</span>
        <span class="gnm">{nm(r.handle)}</span>
        <span class="glean">{r.lean}</span>
        <span class="gpos">{Object.entries(r.posCounts).map(([p, n]) => `${n}${p}`).join(' ')}</span>
        <span class="gpicks">{r.picks}p{#if r.overCap > 0}<i title="over the roster limit">+{r.overCap}</i>{/if}</span>
        <span class="gtot" title="kept {r.kept} + drafted {r.total}">{r.squad}</span>
        <span class="gper">{r.perPick > 0 ? '+' : ''}{r.perPick}</span>
        <span class="ggr">{r.grade}</span>
      </div>
    {/each}
  </div>

  <div class="twocol">
    <div>
      <div class="sethd big">💎 Steals</div>
      {#each grades.steals as p}
        <div class="srow">{p.player.name} <small>to {nm(p.handle)} — {pickCode(p.boardPick ?? p.overall, teamsN)}, board #{p.boardRank}</small></div>
      {:else}
        <div class="srow muted">None — a disciplined room.</div>
      {/each}
    </div>
    <div>
      <div class="sethd big">🚨 Reaches</div>
      {#each grades.reaches as p}
        <div class="srow">{p.player.name} <small>by {nm(p.handle)} — {pickCode(p.boardPick ?? p.overall, teamsN)}, board #{p.boardRank}</small></div>
      {:else}
        <div class="srow muted">None flagged.</div>
      {/each}
    </div>
  </div>

  {#if !spectate}
    <div class="sethd big">Your haul <span class="sub">{myPicks.length} picks</span></div>
    <div class="twocol">
      <div class="focus">
        {#each myPicks as p}
          <div class="hrow">
            <span class="code">{pickCode(p.boardPick ?? p.overall, teamsN)}</span>
            <span class="posb" style="--pc:{posColor(p.player.pos)}">{p.player.pos}</span>
            <PlayerChip name={p.player.name} />
            <span class="rank">board #{p.boardRank}</span>
          </div>
        {:else}
          <div class="hrow muted">No picks — you spectated this one.</div>
        {/each}
      </div>
      <RosterPanel roster={myRoster} {slots} {rosterSize} {keeperCount} title="Final roster" />
    </div>
  {/if}

  <div class="sethd big">The full board</div>
  <DraftBoard {st} {boardType} {seat} {spectate} {nm} live={false} />
</div>

<style>
  .debrief { min-width: 0; }
  .donebar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-family: var(--mono); font-size: 12.5px; color: var(--chalk); background: var(--blue-wash); border: 1px solid var(--blue); border-radius: 10px; padding: 10px 14px; }
  .donebar b { font-family: var(--display); font-weight: 800; font-size: 14px; color: var(--blue-deep); }
  .dacts { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
  .ghost { font-family: var(--mono); font-size: 11px; background: var(--field-2); border: 1px solid var(--line); color: var(--chalk); border-radius: 8px; padding: 9px 12px; cursor: pointer; min-height: 38px; }
  .copybtn { background: var(--blue); color: #fff; border-color: var(--blue); }
  .copybtn.did { background: var(--good); border-color: var(--good); }

  .reveal {
    display: flex; align-items: center; gap: 18px; flex-wrap: wrap; margin-top: 14px;
    background: var(--barroom-lift); border: 1px solid var(--line); border-left: 6px solid var(--blue);
    border-radius: 14px; padding: 18px 20px; box-shadow: 0 12px 28px -20px rgba(28, 46, 64, .55);
    animation: rise .5s cubic-bezier(.2, 1.1, .4, 1);
  }
  .reveal.mine { border-left-color: var(--brass); }
  @keyframes rise { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
  .rleft { display: flex; flex-direction: column; }
  .kicker { font-family: var(--mono); font-size: 9px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); }
  .grade { font-family: var(--display); font-weight: 800; font-size: clamp(56px, 15vw, 104px); line-height: .9; color: var(--blue); letter-spacing: -.02em; animation: stamp .55s cubic-bezier(.2, 1.4, .4, 1); }
  .reveal.mine .grade { color: var(--blue-deep); }
  @keyframes stamp { 0% { transform: scale(1.5); opacity: 0; } 55% { transform: scale(.94); } 100% { transform: scale(1); opacity: 1; } }
  .rright { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .rright .who { font-family: var(--display); font-weight: 800; font-size: clamp(16px, 3vw, 22px); color: var(--chalk); }
  .rright .rank { font-family: var(--mono); font-size: 11.5px; color: var(--blue-deep); }
  .rright .verdict { font-family: var(--marker); font-size: 18px; color: var(--muted); line-height: 1.3; }
  .rright .pos { font-family: var(--mono); font-size: 10px; color: var(--muted); }

  .sethd { font-family: var(--display); font-weight: 800; font-size: 12.5px; text-transform: uppercase; color: var(--chalk); margin-bottom: 9px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sethd.big { margin-top: 20px; }
  .sethd .sub { font-family: var(--mono); font-size: 10px; font-weight: 400; text-transform: none; color: var(--muted); }

  .gradeboard { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 6px 12px; }
  .grow { display: grid; grid-template-columns: 34px 1fr auto auto 44px 56px 46px 40px; gap: 10px; align-items: center; padding: 8px 4px; border-bottom: 1px dashed var(--line); font-family: var(--mono); font-size: 12.5px; }
  .grow:last-child { border-bottom: none; }
  .grow.you { background: var(--blue-wash); border-radius: 6px; }
  .grk { color: var(--muted); font-weight: 700; }
  .gnm { font-family: var(--body); font-weight: 700; color: var(--chalk); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .glean, .gpos { color: var(--muted); font-size: 10px; }
  .gpicks { color: var(--muted); font-size: 10px; text-align: right; }
  .gpicks i { font-style: normal; color: var(--stamp-red); }
  .gper { text-align: right; font-size: 11px; color: var(--muted); }
  .gradenote { font-family: var(--mono); font-size: 11px; color: var(--muted); line-height: 1.6; margin: 4px 0 8px; max-width: 72ch; }
  .cap { font-family: var(--mono); font-size: 11px; color: var(--stamp-red); }
  .gtot { text-align: right; font-weight: 700; color: var(--chalk); }
  .ggr { font-family: var(--display); font-weight: 800; font-size: 16px; color: var(--blue); text-align: center; }

  .twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
  .srow { font-family: var(--mono); font-size: 12px; color: var(--chalk); padding: 4px 0; border-bottom: 1px dashed var(--line); }
  .srow small, .muted { color: var(--muted); }
  .focus { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
  .hrow { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 12px; color: var(--chalk); padding: 4px 0; border-bottom: 1px dashed var(--line); }
  .hrow:last-child { border-bottom: none; }
  .hrow .code { width: 34px; color: var(--muted); font-size: 10px; font-weight: 700; }
  .posb { flex: none; width: 28px; text-align: center; font-size: 8.5px; font-weight: 700; color: #fff; background: var(--pc); border-radius: 4px; padding: 2px 0; }
  .hrow .rank { margin-left: auto; color: var(--muted); font-size: 10px; }

  @media (max-width: 860px) {
    .twocol { grid-template-columns: 1fr; }
    .grow { grid-template-columns: 28px 1fr 42px 40px 34px; }
    .glean, .gpos, .gpicks { display: none; }
    .dacts { margin-left: 0; width: 100%; }
    .dacts .ghost { flex: 1; }
  }
</style>
