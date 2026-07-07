<script>
  import { link } from 'svelte-spa-router';
  import { TEAMS, TEAMSHORT, RYAN } from '../lib/data.js';
  import { bettor, bets, leaderboard, betsFor } from '../lib/bet.js';
  import SportsbookLogo from './SportsbookLogo.svelte';

  $: me = $bettor;
  $: board = $leaderboard;
  $: myBets = me ? [...$bets].filter((b) => b.handle === me).sort((a, b) => b.placed - a.placed) : [];
  const nm = (h) => TEAMSHORT[h] || h;
  const fmt = (n) => (n >= 0 ? '+$' : '-$') + Math.abs(Math.round(n * 100) / 100).toFixed(2);
  const STAT = { open: ['OPEN', 'muted'], won: ['WON', 'good'], lost: ['LOST', 'bad'], void: ['VOID', 'muted'] };
</script>

<section class="ledger">
  <div class="sponsor"><SportsbookLogo size={24} /><span class="tag">Season Ledger · Bar Crawl Order</span></div>

  <h1>The Leaderboard</h1>
  <p class="blurb">Season-long profit &amp; loss on your pretend dollars. Everyone starts even; the sharpest read (and the luckiest) climbs. <a href="/book" use:link>Back to the markets →</a></p>

  <div class="board">
    <div class="brow head"><span class="rk">#</span><span class="tm">Bettor</span><span class="c">Bets</span><span class="c">W-L</span><span class="c">Staked</span><span class="c pl">P/L</span></div>
    {#each board as r, i}
      <div class="brow" class:you={r.handle === me} class:lead={i === 0 && r.bets > 0}>
        <span class="rk">{i + 1}</span>
        <span class="tm"><a href={'/managers/' + r.handle} use:link>{nm(r.handle)}</a></span>
        <span class="c">{r.bets}</span>
        <span class="c">{r.won}-{r.lost}</span>
        <span class="c">${Math.round(r.staked)}</span>
        <span class="c pl" class:pos={r.pl > 0} class:neg={r.pl < 0}>{r.bets ? fmt(r.pl) : '—'}</span>
      </div>
    {/each}
  </div>

  {#if me}
    <h2>Your slips</h2>
    {#if !myBets.length}
      <div class="empty">No bets down yet. <a href="/book" use:link>Hit the markets →</a></div>
    {:else}
      <div class="mybets">
        {#each myBets as b (b.id)}
          <div class="bet">
            <div class="bhd">
              <span class="kind">{b.kind === 'multi' ? 'MULTI ×' + b.legs.length : 'SINGLE'}</span>
              <span class="wk">Wk {b.week}</span>
              <span class="stat {STAT[b.status][1]}">{STAT[b.status][0]}</span>
            </div>
            {#each b.legs as l}<div class="leg">{l.label} <span class="lo">@ {l.odds.toFixed(2)}</span></div>{/each}
            <div class="bft"><span>Stake ${b.stake.toFixed(2)} @ {b.odds.toFixed(2)}</span><b>Returns ${(b.stake * b.odds).toFixed(2)}</b></div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .ledger { max-width: 860px; padding-top: 6px; }
  .sponsor { display: flex; align-items: center; gap: 12px; background: linear-gradient(90deg,#0a1410,#0d1a12); border: 1px solid rgba(18,255,110,.25); border-radius: 12px; padding: 10px 16px; margin-bottom: 14px; }
  .sponsor .tag { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #7fd8a3; }
  h1 { font-family: 'Archivo Black', sans-serif; font-size: clamp(26px,4vw,40px); text-transform: uppercase; margin: 0 0 4px; color: var(--chalk); }
  h2 { font-family: 'Archivo Black', sans-serif; font-size: 15px; text-transform: uppercase; color: var(--chalk); margin: 24px 0 10px; }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 16px; line-height: 1.6; } .blurb a { color: #12ff6e; }
  .board { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; }
  .brow { display: grid; grid-template-columns: 30px 1fr 50px 60px 70px 84px; align-items: center; gap: 8px; padding: 9px 6px; border-bottom: 1px dashed var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .brow:last-child { border-bottom: none; }
  .brow.head { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border-bottom: 1.5px solid var(--line); }
  .brow.you { background: rgba(130,201,252,.08); border-radius: 5px; } .brow.lead { background: rgba(18,255,110,.08); border-radius: 5px; }
  .rk { font-weight: 700; color: var(--muted); text-align: center; } .brow.lead .rk { color: #12ff6e; }
  .tm a { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 14px; color: var(--chalk); text-decoration: none; } .tm a:hover { color: var(--neon-hot); }
  .c { text-align: right; color: var(--muted); } .pl { color: var(--chalk); font-weight: 700; } .pl.pos { color: #12ff6e; } .pl.neg { color: var(--stamp-red); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); } .empty a { color: #12ff6e; }
  .mybets { display: flex; flex-direction: column; gap: 10px; }
  .bet { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 11px 14px; }
  .bhd { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .kind { font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .08em; color: #12ff6e; border: 1px solid rgba(18,255,110,.4); border-radius: 3px; padding: 1px 6px; }
  .wk { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); }
  .stat { margin-left: auto; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .06em; } .stat.good { color: #12ff6e; } .stat.bad { color: var(--stamp-red); } .stat.muted { color: var(--muted); }
  .leg { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--chalk); padding: 2px 0; } .leg .lo { color: #12ff6e; }
  .bft { display: flex; justify-content: space-between; margin-top: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); } .bft b { color: var(--chalk); }
</style>
