<script>
  import { onMount } from 'svelte';
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMS, TEAMSHORT, MGRS, PLAYERS, RYAN } from '../lib/data.js';
  import { pts26 } from '../lib/models.js';
  import { keepers, mode, rosters } from '../lib/store.js';
  import { rosterFor } from '../lib/roster.js';
  import { powerRankings } from '../lib/engine/power.ts';
  import { futuresOdds, decimalOdds, overUnder } from '../lib/engine/odds.ts';
  import { bettor, bets, betId, available, balance, weeklyRemaining, multisThisWeek, validateBet, codeFor, WEEKLY_CREDIT, WEEKLY_SPEND_CAP, MULTI_CAP, MULTIS_PER_WEEK, login, logout } from '../lib/bet.js';
  import { loadBets, verifyCode, placeBet, online } from '../lib/betsync.js';
  import { usersQuery, rostersQuery, stateQuery } from '../api/queries';
  import { userHandleMap, recordsFromRosters } from '../api/league';
  import SportsbookLogo from './SportsbookLogo.svelte';

  // Pull the shared ledger off the Worker on open so everyone's bets and caps are
  // in sync across devices (silent fall back to local if the Worker's not there).
  onMount(loadBets);

  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());
  const stateQ = createQuery(stateQuery());
  $: week = ($stateQ.data?.week ?? 0) || 1;
  $: ks = $keepers; $: md = $mode;

  // ---- identity ----
  let codeInput = '';
  let loginErr = false;
  let busy = false;
  async function doLogin() {
    busy = true; loginErr = false;
    const h = await verifyCode(codeInput); // handle | null (bad code) | undefined (Worker offline)
    busy = false;
    if (h) { bettor.set(h); codeInput = ''; return; }
    if (h === undefined && login(codeInput)) { codeInput = ''; return; } // offline: trust the local code map
    loginErr = true;
  }
  $: me = $bettor;
  $: meName = me ? (TEAMS.find((t) => t[0] === me) || [me, me])[1].replace(' (YOU)', '') : '';

  // ---- team strength -> futures ----
  const mgrByHandle = Object.fromEntries(MGRS.map((m) => [m.h, m]));
  const parseRec = (s) => { const [w, l, t] = String(s || '0-0-0').split('-').map((n) => +n || 0); return { w, l, t: t || 0 }; };
  const parsePF = (s) => +String(s || '0').replace(/[^0-9.]/g, '') || 0;
  $: liveRecords = ($rostersQ.data && $usersQ.data) ? recordsFromRosters($rostersQ.data, userHandleMap($usersQ.data)) : {};
  $: powerInputs = buildPower($rosters, liveRecords, ks, md);
  function buildPower(rd, records, ks, md) {
    return TEAMS.map(([h, team]) => {
      const rec = records[h]; const wl = rec ? { w: rec.wins, l: rec.losses, t: rec.ties } : parseRec(mgrByHandle[h] && mgrByHandle[h].rec);
      const g = wl.w + wl.l + wl.t; const r = rosterFor(rd, h, ks, md);
      return { handle: h, team, winPct: g ? (wl.w + wl.t / 2) / g : 0, pf: rec ? rec.pf : parsePF(mgrByHandle[h] && mgrByHandle[h].pf), rosterVal: r ? r.reduce((s, p) => s + (p.proj || 0), 0) : 0 };
    });
  }
  $: power = powerRankings(powerInputs);
  $: champ = futuresOdds(power.map((p) => ({ handle: p.handle, score: p.score })), 0.06, 0.38);
  // Make-finals: logistic on power score vs the 6th-best (cut line).
  $: cutScore = [...power].sort((a, b) => b.score - a.score)[5]?.score ?? 50;
  $: finals = power.map((p) => { const prob = 1 / (1 + Math.exp(-(p.score - cutScore) / 12)); return { handle: p.handle, odds: decimalOdds(prob, 0.22) }; });
  $: champByHandle = Object.fromEntries(champ.map((c) => [c.handle, c.odds]));
  $: finalsByHandle = Object.fromEntries(finals.map((f) => [f.handle, f.odds]));

  // ---- player props (weekly O/U). Weekly proxy = season pts / 17; live proj slots in later. ----
  $: props = PLAYERS
    .filter((p) => ['RB', 'WR', 'TE', 'QB'].includes(p[2]))
    .map((p) => ({ name: p[1], pos: p[2], team: p[3], line: overUnder(pts26(p) / 17).line }))
    .sort((a, b) => b.line - a.line)
    .slice(0, 24);
  const PROP_ODDS = 1.9;

  // ---- bet slip ----
  let slip = [];            // [{ key, market, sel, line, odds, label }]
  let mode2 = 'single';     // 'single' | 'multi'
  let stakes = {};          // key -> stake (singles)
  let multiStake = 5;

  function add(sel) {
    if (slip.some((s) => s.key === sel.key)) { slip = slip.filter((s) => s.key !== sel.key); return; }
    slip = [...slip, sel];
    if (stakes[sel.key] == null) stakes = { ...stakes, [sel.key]: 5 };
  }
  const inSlip = (key) => slip.some((s) => s.key === key);
  function clearSlip() { slip = []; }

  $: multiOdds = slip.length ? Math.round(slip.reduce((p, s) => p * s.odds, 1) * 100) / 100 : 0;
  $: bal = balance($bets, me, week);
  $: wkRem = weeklyRemaining($bets, me, week);
  $: avail = available($bets, me, week);
  $: multisUsed = multisThisWeek($bets, me, week);

  // Route every placement through the Worker — it re-checks the code and the
  // weekly cap against everyone's stored bets (the thing that stops a second
  // device double-betting). If the Worker's unreachable we validate locally with
  // the SAME rules and append to the local store so the tool still works offline.
  let placeErr = '';
  async function submit(bet) {
    try {
      const res = await placeBet(codeFor(me), bet);
      if (!res.ok) { placeErr = res.reason || 'bet rejected'; return false; }
      return true;
    } catch {
      const check = validateBet($bets, me, week, bet);
      if (!check.ok) { placeErr = check.reason; return false; }
      bets.update((b) => [bet, ...b]);
      return true;
    }
  }
  async function placeSingles() {
    if (!me) return;
    placeErr = '';
    const toPlace = slip.filter((s) => (stakes[s.key] || 0) > 0);
    let bank = avail, placed = 0;
    for (const s of toPlace) {
      const stake = Math.min(stakes[s.key], bank);
      if (stake < 1) continue;
      const bet = { id: betId(week), handle: me, week, kind: 'single', legs: [s], stake: Math.round(stake * 100) / 100, odds: s.odds, status: 'open', placed: Date.now() };
      if (!(await submit(bet))) break;
      bank -= stake; placed += 1;
    }
    if (placed) clearSlip();
  }
  async function placeMulti() {
    if (!me || slip.length < 2) return;
    placeErr = '';
    if (multisUsed >= MULTIS_PER_WEEK) return;
    const stake = Math.min(multiStake, MULTI_CAP, avail);
    if (stake < 1) return;
    const bet = { id: betId(week), handle: me, week, kind: 'multi', legs: slip.slice(), stake: Math.round(stake * 100) / 100, odds: multiOdds, status: 'open', placed: Date.now() };
    if (await submit(bet)) clearSlip();
  }

  const fmt = (n) => '$' + (Math.round(n * 100) / 100).toFixed(2);
</script>

<section class="book">
  <!-- Sponsor bar -->
  <div class="sponsor">
    <SportsbookLogo size={26} />
    <span class="tag">Official Sportsbook of the Bar Crawl Order</span>
  </div>

  {#if !me}
    <div class="gate">
      <div class="ghd">🔒 Enter your bettor code</div>
      <p>Everyone's got a private code so nobody drops a bet in your name. Ask the commissioner for yours.</p>
      <form on:submit|preventDefault={doLogin}>
        <input placeholder="YOUR CODE" bind:value={codeInput} class:err={loginErr} spellcheck="false" autocomplete="off" disabled={busy} />
        <button type="submit" disabled={busy}>{busy ? '…' : 'Log in'}</button>
      </form>
      {#if loginErr}<div class="gerr">That code didn't match. Try again.</div>{/if}
    </div>
  {:else}
    <div class="bankbar">
      <div class="who">Betting as <b>{meName}</b>
        {#if $online === true}<span class="synced" title="Bets settle on the shared book — capped across all your devices">● shared book</span>
        {:else if $online === false}<span class="localonly" title="Worker unreachable — bets are saved on this device only">● this device only</span>{/if}
        <button class="out" on:click={logout}>switch</button></div>
      <div class="bank"><span class="lbl">Balance</span><b class="amt">{fmt(bal)}</b><span class="of">· {fmt(wkRem)} of {fmt(WEEKLY_SPEND_CAP)} left to stake this week</span></div>
    </div>

    <div class="cols">
      <div class="markets">
        <!-- FUTURES -->
        <div class="market">
          <div class="mhd">🏆 Season Futures <span class="sub">to win it all · to make finals</span></div>
          {#each power as p}
            {@const cKey = 'champ:' + p.handle}
            {@const fKey = 'finals:' + p.handle}
            <div class="orow">
              <span class="nm"><a href={'/managers/' + p.handle} use:link>{TEAMSHORT[p.handle] || p.team}</a></span>
              <button class="odd" class:on={inSlip(cKey)} on:click={() => add({ key: cKey, market: 'Championship', sel: TEAMSHORT[p.handle], odds: champByHandle[p.handle], label: `${TEAMSHORT[p.handle]} to win the chip`, pick: { kind: 'champ', handle: p.handle } })}>
                <em>CHIP</em>{champByHandle[p.handle].toFixed(2)}</button>
              <button class="odd" class:on={inSlip(fKey)} on:click={() => add({ key: fKey, market: 'Make Finals', sel: TEAMSHORT[p.handle], odds: finalsByHandle[p.handle], label: `${TEAMSHORT[p.handle]} to make finals`, pick: { kind: 'finals', handle: p.handle } })}>
                <em>FINALS</em>{finalsByHandle[p.handle].toFixed(2)}</button>
            </div>
          {/each}
        </div>

        <!-- PLAYER PROPS -->
        <div class="market">
          <div class="mhd">🎯 Player Props <span class="sub">weekly points · over / under</span></div>
          {#each props as pr}
            {@const oKey = 'o:' + pr.name}{@const uKey = 'u:' + pr.name}
            <div class="orow prop">
              <span class="nm"><a href={'/player/' + encodeURIComponent(pr.name)} use:link>{pr.name}</a><small>{pr.pos} · {pr.team}</small></span>
              <button class="odd" class:on={inSlip(oKey)} on:click={() => add({ key: oKey, market: 'Player O/U', sel: `${pr.name} OVER ${pr.line}`, odds: PROP_ODDS, label: `${pr.name} OVER ${pr.line}`, pick: { kind: 'prop', player: pr.name, side: 'over', line: pr.line } })}><em>O {pr.line}</em>{PROP_ODDS.toFixed(2)}</button>
              <button class="odd" class:on={inSlip(uKey)} on:click={() => add({ key: uKey, market: 'Player O/U', sel: `${pr.name} UNDER ${pr.line}`, odds: PROP_ODDS, label: `${pr.name} UNDER ${pr.line}`, pick: { kind: 'prop', player: pr.name, side: 'under', line: pr.line } })}><em>U {pr.line}</em>{PROP_ODDS.toFixed(2)}</button>
            </div>
          {/each}
        </div>
      </div>

      <!-- BET SLIP -->
      <div class="slip">
        <div class="shd">Bet Slip <span class="cnt">{slip.length}</span></div>
        {#if !slip.length}
          <div class="empty">Tap odds to build your slip. Singles or a multi (max {fmt(MULTI_CAP)}, {MULTIS_PER_WEEK}/week).</div>
        {:else}
          <div class="segs"><button class:on={mode2 === 'single'} on:click={() => (mode2 = 'single')}>Singles</button><button class:on={mode2 === 'multi'} on:click={() => (mode2 = 'multi')} disabled={slip.length < 2}>Multi ×{slip.length}</button></div>
          {#each slip as s (s.key)}
            <div class="leg">
              <div class="lg"><span class="lgl">{s.label}</span><button class="x" on:click={() => add(s)} aria-label="remove">×</button></div>
              <div class="lgb"><span class="mk">{s.market}</span><span class="od">{s.odds.toFixed(2)}</span>
                {#if mode2 === 'single'}<input type="number" min="1" max={avail} bind:value={stakes[s.key]} />{/if}</div>
            </div>
          {/each}
          {#if mode2 === 'single'}
            <button class="place" on:click={placeSingles} disabled={avail < 1}>Place {slip.length} single{slip.length > 1 ? 's' : ''}</button>
          {:else}
            <div class="multibox">
              <div class="mrow"><span>Multi odds</span><b class="mo">{multiOdds.toFixed(2)}</b></div>
              <div class="mrow"><span>Stake (max {fmt(MULTI_CAP)})</span><input type="number" min="1" max={Math.min(MULTI_CAP, avail)} bind:value={multiStake} /></div>
              <div class="mrow ret"><span>To return</span><b>{fmt(Math.min(multiStake, MULTI_CAP, avail) * multiOdds)}</b></div>
              {#if multisUsed >= MULTIS_PER_WEEK}<div class="warn">You've used your multi this week.</div>{/if}
              <button class="place" on:click={placeMulti} disabled={multisUsed >= MULTIS_PER_WEEK || avail < 1}>Place multi</button>
            </div>
          {/if}
          {#if placeErr}<div class="perr">⚠ {placeErr}</div>{/if}
          <button class="clear" on:click={clearSlip}>Clear slip</button>
        {/if}
        <a class="tolead" href="/leaderboard" use:link>Ledger &amp; leaderboard →</a>
      </div>
    </div>
    <p class="fineprint">DINGERKINGS is a parody in-house book — no real money. {fmt(WEEKLY_CREDIT)} of pretend cash lands in your account each week (it rolls over), and you can stake up to {fmt(WEEKLY_SPEND_CAP)} of it in any one week, including a single {fmt(MULTI_CAP)} multi. The house holds an edge on every price. Gamble responsibly (with your imaginary dollars). Shared season-long settlement runs off the sync Worker.</p>
  {/if}
</section>

<style>
  .book { padding-top: 2px; }
  .sponsor { display: flex; align-items: center; gap: 12px; background: linear-gradient(90deg, #0a1410, #0d1a12); border: 1px solid rgba(18,255,110,.25); border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; }
  .sponsor .tag { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #8FE8B8; }

  .gate { max-width: 440px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 20px; }
  .ghd { font-family: 'Archivo Black', sans-serif; font-size: 16px; color: var(--chalk); margin-bottom: 6px; }
  .gate p { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); line-height: 1.6; margin: 0 0 12px; }
  .gate form { display: flex; gap: 8px; }
  .gate input { flex: 1; font-family: 'IBM Plex Mono', monospace; font-size: 14px; background: #FFFFFF; border: 1px solid var(--line); color: var(--chalk); border-radius: 8px; padding: 10px 12px; text-transform: uppercase; }
  .gate input.err { border-color: var(--stamp-red); }
  .gate button, .place { background: #0C8C4A; color: #FFFFFF; border: none; border-radius: 8px; padding: 10px 16px; font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; cursor: pointer; }
  .gerr { color: var(--stamp-red); font-family: 'IBM Plex Mono', monospace; font-size: 11px; margin-top: 8px; }

  .bankbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; flex-wrap: wrap; }
  .who { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); } .who b { color: var(--chalk); }
  .who .out { background: none; border: 1px solid var(--line); color: var(--muted); border-radius: 6px; font-size: 9px; padding: 3px 7px; margin-left: 6px; cursor: pointer; text-transform: uppercase; }
  .who .synced, .who .localonly { font-size: 9px; letter-spacing: .04em; text-transform: uppercase; margin-left: 8px; }
  .who .synced { color: #0C8C4A; } .who .localonly { color: #B07818; }
  .perr { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--stamp-red); margin-top: 8px; line-height: 1.5; }
  .bank { display: flex; align-items: baseline; gap: 6px; }
  .bank .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .bank .amt { font-family: 'Archivo Black', sans-serif; font-size: 22px; color: #0C8C4A; } .bank .of { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); }

  .cols { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
  /* The extra width buys a second market board, not a stretched one. */
  .markets { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr)); gap: 14px; align-items: start; min-width: 0; }
  .market { min-width: 0; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .mhd { font-family: 'Archivo Black', sans-serif; font-size: 14px; text-transform: uppercase; color: var(--chalk); margin-bottom: 10px; display: flex; align-items: baseline; gap: 8px; }
  .mhd .sub { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--muted); }
  .orow { display: grid; grid-template-columns: 1fr 96px 96px; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--line); }
  .orow .nm { min-width: 0; } .orow .nm a { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 13.5px; color: var(--chalk); text-decoration: none; }
  .orow .nm a:hover { color: var(--neon-hot); } .orow .nm small { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: var(--muted); }
  .odd { display: flex; flex-direction: column; align-items: center; gap: 1px; background: #FFFFFF; border: 1px solid var(--line); border-radius: 8px; padding: 6px 4px; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 700; color: #0C8C4A; }
  .odd em { font-size: 8px; font-style: normal; letter-spacing: .06em; color: var(--muted); }
  .odd:hover { border-color: rgba(18,255,110,.5); }
  .odd.on { background: #0C8C4A; color: #FFFFFF; border-color: #0C8C4A; } .odd.on em { color: #FFFFFF; }

  .slip { background: var(--barroom-lift); border: 1px solid rgba(18,255,110,.25); border-radius: 12px; padding: 12px 14px; position: sticky; top: 160px; }
  .shd { font-family: 'Archivo Black', sans-serif; font-size: 14px; text-transform: uppercase; color: var(--chalk); margin-bottom: 8px; }
  .shd .cnt { background: #0C8C4A; color: #FFFFFF; border-radius: 10px; padding: 1px 8px; font-size: 11px; }
  .slip .empty { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); line-height: 1.6; }
  .segs { display: flex; gap: 6px; margin-bottom: 8px; } .segs button { flex: 1; font-family: 'IBM Plex Mono', monospace; font-size: 11px; background: #FFFFFF; border: 1px solid var(--line); color: var(--muted); border-radius: 7px; padding: 6px; cursor: pointer; } .segs button.on { background: rgba(18,255,110,.15); color: #0C8C4A; border-color: rgba(18,255,110,.5); }
  .leg { border-bottom: 1px dashed var(--line); padding: 7px 0; }
  .lg { display: flex; justify-content: space-between; gap: 8px; } .lgl { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--chalk); }
  .x { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; } .x:hover { color: var(--stamp-red); }
  .lgb { display: flex; align-items: center; gap: 8px; margin-top: 4px; } .mk { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: var(--muted); flex: 1; } .od { font-family: 'IBM Plex Mono', monospace; font-weight: 700; color: #0C8C4A; }
  .lgb input, .multibox input { width: 62px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #FFFFFF; border: 1px solid var(--line); color: var(--chalk); border-radius: 6px; padding: 5px 7px; }
  .place { width: 100%; margin-top: 10px; } .place:disabled { opacity: .4; cursor: not-allowed; }
  .multibox { margin-top: 8px; } .mrow { display: flex; justify-content: space-between; align-items: center; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); padding: 4px 0; } .mrow .mo { font-family: 'Archivo Black', sans-serif; font-size: 18px; color: #0C8C4A; } .mrow.ret b { color: var(--chalk); }
  .warn { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--stamp-red); padding: 4px 0; }
  .clear { width: 100%; margin-top: 6px; background: none; border: 1px solid var(--line); color: var(--muted); border-radius: 7px; padding: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; cursor: pointer; }
  .tolead { display: block; margin-top: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #0C8C4A; text-decoration: none; }
  .fineprint { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: var(--ink-soft); line-height: 1.6; margin-top: 16px; max-width: 90ch; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } .slip { position: static; } }
</style>
