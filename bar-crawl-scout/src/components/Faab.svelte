<script>
  import { TEAMS, TEAMSHORT, BYUNAME, LEAN, REBUILD, CONTEND } from '../lib/data.js';
  import { needScores, aggrOf, faabTalent, makeOdd, isRyanPlayer } from '../lib/models.js';
  import { keepers, faab, draft, unlocked } from '../lib/store.js';
  import PlayerChip from './PlayerChip.svelte';
  import Stamp from './Stamp.svelte';

  $: ks = $keepers;
  $: faabSynced = $faab ? $faab.byManager : null;
  $: faabWeeks = $faab ? ($faab.weeks || 0) : 0;
  $: draftedBy = $draft && $draft.draftedBy ? $draft.draftedBy : {};

  let fnm = '';
  let result = null;
  const draftedByName = (nm) => draftedBy[nm] || [];

  // Threat level -> [label, colour]. Same thresholds as before, now as data.
  const lvl = (s) => s >= 5.5 ? ['SEVERE', '#e0613f'] : s >= 4 ? ['HIGH', '#f4b23e'] : s >= 2.5 ? ['MED', '#5aa0e0'] : ['LOW', '#4fb286'];

  function read() {
    const raw = fnm.trim();
    if (!raw) return;
    const p = BYUNAME[raw.toLowerCase()];
    const pos = p ? p[2] : 'RB';
    const stage = p ? (p[6] || 'prime') : 'prime';
    const nm = p ? p[1] : raw;

    if (isRyanPlayer(ks, nm) && !$unlocked) { result = { blocked: true }; return; }

    const list = TEAMS.map((t) => t[0]).filter((h) => h !== 'Ryan').map((h) => {
      const need = (needScores(ks, h)[pos] || 0) / 10 * 2.5;
      const lean = ((LEAN[h] || {})[pos] || 0);
      const stageFit = REBUILD.has(h)
        ? (['rookie', 'yr2', 'asc'].indexOf(stage) >= 0 ? 1 : (['aging', 'fading'].indexOf(stage) >= 0 ? -1.5 : 0))
        : (CONTEND.has(h) ? (['prime', 'aging', 'asc'].indexOf(stage) >= 0 ? 1 : 0) : 0);
      const drafted = draftedByName(nm).some((e) => e[0] === h) ? 1.5 : 0;
      return { h, s: aggrOf(h, faabSynced) + need + lean + stageFit + drafted, drafted: drafted > 0 };
    }).sort((a, b) => b.s - a.s);

    const threats = list.map((x) => {
      const [label, color] = lvl(x.s);
      return { short: TEAMSHORT[x.h], drafted: x.drafted, label, color, width: Math.max(6, Math.min(100, x.s / 8 * 100)) };
    });

    const tal = faabTalent(p);
    const demand = list[0] ? list[0].s : 0;
    const contested = demand >= 4.5 || list.filter((x) => x.s >= 4).length >= 2;
    let lo = makeOdd(tal * 0.55);
    let hi = makeOdd(tal * (contested ? 0.98 : 0.78));
    if (hi > 99) hi = 99;
    if (lo > hi) lo = hi;

    const tg = tal >= 85 ? ['LEAGUE-WINNER', 'pay up, this is a roster-changer']
      : tal >= 62 ? ['STRONG STARTER', 'a real add, bid like it']
      : tal >= 42 ? ['USEFUL PIECE', 'moderate bid, do not overspend']
      : ['DEPTH', 'keep it cheap, save budget for later'];

    const fans = draftedByName(nm).map((e) => TEAMSHORT[e[0]] + ' (' + e[1] + ')');
    const top2 = list.slice(0, 2).map((x) => TEAMSHORT[x.h]).join(' and ');
    const agg = faabSynced
      ? { synced: true, weeks: faabWeeks, top: list.slice(0, 3).map((x) => ({ short: TEAMSHORT[x.h], median: (faabSynced[x.h] && faabSynced[x.h].median) || 0, max: faabSynced[x.h] ? faabSynced[x.h].max : null })) }
      : { synced: false };

    result = {
      nm, pos, stage, inBoard: !!p,
      tier: tg[0], advice: tg[1], tal,
      lo, hi, contested, top2, fans, threats, agg,
    };
  }
</script>

<section class="tab on">
  <div class="box">
    <div class="ask">
      <div class="blurb" style="margin-bottom:10px">Type a player — you get the threat order (need + tendency + has drafted him before) and a bid range. Sync more weeks for real spend medians.</div>
      <input class="search" list="plist" style="width:100%" placeholder="e.g. Kenneth Walker III" spellcheck="false" bind:value={fnm} on:keydown={(e) => e.key === 'Enter' && read()} />
      <button class="go" on:click={read}>Read the room</button>
    </div>

    {#if result}
      {#if result.blocked}
        <div class="out"><div class="big bd">Access denied</div>Cannot use Ryan's players for analysis. 🔒 That one is on the commissioner's roster. He is not putting him on waivers, so stop dreaming.</div>
      {:else}
        <div class="out">
          <div class="rhead">
            <PlayerChip name={result.nm} /> · {result.pos} · {result.stage}
          </div>
          <div class="cols">
          <div class="col">
          <p class="lead">
            <b>{result.tier}</b> ({result.tal}/100 talent). Suggested bid:
            <span class="wk">${result.lo} to ${result.hi}</span> of $100, {result.advice}.
          </p>

          {#if !result.inBoard}
            <p class="blurb"><span class="bd">Note:</span> {result.nm} is not in the top-200 value board, so the talent number is a rough default. Trust the competition and need read below more than the bid here, and treat it as a depth add.</p>
          {/if}

          <p class="lead">
            {#if result.contested}Contested: {result.top2} also want him, so bid near the top (${result.hi}) to be safe.
            {:else}Lightly contested, the low end likely wins.{/if}
          </p>

          {#if result.fans.length}
            <p class="lead"><b>Has drafted him before:</b> {result.fans.join(', ')}.</p>
          {/if}

          <p class="blurb foot">
            Bid is driven by player value first (a league-winner commands 80 to 100%, a useful starter 35 to 55%, depth 5 to 15%), then nudged by competition and need. Odd numbers win the dollar tiebreak.
            {#if result.agg.synced}
              Synced spending over {result.agg.weeks} weeks: {#each result.agg.top as a, i}{a.short} median ${a.median}{#if a.max != null}, max ${a.max}{/if}{i < result.agg.top.length - 1 ? '; ' : '.'}{/each}
            {:else}
              Aggression from a week-1 sample. Tap Sync in a browser for real medians.
            {/if}
          </p>
          </div>

          <div class="col">
            <div class="threats-hd">Threat order <span class="star">★ = drafted him before</span></div>
            <div class="threats">
              {#each result.threats as t}
                <div class="threat">
                  <span class="tname">{t.short}{#if t.drafted}<span class="star">★</span>{/if}</span>
                  <span class="tmeter"><i style="width:{t.width}%;background:{t.color}"></i></span>
                  <span class="tlbl" style="color:{t.color}">{t.label}</span>
                </div>
              {/each}
            </div>
          </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</section>

<style>
  .ask { max-width: 640px; }
  /* Wide screens read the bid and the threat board side by side. */
  .cols { display: grid; grid-template-columns: 1fr; gap: 6px 30px; align-items: start; }
  .col { min-width: 0; }
  @media (min-width: 900px) { .cols { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); } .threats-hd { margin-top: 0; } }
  .rhead { font-family: 'Archivo Black', sans-serif; font-size: 17px; text-transform: uppercase; color: var(--chalk); margin-bottom: 8px; }
  .lead { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; line-height: 1.6; color: var(--chalk); margin: 6px 0; max-width: 76ch; }
  .col :global(.blurb) { max-width: 76ch; }
  .lead .wk { color: var(--neon); font-weight: 700; }
  .lead b { color: var(--neon-hot); }
  .threats-hd { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--chalk); margin: 14px 0 8px; }
  .threats-hd .star, .star { color: var(--accent); }
  .threats { display: flex; flex-direction: column; gap: 6px; }
  .threat { display: flex; align-items: center; gap: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; }
  .tname { min-width: 170px; color: var(--chalk); }
  .tname .star { margin-left: 4px; }
  .tmeter { flex: 1; height: 7px; background: rgba(255,255,255,.07); border-radius: 4px; overflow: hidden; }
  .tmeter i { display: block; height: 100%; border-radius: 4px; }
  .tlbl { font-weight: 700; min-width: 54px; text-align: right; }
  .foot { margin-top: 12px; color: var(--muted); }
  @media (max-width: 480px) { .tname { min-width: 96px; } }
</style>
