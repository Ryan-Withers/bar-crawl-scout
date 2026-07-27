<script>
  // THE BOARD — the hero. Rounds down, draft slots across, snake direction
  // marked, the live cell lit and dragged into view, picks landing with a pop.
  import { shortName, pickCode } from '../../lib/engine/mockdraft.ts';
  import { posColor, initials } from './theme.js';

  export let st;
  export let boardType = 'snake';
  export let seat = null;
  export let spectate = false;
  export let nm = (h) => h;
  export let live = true;          // false = the finished board in the debrief

  let wrap;
  $: N = st ? st.cfg.order.length : 0;
  $: gridOk = !!st && N > 0 && st.seq.length % N === 0;
  $: rounds = gridOk ? st.seq.length / N : 0;
  $: cursor = st ? st.cursor : -1;
  $: lastPick = st && st.log.length ? st.log.length - 1 : -1;

  // seq index for (0-based round r, 0-based column c): snakes on even rounds.
  const idxOf = (r, c, n, type) => r * n + (type === 'snake' && r % 2 === 1 ? n - 1 - c : c);

  // Keep the cell on the clock centred as the picks tick through.
  export function follow() {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      const el = wrap && wrap.querySelector('.cur');
      if (!el || !wrap || !wrap.offsetParent) return;
      const br = wrap.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      wrap.scrollLeft += er.left - br.left - br.width / 2 + er.width / 2;
      wrap.scrollTop += er.top - br.top - br.height / 2 + er.height / 2;
    });
  }
  $: if (wrap && live && cursor >= 0) follow();
</script>

<div class="boardwrap" class:full={!live} bind:this={wrap} data-testid="draft-board">
  {#if gridOk}
    <table class="board">
      <thead>
        <tr>
          <th class="rd" scope="col"><span class="sr">Round</span></th>
          {#each st.cfg.order as h, c}
            <th scope="col" class:mine={!spectate && h === seat} title={nm(h)}>
              <span class="hcell">
                <span class="av" aria-hidden="true">{initials(nm(h))}</span>
                <span class="hname"><i>{c + 1}</i> {nm(h)}</span>
              </span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each Array(rounds) as _, r}
          <tr>
            <td class="rd">
              <b>{r + 1}</b>
              <i class="dir" title={boardType === 'snake' && r % 2 === 1 ? 'snaking back' : 'left to right'}>
                {boardType === 'snake' && r % 2 === 1 ? '←' : '→'}
              </i>
            </td>
            {#each Array(N) as __, c}
              {@const idx = idxOf(r, c, N, boardType)}
              {@const p = st.log[idx]}
              {@const owner = st.seq[idx]}
              <td
                class="cell"
                class:cur={live && idx === cursor}
                class:mine={!spectate && owner === seat}
                class:empty={!p}
              >
                {#if p}
                  <span class="pk" class:fresh={live && idx === lastPick} style="--pc:{posColor(p.player.pos)}">
                    <b>{shortName(p.player.name)}</b>
                    <i>{p.player.pos} · {nm(p.handle)}</i>
                    <em class="code">{pickCode(p.overall, N)}</em>
                  </span>
                {:else if live && idx === cursor}
                  <span class="onclk">⏱ {nm(owner)}</span>
                {:else}
                  <span class="todo">{nm(owner)}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="nogrid">Board unavailable for this pick order.</p>
  {/if}
</div>

<style>
  .boardwrap {
    overflow: auto; max-height: min(48vh, 420px); background: var(--barroom-lift);
    border: 1px solid var(--line); border-radius: 12px; padding: 6px;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
  }
  .boardwrap.full { max-height: none; }
  /* Fixed layout so a long team name can never widen (or spill out of) a column —
     every name ellipses inside its own cell the way a real draft board does. */
  .board { border-collapse: separate; border-spacing: 2px; font-family: var(--mono); font-size: 10px; table-layout: fixed; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

  th {
    position: sticky; top: 0; z-index: 2; background: var(--barroom-lift);
    padding: 4px 5px 6px; text-align: left; width: 104px;
    border-bottom: 2px solid var(--line);
  }
  .hcell { display: flex; align-items: center; gap: 4px; min-width: 0; }
  th .av {
    display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%;
    background: var(--field-3); color: var(--blue-deep); font-family: var(--display);
    font-weight: 800; font-size: 8px; flex: none;
  }
  th.mine { border-bottom-color: var(--blue); }
  th.mine .av { background: var(--blue); color: #fff; }
  .hname {
    flex: 1; min-width: 0; font-size: 8.5px; text-transform: uppercase; letter-spacing: .04em;
    color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .hname i { font-style: normal; color: var(--blue); font-weight: 700; }

  .rd {
    position: sticky; left: 0; z-index: 1; background: var(--barroom-lift); color: var(--muted);
    padding: 2px 6px; text-align: center; width: 36px;
  }
  .rd b { display: block; font-size: 12px; color: var(--chalk); }
  .rd .dir { font-style: normal; font-size: 9px; color: var(--blue); }
  th.rd { z-index: 3; }

  .cell { width: 104px; height: 40px; border-radius: 6px; background: var(--field-2); border: 1px solid var(--line); padding: 0; vertical-align: middle; }
  .cell.empty { background: var(--field); border-style: dashed; }
  .cell.mine { background: rgba(130, 201, 252, .16); }
  .cell.mine.empty { background: rgba(130, 201, 252, .10); }
  .cell.cur { background: var(--blue-wash); border-color: var(--blue); box-shadow: 0 0 0 2px var(--blue); }

  .pk { display: block; border-left: 3px solid var(--pc); padding: 3px 5px; position: relative; }
  .pk b { display: block; color: var(--chalk); font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pk i { font-style: normal; display: block; color: var(--muted); font-size: 8.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pk .code { position: absolute; top: 2px; right: 4px; font-style: normal; font-size: 7.5px; color: var(--muted); opacity: .75; }
  .pk.fresh { animation: land .42s cubic-bezier(.2, 1.3, .5, 1); }
  @keyframes land { 0% { transform: scale(.72) translateY(-6px); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }

  .todo { display: block; padding: 3px 6px; color: var(--muted); opacity: .55; font-size: 8.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cell.mine .todo { color: var(--blue-deep); opacity: .95; font-weight: 700; }
  .onclk { display: block; padding: 3px 6px; color: var(--blue-deep); font-weight: 700; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nogrid { font-family: var(--mono); font-size: 11px; color: var(--muted); padding: 10px; margin: 0; }

  @media (max-width: 860px) {
    .boardwrap { max-height: calc(100vh - 250px); padding: 4px; }
    .cell, th { width: 86px; }
    .pk b { font-size: 10px; }
  }
</style>
