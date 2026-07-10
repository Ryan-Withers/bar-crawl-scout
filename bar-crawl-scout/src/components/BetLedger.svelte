<script>
  import { onMount } from 'svelte';
  import { link } from 'svelte-spa-router';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMS, TEAMSHORT, RYAN } from '../lib/data.js';
  import { bettor, bets, leaderboard, betsFor, codeFor } from '../lib/bet.js';
  import { loadBets, gradeWeek, settleBet } from '../lib/betsync.js';
  import { stateQuery } from '../api/queries';
  import SportsbookLogo from './SportsbookLogo.svelte';

  onMount(loadBets); // pull the shared season ledger off the Worker

  const stateQ = createQuery(stateQuery());
  $: me = $bettor;
  $: isCommish = me === RYAN; // only Ryan can settle — the Worker enforces it too
  $: board = $leaderboard;
  $: myBets = me ? [...$bets].filter((b) => b.handle === me).sort((a, b) => b.placed - a.placed) : [];
  const nm = (h) => TEAMSHORT[h] || h;
  const fmt = (n) => (n >= 0 ? '+$' : '-$') + Math.abs(Math.round(n * 100) / 100).toFixed(2);
  const STAT = { open: ['OPEN', 'muted'], won: ['WON', 'good'], lost: ['LOST', 'bad'], void: ['VOID', 'muted'] };

  // ---- commissioner settlement ----
  let gradeWk = 1;
  $: if ($stateQ.data?.week) gradeWk = gradeWk || $stateQ.data.week;
  let busy = false;
  let note = '';
  $: openBets = isCommish ? [...$bets].filter((b) => b.status === 'open').sort((a, b) => a.week - b.week || a.placed - b.placed) : [];

  async function doGrade() {
    busy = true; note = '';
    try {
      const res = await gradeWeek(codeFor(me), gradeWk);
      note = res?.ok ? `Graded Week ${gradeWk}: ${res.graded} prop bet${res.graded === 1 ? '' : 's'} settled off live scores.` : `Couldn't grade: ${res?.reason || 'error'}`;
    } catch { note = 'Grading needs the Worker — it looks unreachable right now.'; }
    busy = false;
  }
  async function doSettle(id, status) {
    busy = true; note = '';
    try {
      const res = await settleBet(codeFor(me), id, status);
      if (!res?.ok) note = `Couldn't settle: ${res?.reason || 'error'}`;
    } catch { note = 'Settling needs the Worker — it looks unreachable right now.'; }
    busy = false;
  }
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

  {#if isCommish}
    <div class="commish">
      <div class="chd">🛎️ Commissioner — settle the book</div>
      <div class="grade">
        <span>Auto-grade player props for</span>
        <label>Week <input type="number" min="1" max="18" bind:value={gradeWk} /></label>
        <button on:click={doGrade} disabled={busy}>{busy ? 'Working…' : 'Grade off live scores'}</button>
      </div>
      <p class="ghint">Pulls that week's real Sleeper points and settles every open O/U. Futures and anything else you settle by hand below.</p>
      {#if note}<div class="note">{note}</div>{/if}

      {#if openBets.length}
        <div class="opentbl">
          {#each openBets as b (b.id)}
            <div class="orow">
              <span class="ow">{nm(b.handle)}</span>
              <span class="odesc">{b.kind === 'multi' ? 'Multi ×' + b.legs.length + ': ' : ''}{b.legs.map((l) => l.label).join(' + ')}</span>
              <span class="owk">Wk {b.week} · ${b.stake.toFixed(0)} @ {b.odds.toFixed(2)}</span>
              <span class="oact">
                <button class="w" on:click={() => doSettle(b.id, 'won')} disabled={busy} title="Mark won">W</button>
                <button class="l" on:click={() => doSettle(b.id, 'lost')} disabled={busy} title="Mark lost">L</button>
                <button class="v" on:click={() => doSettle(b.id, 'void')} disabled={busy} title="Void / refund">V</button>
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="allsettled">No open bets — everything's settled. ✓</div>
      {/if}
    </div>
  {/if}

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
  .sponsor .tag { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #8FE8B8; }
  h1 { font-family: 'Archivo Black', sans-serif; font-size: clamp(26px,4vw,40px); text-transform: uppercase; margin: 0 0 4px; color: var(--chalk); }
  h2 { font-family: 'Archivo Black', sans-serif; font-size: 15px; text-transform: uppercase; color: var(--chalk); margin: 24px 0 10px; }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 16px; line-height: 1.6; } .blurb a { color: #0C8C4A; }
  .board { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; }
  .brow { display: grid; grid-template-columns: 30px 1fr 50px 60px 70px 84px; align-items: center; gap: 8px; padding: 9px 6px; border-bottom: 1px dashed var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .brow:last-child { border-bottom: none; }
  .brow.head { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border-bottom: 1.5px solid var(--line); }
  .brow.you { background: rgba(130,201,252,.08); border-radius: 5px; } .brow.lead { background: rgba(18,255,110,.08); border-radius: 5px; }
  .rk { font-weight: 700; color: var(--muted); text-align: center; } .brow.lead .rk { color: #0C8C4A; }
  .tm a { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 14px; color: var(--chalk); text-decoration: none; } .tm a:hover { color: var(--neon-hot); }
  .c { text-align: right; color: var(--muted); } .pl { color: var(--chalk); font-weight: 700; } .pl.pos { color: #0C8C4A; } .pl.neg { color: var(--stamp-red); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); } .empty a { color: #0C8C4A; }
  .mybets { display: flex; flex-direction: column; gap: 10px; }
  .bet { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 11px 14px; }
  .bhd { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .kind { font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .08em; color: #0C8C4A; border: 1px solid rgba(18,255,110,.4); border-radius: 3px; padding: 1px 6px; }
  .wk { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); }
  .stat { margin-left: auto; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .06em; } .stat.good { color: #0C8C4A; } .stat.bad { color: var(--stamp-red); } .stat.muted { color: var(--muted); }
  .leg { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--chalk); padding: 2px 0; } .leg .lo { color: #0C8C4A; }
  .bft { display: flex; justify-content: space-between; margin-top: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); } .bft b { color: var(--chalk); }

  .commish { background: linear-gradient(180deg,#12100a,#0d0f08); border: 1px solid rgba(224,166,66,.35); border-radius: 12px; padding: 14px 16px; margin: 24px 0 8px; }
  .chd { font-family: 'Archivo Black', sans-serif; font-size: 14px; text-transform: uppercase; color: #B07818; margin-bottom: 10px; }
  .grade { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); }
  .grade label { color: var(--chalk); } .grade input { width: 56px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #FFFFFF; border: 1px solid var(--line); color: var(--chalk); border-radius: 6px; padding: 5px 7px; margin-left: 4px; }
  .grade button { background: #B07818; color: #241a05; border: none; border-radius: 7px; padding: 8px 14px; font-family: 'Archivo Black', sans-serif; font-size: 12px; text-transform: uppercase; cursor: pointer; } .grade button:disabled { opacity: .5; cursor: not-allowed; }
  .ghint { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); line-height: 1.6; margin: 8px 0 0; }
  .note { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #B07818; margin-top: 8px; }
  .opentbl { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .commish .orow { display: grid; grid-template-columns: 90px 1fr auto auto; align-items: center; gap: 10px; padding: 7px 8px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 8px; }
  .ow { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 12.5px; color: var(--chalk); }
  .odesc { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .owk { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); white-space: nowrap; }
  .oact { display: flex; gap: 4px; } .oact button { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--line); font-family: 'Archivo Black', sans-serif; font-size: 11px; cursor: pointer; background: #FFFFFF; }
  .oact .w { color: #0C8C4A; } .oact .l { color: var(--stamp-red); } .oact .v { color: var(--muted); }
  .oact button:hover { border-color: currentColor; } .oact button:disabled { opacity: .5; cursor: not-allowed; }
  .allsettled { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #0C8C4A; margin-top: 12px; }
  @media (max-width: 620px) { .commish .orow { grid-template-columns: 1fr auto; } .odesc, .owk { grid-column: 1 / -1; white-space: normal; } }
  /* Phones: the 6-col board clips P/L off the edge. Drop Bets + Staked, keep the numbers that matter. */
  @media (max-width: 560px) {
    .brow { grid-template-columns: 22px minmax(0, 1fr) 46px 74px; gap: 7px; font-size: 12px; }
    .brow > :nth-child(3), .brow > :nth-child(5) { display: none; }
    .tm a { font-size: 12.5px; }
  }
</style>
