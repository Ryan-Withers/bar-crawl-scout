<script>
  import { PLAYERS, FIRSTROUND, TEAMS, TEAMSHORT, RYAN } from '../lib/data.js';
  import { isAvailable, windowVal, warchest, chestTag } from '../lib/models.js';
  import { esc } from '../lib/util.js';
  import { keepers, mode } from '../lib/store.js';

  $: ks = $keepers;
  $: md = $mode;

  function build(ks, md) {
    const pool = PLAYERS.filter((p) => isAvailable(ks, p[1]));
    const byval = pool.map((p) => ({ p, w: windowVal(p, ks, md) })).sort((a, b) => b.w - a.w).slice(0, 16);
    const chest = TEAMS.filter((t) => t[0] !== RYAN).map((t) => ({ h: t[0], w: warchest(t[0]), tag: chestTag(t[0]) })).sort((a, b) => b.w - a.w);
    let h = '<div class="note">League intel: who owns the early picks, who is loaded, the best players left in the pool, and how each manager drafts. Re-sorts with window mode (<b>' + md + '</b>). One file stays sealed, do not bother looking.</div>';
    h += '<h3 class="sec">2026 first round (real owners)</h3>';
    h += FIRSTROUND.map((f, i) => '<div class="pickrow">1.' + (i + 1 < 10 ? '0' + (i + 1) : '10') + ' <b>' + (f[0] === RYAN ? '&#128274; Classified' : esc(TEAMSHORT[f[0]])) + '</b>' + (f[1] && f[0] !== RYAN ? ' <span style="color:var(--chalk)">(' + f[1] + ')</span>' : '') + '</div>').join('');
    h += '<h3 class="sec">War chest ranking</h3>';
    h += chest.map((c, i) => '<div class="pickrow"><b>' + (i + 1) + '.</b> ' + esc(TEAMSHORT[c.h]) + ' <span class="chesttag ct-' + c.tag + '">' + c.tag + '</span> <span style="color:var(--muted)">score ' + c.w + '</span></div>').join('');
    h += '<h3 class="sec">Best available now (WIN, ' + md + ')</h3>';
    h += byval.map((x, i) => '<div class="pickrow"><b>' + (i + 1) + '.</b> ' + esc(x.p[1]) + ' <span style="color:var(--chalk)">' + x.p[2] + '</span> · win ' + x.w + ' · ADP ' + x.p[5] + '</div>').join('');
    h += '<h3 class="sec">How the room drafts</h3><p class="plan"><b>jduddy</b> clears the RB tier fast. <b>jpdonners and JohnnyDuff</b> lean on quarterbacks. <b>joshleota and Winz</b> are win-now contenders who spend on premium names. <b>Imy and Shayden</b> are loaded rebuilders sitting on the most capital. <b>ATorelli</b> is a balanced accumulator and a known bluffer on his stated keepers. Tap <b>Sync</b> in a browser to load each manager\'s real 2024 and 2025 draft mix. Full dossiers in the Managers tab.</p>';
    return h;
  }

  $: html = build(ks, md);
</script>

<section class="tab plan on">{@html html}</section>
