<script>
  // ON THE CLOCK — the bar that runs the room. Names the drafter, counts the
  // clock down with real urgency, shows the bots visibly thinking, and holds
  // every transport control (pause / sim / undo / speed).
  import { currentHandle, roundOf, pickCode, clockPhase, fmtClock, picksUntil } from '../../lib/engine/mockdraft.ts';
  import { initials } from './theme.js';

  export let st;
  export let seat = null;
  export let spectate = false;
  export let userTurn = false;
  export let nm = (h) => h;
  export let thinking = false;
  export let running = false;      // an auto/sim run is ticking
  export let runMode = 'idle';
  export let clockLen = 0;
  export let clockLeft = 0;
  export let speed = 700;
  export let canUndo = false;
  export let canUndoMine = false;
  export let onPlay = () => {};
  export let onPause = () => {};
  export let onSimToMe = () => {};
  export let onSimToEnd = () => {};
  export let onSpeed = () => {};
  export let onUndo = () => {};
  export let onUndoMine = () => {};

  $: teams = st ? st.cfg.order.length : 0;
  $: onClock = st && !st.done ? currentHandle(st) : null;
  $: overall = st ? st.log.length + 1 : 0;
  $: code = pickCode(overall, teams);
  $: phase = clockPhase(clockLeft, userTurn ? clockLen : 0);
  $: upIn = st && !spectate && seat && !userTurn ? picksUntil(st, seat) : -1;
</script>

<div class="clockbar" class:yours={userTurn} class:urgent={phase === 'urgent'} data-testid="clock">
  <div class="who">
    <span class="av" class:me={userTurn} aria-hidden="true">{initials(onClock ? nm(onClock) : '—')}</span>
    <span class="whotxt">
      {#if userTurn}
        <b class="takeover" data-testid="your-turn">YOU'RE ON THE CLOCK</b>
        <i>Pick {code} · round {roundOf(st)} — make it count</i>
      {:else if onClock}
        <b>{nm(onClock)}</b>
        <i>
          <span class="code">{code}</span> · round {roundOf(st)}
          {#if thinking}<span class="think">thinking<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>{/if}
        </i>
      {:else}
        <b>Draft complete</b><i>every pick is in</i>
      {/if}
    </span>
  </div>

  {#if userTurn && clockLen > 0}
    <span class="pickclock" class:warn={phase === 'warn'} class:low={phase === 'urgent' || phase === 'expired'} data-testid="pickclock">
      {fmtClock(clockLeft)}
    </span>
  {:else if upIn > 0}
    <span class="upin" data-testid="up-in">you're up in <b>{upIn}</b></span>
  {/if}

  <div class="controls">
    {#if !spectate}
      <button data-testid="sim-to-me" on:click={onSimToMe} disabled={userTurn && runMode !== 'toMe'}>
        {runMode === 'toMe' ? '⏹ stop' : '⏩ to my pick'}
      </button>
    {/if}
    <button data-testid="pause" on:click={running ? onPause : onPlay} disabled={userTurn && !running}>
      {running ? '⏸ pause' : '▶ auto'}
    </button>
    <button data-testid="sim-to-end" on:click={onSimToEnd}>{runMode === 'toEnd' ? '⏹ stop' : '⏭ sim to end'}</button>
    <button class="undo" data-testid="undo" on:click={onUndo} disabled={!canUndo}>↶ undo</button>
    {#if canUndoMine}
      <button class="undo" data-testid="undo-mine" on:click={onUndoMine}>↶ my pick</button>
    {/if}
    <span class="speed" role="group" aria-label="Bot pace">
      <button class:on={speed === 1200} on:click={() => onSpeed(1200)}>slow</button>
      <button class:on={speed === 700} on:click={() => onSpeed(700)}>med</button>
      <button class:on={speed === 250} on:click={() => onSpeed(250)}>fast</button>
    </span>
  </div>
</div>

<style>
  .clockbar {
    position: sticky; top: 0; z-index: 25;
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    background: var(--barroom-lift); border: 1px solid var(--line); border-left: 5px solid var(--blue);
    border-radius: 12px; padding: 9px 14px; margin-bottom: 12px;
    font-family: var(--mono); font-size: 12.5px; color: var(--chalk);
    box-shadow: 0 8px 18px -12px rgba(28, 46, 64, .45);
  }
  /* The takeover: when it's your pick the bar stops being furniture. */
  .clockbar.yours { border-color: var(--blue); border-left-color: var(--blue-deep); background: var(--blue-wash); box-shadow: 0 0 0 2px var(--blue-sky), 0 10px 22px -14px rgba(28, 46, 64, .55); }
  .clockbar.urgent { border-left-color: var(--stamp-red); box-shadow: 0 0 0 2px var(--stamp-red), 0 10px 22px -14px rgba(28, 46, 64, .55); }

  .who { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .av {
    flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
    background: var(--blue); color: #fff; font-family: var(--display); font-weight: 800; font-size: 12px; letter-spacing: .02em;
  }
  .av.me { background: var(--blue-deep); box-shadow: 0 0 0 3px var(--blue-sky); }
  .whotxt { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .whotxt b { font-family: var(--display); font-weight: 800; font-size: 14px; color: var(--blue-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .whotxt b.takeover { font-size: 15px; letter-spacing: .03em; animation: takeover 1.6s ease-in-out infinite; }
  .whotxt i { font-style: normal; font-size: 10.5px; color: var(--muted); }
  .code { color: var(--blue); font-weight: 700; }
  @keyframes takeover { 0%, 100% { opacity: 1; } 50% { opacity: .62; } }

  .think { margin-left: 6px; color: var(--blue); }
  .dot { animation: blink 1.1s infinite; }
  .dot:nth-child(2) { animation-delay: .18s; }
  .dot:nth-child(3) { animation-delay: .36s; }
  @keyframes blink { 0%, 60%, 100% { opacity: .25; } 30% { opacity: 1; } }

  .pickclock {
    font-family: var(--display); font-weight: 800; font-size: 20px; line-height: 1;
    color: var(--blue-deep); background: var(--paper); border: 2px solid var(--blue);
    border-radius: 9px; padding: 5px 12px; font-variant-numeric: tabular-nums;
  }
  .pickclock.warn { color: #fff; background: var(--brass); border-color: var(--brass); }
  .pickclock.low { color: #fff; background: var(--stamp-red); border-color: var(--stamp-red); animation: clockpulse .8s ease-in-out infinite; }
  @keyframes clockpulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.09); } }
  .upin { font-size: 10.5px; color: var(--muted); } .upin b { color: var(--blue-deep); font-size: 12px; }

  .controls { margin-left: auto; display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
  .controls button {
    font-family: var(--mono); font-size: 10.5px; background: var(--paper); border: 1px solid var(--line);
    color: var(--chalk); border-radius: 7px; padding: 6px 10px; cursor: pointer; min-height: 34px;
  }
  .controls button:hover:not(:disabled) { border-color: var(--blue); color: var(--blue-deep); }
  .controls button:disabled { opacity: .38; cursor: default; }
  .controls .undo { color: var(--muted); }
  .speed { display: flex; gap: 3px; }
  .speed button.on { background: var(--blue); color: #fff; border-color: var(--blue); }

  @media (max-width: 860px) {
    .clockbar { padding: 8px 10px; gap: 8px; border-radius: 10px; }
    .who { flex: 1 1 auto; }
    .controls { margin-left: 0; width: 100%; gap: 4px; }
    .controls > button { flex: 1 1 auto; min-height: 40px; }
    .speed { width: 100%; }
    .speed button { flex: 1; min-height: 36px; }
    .pickclock { font-size: 22px; padding: 4px 10px; }
  }
</style>
