<script>
  import { TEAMS, TEAMSHORT, BYUNAME, LEAN, REBUILD, CONTEND } from '../lib/data.js';
  import { needScores, aggrOf, faabTalent, makeOdd, isRyanPlayer } from '../lib/models.js';
  import { esc } from '../lib/util.js';
  import { keepers, faab, draft } from '../lib/store.js';

  $: ks = $keepers;
  $: faabSynced = $faab ? $faab.byManager : null;
  $: faabWeeks = $faab ? ($faab.weeks || 0) : 0;
  $: draftedBy = $draft && $draft.draftedBy ? $draft.draftedBy : {};

  let fnm = '';
  let fout = '';
  const draftedByName = (nm) => draftedBy[nm] || [];

  function read() {
    const raw = fnm.trim(); if (!raw) return;
    const p = BYUNAME[raw.toLowerCase()]; const pos = p ? p[2] : 'RB', stage = p ? (p[6] || 'prime') : 'prime', nm = p ? p[1] : raw;
    if (isRyanPlayer(ks, nm)) { fout = '<div class="out"><div class="big bd">Access denied</div>Cannot use Ryan\'s players for analysis. 🔒 That one is on the commissioner\'s roster. He is not putting him on waivers, so stop dreaming.</div>'; return; }
    const list = TEAMS.map((t) => t[0]).filter((h) => h !== 'Ryan').map((h) => {
      const need = (needScores(ks, h)[pos] || 0) / 10 * 2.5; const lean = ((LEAN[h] || {})[pos] || 0);
      const stageFit = REBUILD.has(h) ? (['rookie', 'yr2', 'asc'].indexOf(stage) >= 0 ? 1 : (['aging', 'fading'].indexOf(stage) >= 0 ? -1.5 : 0)) : (CONTEND.has(h) ? (['prime', 'aging', 'asc'].indexOf(stage) >= 0 ? 1 : 0) : 0);
      const drafted = draftedByName(nm).some((e) => e[0] === h) ? 1.5 : 0;
      return { h, s: aggrOf(h, faabSynced) + need + lean + stageFit + drafted, drafted: drafted > 0 };
    }).sort((a, b) => b.s - a.s);
    const lvl = (s) => s >= 5.5 ? ['SEVERE', '#e0613f'] : s >= 4 ? ['HIGH', '#f4b23e'] : s >= 2.5 ? ['MED', '#5aa0e0'] : ['LOW', '#4fb286'];
    const rows = list.map((x) => { const L = lvl(x.s), w = Math.max(6, Math.min(100, x.s / 8 * 100)); return '<div class="threat"><span style="min-width:170px">' + esc(TEAMSHORT[x.h]) + (x.drafted ? ' <span style="color:var(--accent)">★</span>' : '') + '</span><span class="tmeter"><i style="width:' + w + '%;background:' + L[1] + '"></i></span><span class="tlbl" style="color:' + L[1] + '">' + L[0] + '</span></div>'; }).join('');
    const tal = faabTalent(p);
    const demand = list[0] ? list[0].s : 0; const contested = demand >= 4.5 || list.filter((x) => x.s >= 4).length >= 2;
    let lo = makeOdd(tal * 0.55), hi = makeOdd(tal * (contested ? 0.98 : 0.78)); if (hi > 99) hi = 99; if (lo > hi) lo = hi;
    const tg = tal >= 85 ? ['LEAGUE-WINNER', 'pay up, this is a roster-changer'] : tal >= 62 ? ['STRONG STARTER', 'a real add, bid like it'] : tal >= 42 ? ['USEFUL PIECE', 'moderate bid, do not overspend'] : ['DEPTH', 'keep it cheap, save budget for later'];
    const fans = draftedByName(nm).map((e) => TEAMSHORT[e[0]] + ' (' + e[1] + ')');
    const unk = p ? '' : '<br><br><span class="bd">Note:</span> ' + esc(nm) + ' is not in the top-200 value board, so the talent number is a rough default. Trust the competition and need read below more than the bid here, and treat it as a depth add.';
    const top2 = list.slice(0, 2).map((x) => esc(TEAMSHORT[x.h])).join(' and ');
    const aggLine = faabSynced ? ('Synced spending over ' + faabWeeks + ' weeks: ' + list.slice(0, 3).map((x) => esc(TEAMSHORT[x.h]) + ' median $' + ((faabSynced[x.h] && faabSynced[x.h].median) || 0) + (faabSynced[x.h] ? ', max $' + faabSynced[x.h].max : '')).join('; ') + '.') : 'Aggression from a week-1 sample. Tap Sync in a browser for real medians.';
    fout = '<div class="out"><div class="big">' + esc(nm) + ' · ' + pos + ' · ' + stage + '</div><b>' + tg[0] + '</b> (' + tal + '/100 talent). Suggested bid: <span class="wk">$' + lo + ' to $' + hi + '</span> of $100, ' + tg[1] + '.' + unk + '<br>' + (contested ? 'Contested: ' + top2 + ' also want him, so bid near the top ($' + hi + ') to be safe.' : 'Lightly contested, the low end likely wins.') + (fans.length ? '<br><br><b>Has drafted him before:</b> ' + fans.join(', ') + '.' : '') + '<br><br>Threat order (★ = drafted him before):<div style="margin-top:9px">' + rows + '</div><div style="margin-top:9px;color:var(--muted)">Bid is driven by player value first (a league-winner commands 80 to 100%, a useful starter 35 to 55%, depth 5 to 15%), then nudged by competition and need. Odd numbers win the dollar tiebreak. ' + aggLine + '</div></div>';
  }
</script>

<section class="tab on">
  <div class="box"><h3>FAAB &amp; interest</h3>
    <div class="note" style="margin-bottom:10px">Type a player. You get who covets him (need + tendency + has drafted him before), a suggested bid range, and the threat order. Sync more weeks for real spend medians.</div>
    <input class="search" list="plist" style="width:100%" placeholder="e.g. Kenneth Walker III" spellcheck="false" bind:value={fnm} on:keydown={(e) => e.key === 'Enter' && read()} />
    <button class="go" on:click={read}>Read the room</button>
    {@html fout}
  </div>
</section>
