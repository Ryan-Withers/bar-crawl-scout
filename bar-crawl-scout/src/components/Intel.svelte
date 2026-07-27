<script>
  import { link } from '../lib/router.js';
  import { PLAYERS, FIRSTROUND, TEAMS, TEAMSHORT, RYAN } from '../lib/data.js';
  import { isAvailable, windowVal, warchest, chestTag } from '../lib/models.js';
  import { keepers, mode } from '../lib/store.js';
  import PlayerChip from './PlayerChip.svelte';

  $: ks = $keepers;
  $: md = $mode;

  $: pool = PLAYERS.filter((p) => isAvailable(ks, p[1]));
  $: byval = pool.map((p) => ({ p, w: windowVal(p, ks, md) })).sort((a, b) => b.w - a.w).slice(0, 16);
  $: chest = TEAMS.filter((t) => t[0] !== RYAN).map((t) => ({ h: t[0], w: warchest(t[0]), tag: chestTag(t[0]) })).sort((a, b) => b.w - a.w);
  const pad = (i) => (i < 10 ? '0' + i : '' + i);
</script>

<section class="tab plan on">
  <div class="blurb">Rankings re-sort with your window mode (<b>{md}</b>). One file stays sealed — do not bother looking.</div>

  <div class="ipanels">
    <div class="ipanel">
      <h3 class="sec">2026 first round (real owners)</h3>
      {#each FIRSTROUND as f, i}
        <div class="pickrow">
          1.{pad(i + 1)}
          {#if f[0] === RYAN}
            <b>🔒 Classified</b>
          {:else}
            <b><a href={'/managers/' + f[0]} use:link class="mgrlink">{TEAMSHORT[f[0]]}</a></b>{#if f[1]}<span class="via">&nbsp;({f[1]})</span>{/if}
          {/if}
        </div>
      {/each}
    </div>

    <div class="ipanel">
      <h3 class="sec">War chest ranking</h3>
      {#each chest as c, i}
        <div class="pickrow">
          <b>{i + 1}.</b>
          <a href={'/managers/' + c.h} use:link class="mgrlink">{TEAMSHORT[c.h]}</a>
          <span class="chesttag ct-{c.tag}">{c.tag}</span>
          <span class="muted">score {c.w}</span>
        </div>
      {/each}
    </div>

    <div class="ipanel">
      <h3 class="sec">Best available now (WIN, {md})</h3>
      {#each byval as x, i}
        <div class="pickrow">
          <b>{i + 1}.</b>
          <PlayerChip name={x.p[1]} />
          <span class="via">{x.p[2]}</span> · win {x.w} · ADP {x.p[5]}
        </div>
      {/each}
    </div>

    <div class="ipanel">
      <h3 class="sec">How the room drafts</h3>
      <p class="room">
        <b>jduddy</b> clears the RB tier fast. <b>jpdonners and JohnnyDuff</b> lean on quarterbacks.
        <b>joshleota and Winz</b> are win-now contenders who spend on premium names.
        <b>Imy and Shayden</b> are loaded rebuilders sitting on the most capital.
        <b>ATorelli</b> is a balanced accumulator and a known bluffer on his stated keepers.
        Tap <b>Sync</b> in a browser to load each manager's real 2024 and 2025 draft mix. Full dossiers in the Managers tab.
      </p>
    </div>
  </div>
</section>

<style>
  /* Four intel boards side by side on a wide screen, stacked on a phone. */
  .ipanels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 8px 26px; align-items: start; }
  .ipanel { min-width: 0; }
  .ipanel .sec { margin-top: 4px; }
  .room { max-width: 70ch; line-height: 1.75; }
  .pickrow .mgrlink { color: var(--neon); text-decoration: none; }
  .pickrow .mgrlink:hover { color: var(--neon-hot); }
  .pickrow .via { color: var(--chalk); }
  .pickrow .muted { color: var(--muted); }
  .chesttag { font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 1px 6px; border-radius: 4px; }
  .ct-LOADED { background: rgba(201,164,92,.18); color: var(--brass); }
  .ct-SOLID { background: rgba(130,201,252,.16); color: var(--neon); }
  .ct-LIGHT { background: var(--field-3); color: var(--muted); }
  .ct-STRIPPED { background: rgba(214,69,60,.16); color: var(--stamp-red); }
</style>
