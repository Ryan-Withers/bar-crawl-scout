<script>
  // THE LOBBY — everything you set before the room opens, in the order you
  // actually decide it: what the draft is, where you sit, who you're up
  // against. The dials still exist; they just live behind a door now.
  import { personaPhrase, FOCUS_ORDER, FOCUS_LABEL } from '../../lib/engine/mockdraft.ts';
  import { initials } from './theme.js';

  export let teams = [];              // [[handle, teamName], …]
  export let nm = (h) => h;
  export let seat;
  export let spectate;
  export let clockLen = 0;
  export let orderSource = 'real';
  export let realOk = false;
  export let slotBoard = null;
  export let round1 = [];
  export let tradeCount = 0;
  export let order = [];
  export let personas = {};
  export let rounds = 0;
  export let rosterSize = 0;
  export let yourFirstPick = '';
  export let history = [];
  export let onStart = () => {};
  export let onClock = () => {};
  export let onShuffle = () => {};
  export let onMoveOrder = () => {};
  export let onPersona = () => {};
  export let onResetPersonas = () => {};
  export let focus = 'balanced';
  export let onFocus = () => {};

  const CLOCKS = [[0, 'off'], [30, '30s'], [60, '60s'], [90, '90s']];
  const PRESETS = [
    ['By the book', { chaos: 0 }], ['Chaotic', { chaos: 90 }],
    ['Win-now', { window: 10 }], ['Future', { window: 90 }], ['Balanced', { window: 50, chaos: 50 }],
  ];
  let viewOld = null;
  $: useReal = orderSource === 'real' && realOk;
</script>

<div class="lobby" data-testid="lobby">
  <div class="hero">
    <div class="herotop">
      <span class="kicker">Draft settings</span>
      <h2>Mock draft · {teams.length} teams · {rounds} rounds</h2>
    </div>
    <ul class="facts">
      <li><i>Board</i><b>{useReal ? `Sleeper ${slotBoard?.season || ''} ${slotBoard?.type || ''}` : 'Custom order'}</b></li>
      <li><i>Traded picks</i><b>{useReal ? `${tradeCount} honored` : 'n/a'}</b></li>
      <li><i>Your seat</i><b>{spectate ? 'Spectating' : nm(seat)}</b></li>
      <li><i>Pick clock</i><b>{clockLen ? `${clockLen}s` : 'off'}</b></li>
      <li><i>Roster</i><b>{rosterSize} spots · keepers count</b></li>
      <li><i>Pool</i><b>Skill positions only</b></li>
    </ul>
    <button class="go" data-testid="start" on:click={onStart}>
      ▶ Start the draft
      <small>{spectate ? 'Ten GMs, no seat — sit back and watch' : yourFirstPick ? `You're on the clock at ${yourFirstPick}` : `You draft for ${nm(seat)}`}</small>
    </button>
  </div>

  <div class="setgrid">
    <div class="setcard">
      <div class="sethd">Your seat</div>
      <select bind:value={seat} disabled={spectate} data-testid="seat-select" aria-label="Your seat">
        {#each teams as [h, t]}<option value={h}>{t}</option>{/each}
      </select>
      <label class="chk"><input type="checkbox" bind:checked={spectate} data-testid="spectate" /> Spectate — sim all {teams.length}, I'll watch</label>
      <div class="clockrow" class:dim={spectate} data-testid="lobby-focus">
        <span class="clocklbl">🎯 Focus</span>
        {#each FOCUS_ORDER as f}
          <button class="mini" class:on={focus === f} disabled={spectate} data-testid={'lobby-focus-' + f} on:click={() => onFocus(f)}>{FOCUS_LABEL[f]}</button>
        {/each}
      </div>
      <p class="meta">Which way your board leans. You can flip it mid-draft — start future-first, swing to win-now once your keepers are covered.</p>
      <div class="clockrow" class:dim={spectate}>
        <span class="clocklbl">⏱ Pick clock</span>
        {#each CLOCKS as [s, label]}
          <button class="mini" class:on={clockLen === s} disabled={spectate} data-testid={'clock-' + s} on:click={() => onClock(s)}>{label}</button>
        {/each}
      </div>
      <p class="meta">
        {#if clockLen && !spectate}
          At zero the room drafts the top man in your queue — best available if it's empty.
        {:else}
          No clock: take as long as you like on every pick.
        {/if}
      </p>
    </div>

    <div class="setcard">
      <div class="sethd">Draft order
        {#if realOk}
          <span class="srcchips">
            <button class="mini" class:on={orderSource === 'real'} data-testid="order-real" on:click={() => (orderSource = 'real')}>🏛 real board</button>
            <button class="mini" class:on={orderSource === 'custom'} data-testid="order-custom" on:click={() => (orderSource = 'custom')}>🎲 custom</button>
          </span>
        {:else}
          <button class="mini" on:click={onShuffle}>🎲 shuffle</button>
        {/if}
      </div>
      {#if useReal}
        <p class="meta">Straight off Sleeper — {slotBoard.season} {slotBoard.type} board, {tradeCount} traded pick{tradeCount === 1 ? '' : 's'} honored.</p>
        <ol class="orderlist">
          {#each round1 as r}
            <li class:you={!spectate && r.handle === seat}>
              <span class="on">{r.slot}</span> {nm(r.handle)}
              {#if r.via}<em class="via">via {nm(r.via)}</em>{/if}
            </li>
          {/each}
        </ol>
      {:else}
        {#if realOk}<p class="meta"><button class="mini" on:click={onShuffle}>🎲 shuffle</button> your own order</p>{/if}
        <ol class="orderlist">
          {#each order as h, i}
            <li class:you={!spectate && h === seat}>
              <span class="on">{i + 1}</span> {nm(h)}
              <span class="arrows">
                <button class="mini" on:click={() => onMoveOrder(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button class="mini" on:click={() => onMoveOrder(i, 1)} disabled={i === order.length - 1} aria-label="Move down">↓</button>
              </span>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </div>

  <div class="sethd big">The room <span class="sub">who you're drafting against</span>
    <button class="mini" data-testid="reset-gms" on:click={onResetPersonas}>reset all to balanced</button>
  </div>
  <ul class="gms" data-testid="gm-list">
    {#each teams as [h, t]}
      <li class="gm" class:you={!spectate && h === seat}>
        <span class="av" aria-hidden="true">{initials(t)}</span>
        <span class="gtxt">
          <b>{t}{#if !spectate && h === seat}<em>YOU</em>{/if}</b>
          <i data-testid={'gm-phrase-' + h}>{personaPhrase(personas[h] || {})}</i>
        </span>
      </li>
    {/each}
  </ul>

  <details class="tweak" data-testid="customise-gms">
    <summary>⚙ Customise GMs — two dials each</summary>
    <p class="meta">
      <b>Window</b> slides a GM from win-now to future value. <b>Chaos</b> is how far off the top of their own board they'll stray — 0 always takes the best man, 100 can do something genuinely stupid. The dial is deliberately calm through the middle: half way along, a GM still takes the best available roughly one pick in four.
    </p>
    <div class="personas">
      {#each teams as [h, t]}
        <div class="pcard" class:you={!spectate && h === seat}>
          <div class="pname">{t}</div>
          <div class="phrase">{personaPhrase(personas[h] || {})}</div>
          <label class="slide">
            <span class="ends"><i>WIN-NOW</i><i>FUTURE</i></span>
            <input
              type="range" min="0" max="100" aria-label="{nm(h)} window"
              value={(personas[h] || {}).window ?? 50}
              on:input={(e) => onPersona(h, { window: +e.currentTarget.value })}
            />
          </label>
          <label class="slide">
            <span class="ends"><i>BY THE BOOK</i><i>CHAOTIC</i></span>
            <input
              type="range" min="0" max="100" aria-label="{nm(h)} chaos"
              value={(personas[h] || {}).chaos ?? 50}
              on:input={(e) => onPersona(h, { chaos: +e.currentTarget.value })}
            />
          </label>
          <div class="presets">
            {#each PRESETS as [label, patch]}<button class="mini" on:click={() => onPersona(h, patch)}>{label}</button>{/each}
          </div>
        </div>
      {/each}
    </div>
  </details>

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
            {#each hEntry.rows as r, ri}
              <div class="hrow"><b>#{ri + 1}</b> {nm(r.handle)} <span class="hg">{r.grade}</span> <span class="hl">{r.lean}</span> <span class="ht">{r.total}</span></div>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  /* No cap — the room fills the window, so a wide screen means a wider draft
     order list rather than a stripe of white on the right. */
  .lobby { max-width: none; }
  .hero { background: var(--barroom-lift); border: 1px solid var(--blue); border-radius: 14px; padding: 16px 18px; box-shadow: 0 10px 26px -18px rgba(28, 46, 64, .5); }
  .herotop { margin-bottom: 12px; }
  .kicker { font-family: var(--mono); font-size: 9px; letter-spacing: .18em; text-transform: uppercase; color: var(--blue); }
  .hero h2 { margin: 2px 0 0; font-family: var(--display); font-weight: 800; font-size: clamp(18px, 3.2vw, 25px); color: var(--blue-deep); line-height: 1.1; }

  .facts { list-style: none; margin: 0 0 14px; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 8px; }
  .facts li { background: var(--field); border: 1px solid var(--line); border-radius: 9px; padding: 7px 10px; min-width: 0; }
  .facts i { display: block; font-style: normal; font-family: var(--mono); font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .facts b { display: block; font-family: var(--mono); font-size: 12px; color: var(--chalk); overflow: hidden; text-overflow: ellipsis; }

  .go {
    width: 100%; font-family: var(--display); font-weight: 800; font-size: clamp(17px, 3vw, 21px);
    text-transform: uppercase; letter-spacing: .03em; background: var(--blue); color: #fff; border: none;
    border-radius: 12px; padding: 15px 20px; cursor: pointer; min-height: 60px;
    box-shadow: 0 10px 20px -12px rgba(47, 127, 184, .9);
  }
  .go small { display: block; font-family: var(--mono); font-size: 10.5px; font-weight: 400; text-transform: none; letter-spacing: 0; opacity: .92; margin-top: 3px; }
  .go:hover { background: var(--blue-deep); }

  .setgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: 12px; margin: 14px 0; align-items: start; }
  .setcard { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 13px 14px; }
  .sethd { font-family: var(--display); font-weight: 800; font-size: 12.5px; text-transform: uppercase; color: var(--chalk); margin-bottom: 9px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sethd.big { margin-top: 20px; }
  .sethd .sub { font-family: var(--mono); font-size: 10px; font-weight: 400; text-transform: none; color: var(--muted); }
  .sethd.big .mini { margin-left: auto; }
  .srcchips { display: flex; gap: 5px; }
  .chk { display: flex; gap: 8px; align-items: center; font-family: var(--mono); font-size: 12px; color: var(--chalk); margin-top: 10px; cursor: pointer; min-height: 34px; }
  .clockrow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .clockrow.dim { opacity: .45; }
  .clocklbl { font-family: var(--mono); font-size: 11px; color: var(--chalk); }
  .meta { font-family: var(--mono); font-size: 10.5px; color: var(--muted); margin: 9px 0 0; line-height: 1.6; }
  .meta b { color: var(--chalk); }

  .orderlist { list-style: none; margin: 6px 0 0; padding: 0; }
  .orderlist li { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 12.5px; color: var(--chalk); padding: 3px 4px; border-radius: 6px; flex-wrap: wrap; }
  .orderlist li.you { background: var(--blue-wash); }
  .orderlist .on { color: var(--blue); font-weight: 700; width: 20px; }
  .via { font-style: normal; font-size: 9px; color: var(--muted); background: var(--field-3); border-radius: 3px; padding: 1px 6px; }
  .arrows { margin-left: auto; display: flex; gap: 4px; }

  .mini { font-family: var(--mono); font-size: 10px; background: var(--field-3); border: 1px solid var(--line); color: var(--chalk); border-radius: 6px; padding: 4px 9px; cursor: pointer; min-height: 30px; }
  .mini.on { background: var(--blue); color: #fff; border-color: var(--blue); }
  .mini:disabled { opacity: .35; cursor: default; }

  .gms { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 8px; }
  .gm { display: flex; align-items: center; gap: 9px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; min-width: 0; }
  .gm.you { border-color: var(--blue); background: var(--blue-wash); }
  .av { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--field-3); color: var(--blue-deep); font-family: var(--display); font-weight: 800; font-size: 11px; }
  .gm.you .av { background: var(--blue); color: #fff; }
  .gtxt { min-width: 0; }
  .gtxt b { display: block; font-family: var(--body); font-weight: 700; font-size: 13px; color: var(--chalk); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gtxt em { font-style: normal; font-family: var(--mono); font-size: 8.5px; color: #fff; background: var(--blue); border-radius: 3px; padding: 1px 5px; margin-left: 5px; }
  .gtxt i { font-style: normal; font-family: var(--mono); font-size: 10px; color: var(--muted); }

  .tweak { margin: 14px 0 0; }
  .tweak summary { font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: 12.5px; color: var(--blue); cursor: pointer; padding: 8px 0; }
  .personas { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 10px; margin-top: 10px; }
  .pcard { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 11px 13px; }
  .pcard.you { border-color: var(--blue); }
  .pname { font-family: var(--body); font-weight: 700; font-size: 13px; color: var(--chalk); }
  .phrase { font-family: var(--mono); font-size: 9.5px; color: var(--muted); margin-bottom: 7px; }
  .slide { display: block; margin-bottom: 5px; }
  .ends { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 8.5px; letter-spacing: .06em; color: var(--muted); }
  .slide input[type=range] { width: 100%; accent-color: var(--blue); }
  .presets { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }

  .hist { display: flex; flex-direction: column; gap: 6px; }
  .histrow { display: flex; justify-content: space-between; gap: 10px; font-family: var(--mono); font-size: 11.5px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 8px; padding: 9px 12px; cursor: pointer; color: var(--chalk); text-align: left; }
  .hgrades { color: var(--muted); }
  .histboard { background: var(--field-3); border-radius: 8px; padding: 8px 12px; }
  .hrow { font-family: var(--mono); font-size: 11.5px; color: var(--chalk); display: flex; gap: 10px; padding: 2px 0; }
  .hrow .hg { color: var(--blue); font-weight: 700; }
  .hrow .hl, .hrow .ht { color: var(--muted); margin-left: auto; }

  @media (max-width: 860px) {
    .setgrid { grid-template-columns: 1fr; }
    .mini { min-height: 36px; padding: 6px 11px; }
    .facts { grid-template-columns: 1fr 1fr; }
  }
</style>
