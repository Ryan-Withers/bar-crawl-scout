<script>
  import { link } from '../lib/router.js';
  import { BYUNAME } from '../lib/data.js';
  import { r26, r27, pts26, pts27, windowVal } from '../lib/models.js';
  import { keepers, mode } from '../lib/store.js';
  import Stamp from './Stamp.svelte';

  export let params = {};
  $: a = params.a ? decodeURIComponent(params.a) : '';
  $: b = params.b ? decodeURIComponent(params.b) : '';
  $: pa = BYUNAME[a.toLowerCase()];
  $: pb = BYUNAME[b.toLowerCase()];
  $: ks = $keepers;
  $: md = $mode;

  const STATS = [
    { k: 'WIN', get: (p) => windowVal(p, ks, md), better: 'high' },
    { k: 'R26', get: (p) => r26(p), better: 'high' },
    { k: 'R27', get: (p) => r27(p, ks), better: 'high' },
    { k: 'P26', get: (p) => pts26(p), better: 'high' },
    { k: 'P27', get: (p) => pts27(p, ks), better: 'high' },
    { k: 'ADP', get: (p) => p[5], better: 'low' },
  ];

  $: rows = (pa && pb) ? STATS.map((s) => {
    const va = s.get(pa), vb = s.get(pb);
    const aWins = s.better === 'high' ? va > vb : va < vb;
    const tie = va === vb;
    const tot = (va + vb) || 1;
    const aShare = s.better === 'high' ? va / tot : vb / tot;
    return { k: s.k, va, vb, aWins, tie, aShare };
  }) : [];

  $: winA = pa ? windowVal(pa, ks, md) : 0;
  $: winB = pb ? windowVal(pb, ks, md) : 0;
  $: aWinsOverall = winA >= winB;
  $: margin = Math.abs(winA - winB);
</script>

<section class="tape">
  <a class="back" href="/board" use:link>← The Big Board</a>

  {#if !pa || !pb}
    <div class="miss">Need two players in the top-200 board to compare. Try <code>#/compare/Ashton Jeanty/Bijan Robinson</code>.</div>
  {:else}
    <div class="poster">
      <div class="eyebrow">Tale of the Tape · window: {md}</div>
      <div class="fighters">
        <div class="fighter left"><div class="fn">{a}</div><div class="fp">{pa[2]} · {pa[3]}</div><div class="fwin" class:win={aWinsOverall}>{winA}</div></div>
        <div class="vs">VS</div>
        <div class="fighter right"><div class="fn">{b}</div><div class="fp">{pb[2]} · {pb[3]}</div><div class="fwin" class:win={!aWinsOverall}>{winB}</div></div>
      </div>

      <div class="rows">
        {#each rows as r}
          <div class="tug">
            <span class="val" class:win={r.aWins && !r.tie}>{r.va}</span>
            <div class="mid">
              <div class="bar">
                <div class="fa" class:win={r.aWins && !r.tie} style="width:{r.aShare * 100}%"></div>
                <div class="fb" class:win={!r.aWins && !r.tie} style="width:{(1 - r.aShare) * 100}%"></div>
              </div>
              <div class="lbl">{r.k}</div>
            </div>
            <span class="val" class:win={!r.aWins && !r.tie}>{r.vb}</span>
          </div>
        {/each}
      </div>

      <div class="verdict">
        <Stamp text={margin <= 8 ? 'TOO CLOSE TO CALL' : `${aWinsOverall ? a : b} BY ${margin}`} tone={margin <= 8 ? 'ink' : 'neon'} big seed={margin} />
      </div>
    </div>
  {/if}
</section>

<style>
  .tape { padding-top: 2px; }
  .back { display: inline-flex; align-items: center; min-height: 44px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--neon); text-decoration: none; margin-bottom: 4px; }
  .miss { font-family: 'IBM Plex Mono', monospace; color: var(--muted); padding: 30px 0; }
  .miss code { color: var(--neon); }
  .poster { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 22px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-align: center; }
  .fighters { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; margin: 16px 0 22px; }
  .fighter { text-align: center; }
  .fighter .fn { font-family: 'Archivo Black', sans-serif; font-size: clamp(18px, 3vw, 28px); text-transform: uppercase; line-height: 1; color: var(--chalk); }
  .fighter .fp { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); margin: 4px 0 8px; }
  .fighter .fwin { font-family: 'Archivo Black', sans-serif; font-size: 40px; color: var(--muted); }
  .fighter .fwin.win { color: var(--neon); text-shadow: 0 0 14px rgba(130, 201, 252, 0.5); }
  .vs { font-family: 'Archivo Black', sans-serif; font-size: 16px; color: var(--stamp-red); }

  /* Wide screens read the six stat tugs in columns instead of one tall stack. */
  .rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 12px 40px; }
  .tug { min-width: 0; display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 10px; }
  .tug .val { font-family: 'IBM Plex Mono', monospace; font-size: 14px; color: var(--muted); text-align: center; }
  .tug .val.win { color: var(--neon); font-weight: 700; }
  .mid { text-align: center; }
  .bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: #FFFFFF; }
  .fa, .fb { height: 100%; background: rgba(28,46,64,.12); transition: width 0.3s; }
  .fa { border-right: 1px solid var(--barroom); }
  .fa.win, .fb.win { background: var(--neon); }
  .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
  .verdict { display: flex; justify-content: center; margin-top: 22px; }
</style>
