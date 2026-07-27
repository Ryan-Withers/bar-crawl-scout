<script>
  // THE FEED — every pick as it lands, newest on top, with the board-rank
  // verdict a real draft room shouts about (steal / reach).
  import { pickCode } from '../../lib/engine/mockdraft.ts';
  import { posColor } from './theme.js';

  export let st;
  export let seat = null;
  export let spectate = false;
  export let nm = (h) => h;
  export let max = 40;

  $: teams = st ? st.cfg.order.length : 0;
  $: feed = st ? [...st.log].reverse().slice(0, max) : [];
</script>

<div class="feed" data-testid="feed">
  <div class="fhd"><span class="hd">Pick feed</span><span class="count" data-testid="feed-count">{st ? st.log.length : 0}</span></div>
  {#if !feed.length}
    <p class="empty">Nothing yet. Hit ▶ auto or sim to your pick and the room gets going.</p>
  {:else}
    <div class="rows">
      {#each feed as p (p.overall)}
        <div class="frow" class:mine={!spectate && p.handle === seat}>
          <span class="code">{pickCode(p.overall, teams)}</span>
          <span class="pos" style="--pc:{posColor(p.player.pos)}">{p.player.pos}</span>
          <span class="body">
            <b>{p.player.name}</b>
            <i>{nm(p.handle)}
              {#if p.overall - p.boardRank >= 8}<em class="steal">💎 steal</em>
              {:else if p.overall - p.boardRank <= -8}<em class="reach">🚨 reach</em>{/if}
            </i>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .feed { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; min-width: 0; }
  .fhd { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .hd { font-family: var(--display); font-weight: 800; font-size: 12px; text-transform: uppercase; color: var(--chalk); }
  .count { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--muted); }
  .empty { font-family: var(--mono); font-size: 10.5px; color: var(--muted); line-height: 1.6; margin: 0; }
  .rows { max-height: 46vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .frow { display: flex; align-items: center; gap: 7px; padding: 5px 2px; border-bottom: 1px dashed var(--line); }
  .frow.mine { background: var(--blue-wash); border-radius: 6px; }
  .code { flex: none; width: 34px; font-family: var(--mono); font-size: 9.5px; color: var(--muted); font-weight: 700; }
  .pos { flex: none; width: 26px; text-align: center; font-family: var(--mono); font-size: 8px; font-weight: 700; color: #fff; background: var(--pc); border-radius: 4px; padding: 2px 0; }
  .body { min-width: 0; display: flex; flex-direction: column; }
  .body b { font-family: var(--mono); font-size: 12px; color: var(--chalk); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .body i { font-style: normal; font-family: var(--mono); font-size: 9.5px; color: var(--muted); }
  .steal, .reach { font-style: normal; margin-left: 5px; }
  .steal { color: var(--good); }
  .reach { color: var(--stamp-red); }
  @media (max-width: 860px) { .rows { max-height: none; } }
</style>
