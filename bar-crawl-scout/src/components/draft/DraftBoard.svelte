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
  export let userTurn = false;     // your pick — always pull the view back

  let wrap;
  $: N = st ? st.cfg.order.length : 0;
  $: cursor = st ? st.cursor : -1;
  $: lastPick = st && st.log.length ? st.log.length - 1 : -1;

  // THE RAGGED BOARD.
  //
  // A mock over an untouched order is a clean grid: every round holds exactly
  // one pick per manager, so a sequence index tells you the round and the column
  // on its own. The REAL board is not that. Keepers sit at the bottom and the
  // bottom picks have been traded, so round 12 holds eight live picks and round
  // 13 holds two. The old arithmetic still produced a grid — 120 divides by 10 —
  // and quietly filed those two round-13 picks under other managers' columns,
  // labelled 12.09 and 12.10. Nothing errored; it was simply wrong.
  //
  // So when the config carries real coordinates, the board is built from them.
  $: meta = st?.cfg?.sequenceMeta || null;
  $: uniform = !!st && N > 0 && st.seq.length % N === 0;
  $: gridOk = !!st && N > 0 && (!!meta || uniform);
  $: rounds = meta ? Math.max(0, ...meta.map((m) => m.round)) : (uniform ? st.seq.length / N : 0);

  // seq index for (0-based round r, 0-based column c): snakes on even rounds.
  const idxOf = (r, c, n, type) => r * n + (type === 'snake' && r % 2 === 1 ? n - 1 - c : c);
  // With real coordinates, look the index up by (round, slot) instead — and
  // return -1 for a cell nobody picks in, which is what a keeper leaves behind.
  $: metaIndex = meta
    ? (() => { const m = new Map(); meta.forEach((x, i) => m.set(`${x.round}:${x.slot}`, i)); return m; })()
    : null;
  $: indexAt = (r, c) => (metaIndex
    ? (metaIndex.has(`${r + 1}:${c + 1}`) ? metaIndex.get(`${r + 1}:${c + 1}`) : -1)
    : idxOf(r, c, N, boardType));
  // The pick's real code (13.01), not one recomputed from its position in the log.
  $: codeOf = (idx, p) => (meta && meta[idx] ? pickCode(meta[idx].pickNo, N) : pickCode(p.boardPick ?? p.overall, N));

  // KEEP THE CLOCK IN VIEW — unless you have gone looking somewhere else.
  //
  // On a phone this board is 15 rows tall inside a viewport that shows maybe
  // five. Scroll down to read the keeper rows at the bottom and, at the 28ms
  // sim pace, the next pick yanked you straight back with smooth scrolling —
  // so the bottom of the board was effectively unreachable during a run.
  //
  // Any scroll you make yourself parks the auto-follow until the board comes
  // back to you: your own turn, or the end of the draft.
  let userMoved = false;
  let selfScrollUntil = 0;
  function onScroll() {
    // Our own scrollTop writes fire this too; ignore them for a beat.
    if (Date.now() < selfScrollUntil) return;
    userMoved = true;
  }
  /** Called when the board is yours again — resume following. */
  export function resumeFollow() { userMoved = false; follow(); }

  // Keep the cell on the clock centred as the picks tick through.
  export function follow() {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      const el = wrap && wrap.querySelector('.cur');
      if (!el || !wrap || !wrap.offsetParent) return;
      const br = wrap.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      selfScrollUntil = Date.now() + 400;
      wrap.scrollLeft += er.left - br.left - br.width / 2 + er.width / 2;
      wrap.scrollTop += er.top - br.top - br.height / 2 + er.height / 2;
    });
  }
  $: if (wrap && live && cursor >= 0 && !userMoved) follow();
  // Your own turn always wins back the view — that is the one moment you need it.
  $: if (userTurn) { userMoved = false; }
</script>

<div class="boardwrap" class:full={!live} bind:this={wrap} on:scroll={onScroll} data-testid="draft-board">
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
              {@const idx = indexAt(r, c)}
              {@const p = idx >= 0 ? st.log[idx] : null}
              {@const owner = idx >= 0 ? st.seq[idx] : null}
              <td
                class="cell"
                class:cur={live && idx >= 0 && idx === cursor}
                class:mine={!spectate && owner === seat}
                class:empty={!p}
                class:spent={idx < 0}
              >
                {#if idx < 0}
                  <!-- A pick that no longer exists: a keeper is sitting on it. -->
                  <span class="todo spent">—</span>
                {:else if p}
                  <span class="pk" class:fresh={live && idx === lastPick} style="--pc:{posColor(p.player.pos)}">
                    <b>{shortName(p.player.name)}</b>
                    <i>{p.player.pos} · {nm(p.handle)}</i>
                    <em class="code">{codeOf(idx, p)}</em>
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
  /* A cell a keeper has already taken: on the board so the rounds line up, but
     plainly not a pick anybody is going to make. */
  .cell.spent { opacity: .3; }
  .todo.spent { color: var(--muted); }
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
