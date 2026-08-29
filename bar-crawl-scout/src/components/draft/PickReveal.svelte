<script>
  // THE REVEAL — "WITH PICK 1.04 — RYAN SELECTS", then the card. Non-blocking
  // (pointer-events off except the skip), auto-dismissing, and dead still for
  // anyone who asked for reduced motion.
  import { pickCode } from '../../lib/engine/mockdraft.ts';
  import { posColor, initials } from './theme.js';

  export let pick = null;          // a MockPick, or null when nothing to show
  export let teams = 10;
  export let nm = (h) => h;
  export let mine = false;
  export let onSkip = () => {};
</script>

{#if pick}
  {#key pick.overall}
    <div class="revealwrap" data-testid="reveal" aria-live="polite">
      <div class="reveal" class:mine>
        <div class="banner">
          <span class="av" aria-hidden="true">{initials(nm(pick.handle))}</span>
          <span class="btxt">
            <i>With pick {pickCode(pick.boardPick ?? pick.overall, teams)}</i>
            <b>{nm(pick.handle)} {mine ? 'take' : 'takes'}</b>
          </span>
          <button class="skip" on:click={onSkip} aria-label="Dismiss pick announcement" data-testid="reveal-skip">✕</button>
        </div>
        <div class="card">
          <span class="pos" style="--pc:{posColor(pick.player.pos)}">{pick.player.pos}</span>
          <span class="who">
            <b>{pick.player.name}</b>
            <i>{pick.player.team}{pick.player.bye ? ' · bye ' + pick.player.bye : ''} · board #{pick.boardRank}</i>
          </span>
        </div>
      </div>
    </div>
  {/key}
{/if}

<style>
  .revealwrap { position: fixed; right: 16px; bottom: 16px; z-index: 60; pointer-events: none; max-width: min(340px, calc(100vw - 32px)); }
  .reveal {
    background: var(--paper); border: 1px solid var(--blue); border-left: 6px solid var(--blue);
    border-radius: 12px; box-shadow: 0 18px 34px -18px rgba(28, 46, 64, .6); overflow: hidden;
    animation: slidein .35s cubic-bezier(.2, 1.2, .4, 1);
  }
  .reveal.mine { border-left-color: var(--brass); }
  @keyframes slidein { 0% { transform: translateY(14px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }

  .banner { display: flex; align-items: center; gap: 8px; background: var(--blue-wash); padding: 7px 10px; border-bottom: 1px solid var(--line); }
  .av { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--blue); color: #fff; font-family: var(--display); font-weight: 800; font-size: 9.5px; }
  .btxt { display: flex; flex-direction: column; min-width: 0; }
  .btxt i { font-style: normal; font-family: var(--mono); font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .btxt b { font-family: var(--display); font-weight: 800; font-size: 12.5px; text-transform: uppercase; color: var(--blue-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .skip { pointer-events: auto; margin-left: auto; background: none; border: none; color: var(--muted); font-size: 12px; cursor: pointer; width: 30px; height: 30px; border-radius: 6px; }
  .skip:hover { color: var(--chalk); background: var(--field-3); }

  .card { display: flex; align-items: center; gap: 10px; padding: 10px; }
  .pos { flex: none; width: 34px; text-align: center; font-family: var(--mono); font-size: 10px; font-weight: 700; color: #fff; background: var(--pc); border-radius: 5px; padding: 4px 0; }
  .who { min-width: 0; }
  .who b { display: block; font-family: var(--display); font-weight: 800; font-size: 16px; line-height: 1.15; color: var(--chalk); }
  .who i { font-style: normal; font-family: var(--mono); font-size: 10px; color: var(--muted); }

  @media (max-width: 860px) {
    /* Clear both the phone tab bar (56px) and the thumb draft button above it. */
    .revealwrap { left: 8px; right: 8px; bottom: 140px; max-width: none; }
    .who b { font-size: 15px; }
  }
</style>
