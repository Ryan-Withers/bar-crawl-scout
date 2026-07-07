<script>
  import { MGRS, TEAMS, CAPITAL, RYAN } from '../lib/data.js';
  import { yearsLeft, chestTag, needScores } from '../lib/models.js';
  import { esc } from '../lib/util.js';
  import { keepers, rosters, draft } from '../lib/store.js';

  $: ks = $keepers;
  $: RD = $rosters;
  $: DH = $draft;

  const nbar = (v) => { const col = v >= 7 ? '#9a3618' : v >= 4 ? '#b6791f' : '#2f7d57'; return '<span class="nbar"><i style="width:' + (v * 10) + '%;background:' + col + '"></i></span> ' + v; };

  function card(m, ks, RD, DH) {
    const tm = TEAMS.find((t) => t[0] === m.h), tName = tm ? tm[1] : m.h;
    if (m.h === RYAN) return '<div class="mgr"><div class="h"><div><div class="tm">' + esc(tName) + '</div><div class="wh">@' + esc(m.h) + '</div></div><div class="rec">' + m.rec + '<small>' + esc(m.pf) + '</small></div></div><div class="mtags"><span class="mtag">&#128274; Redacted</span><span class="mtag">Commissioner</span></div><div class="mrow tend"><b>Dossier:</b> CLASSIFIED. This file was redacted by the commissioner. All we can confirm: he went ' + m.rec + ', he absolutely did not leave 200-plus points on his bench, and he is definitely not reading your trade offers right now.</div><div class="mrow"><b>Current roster:</b> <span class="pmeta">CLASSIFIED here (it is public on Sleeper if you really must look)</span></div><div class="mrow"><b>Projected keepers:</b> &#9608;&#9608;&#9608;&#9608;&#9608;, &#9608;&#9608;&#9608;&#9608;, &#9608;&#9608;&#9608;&#9608;&#9608;&#9608;</div><div class="mrow">Tip: if you have to ask what he is keeping, you have already lost the trade.</div></div>';
    const tags = m.tags.map((t) => '<span class="mtag">' + esc(t) + '</span>').join('');
    const all = ks[m.h] || []; const kp = [0, 1, 2].map((i) => all[i]).filter((s) => s && s[0]);
    const u = all[3] && all[3][0] ? all[3][0] : null;
    const keeps = kp.length ? kp.map((s) => '<span class="keep">' + esc(s[0]) + ' <span class="' + (yearsLeft(s[0]) === 1 ? 'y1' : 'y2') + '">' + (yearsLeft(s[0]) === 1 ? '1yr' : '2yr') + '</span> ' + s[1] + '</span>').join('') : '<span style="color:#8a7f5e">none set</span>';
    const c = CAPITAL[m.h] || [0, 0, 0], ct = chestTag(m.h);
    const cap = '<div class="capline"><span class="capchip">2026 picks: <b>' + c[0] + '</b> 1st · <b>' + c[1] + '</b> 2nd · <b>' + c[2] + '</b> 3rd</span><span class="chesttag ct-' + ct + '">' + ct + '</span></div>';
    const nd = needScores(ks, m.h);
    const needs = '<div class="needgrid"><span class="needpill">RB ' + nbar(nd.RB) + '</span><span class="needpill">WR ' + nbar(nd.WR) + '</span><span class="needpill">TE ' + nbar(nd.TE) + '</span><span class="needpill">QB ' + nbar(nd.QB) + '</span></div>';
    const db = DH && DH.byManager ? DH.byManager[m.h] : null;
    let likes;
    if (db) {
      const pos = db.pos || {}; const order = Object.keys(pos).sort((a, cc) => pos[cc] - pos[a]);
      const posStr = order.length ? order.map((k) => k + ' ' + pos[k]).join(' · ') : 'no picks found';
      const rep = (db.repeat || []);
      const repStr = rep.length ? rep.map(esc).join(', ') : '<span class="pmeta">none - no player drafted in both years</span>';
      likes = '<div class="mrow"><b>Drafted both 24 and 25 (true affinity):</b> ' + repStr + '</div><div class="mrow" style="border-top:none;padding-top:4px"><b>Real draft mix (24-25):</b> <span class="pmeta">' + posStr + '</span></div>';
    } else {
      likes = '<div class="mrow"><b>Draft history:</b> <span class="pmeta">tap Sync in a browser to load real 2024 and 2025 picks</span></div>';
    }
    const rd = RD && RD.byHandle ? RD.byHandle[m.h] : null;
    let rosterBlock;
    if (rd && rd.players && rd.players.length) {
      const ord = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5, DL: 6, DE: 6, DT: 6, NT: 6, LB: 7, OLB: 7, ILB: 7, MLB: 7, DB: 8, CB: 8, S: 8, SS: 8, FS: 8, SAF: 8 }, byPos = {};
      rd.players.forEach((pl) => { (byPos[pl.p || '-'] = byPos[pl.p || '-'] || []).push(pl); });
      const keys = Object.keys(byPos).sort((a, b) => (ord[a] == null ? 9 : ord[a]) - (ord[b] == null ? 9 : ord[b]));
      const lines = keys.map((k) => '<div class="rosrow"><span class="rospos">' + esc(k) + '</span> ' + byPos[k].map((pl) => '<span class="rosp' + (pl.s ? ' st' : '') + '">' + esc(pl.n) + '</span>').join(', ') + '</div>').join('');
      rosterBlock = '<div class="mrow"><b>Current roster (live, ' + rd.players.length + ' players):</b><div class="roster">' + lines + '</div><span class="pmeta">Bold = starter. As of last sync.</span></div>';
    } else if (rd) {
      rosterBlock = '<div class="mrow"><b>Current roster:</b> <span class="pmeta">no players rostered yet (synced - rosters fill in after the draft)</span></div>';
    } else {
      rosterBlock = '<div class="mrow"><b>Current roster:</b> <span class="pmeta">tap Sync (button up top) to load live rosters from Sleeper</span></div>';
    }
    const uline = u ? '<div class="mrow" style="border-top:none;padding-top:4px"><b>Watch:</b> <span class="keep">' + esc(u) + ' unlikely</span></div>' : '';
    return '<div class="mgr"><div class="h"><div><div class="tm">' + esc(tName) + '</div><div class="wh">@' + esc(m.h) + '</div></div><div class="rec">' + m.rec + '<small>' + esc(m.pf) + '</small></div></div><div class="mtags">' + tags + '</div>' + rosterBlock + '<div class="mrow tend"><b>Drafts:</b> ' + esc(m.tend) + '</div>' + cap + '<div class="mrow"><b>Needs after keepers:</b>' + needs + '</div><div class="mrow"><b>Projected keepers:</b><br>' + keeps + '</div>' + uline + likes + '<div class="mrow">' + esc(m.note) + '</div></div>';
  }

  $: html = MGRS.map((m) => card(m, ks, RD, DH)).join('');
</script>

<section class="tab on">
  <div class="note"><b>The brain.</b> Live rosters, two-year tendencies, real offseason trades, 2026 draft capital, positional need, and each manager's real draft history. Rosters and history refresh every time you sync.</div>
  <div class="mgrid">{@html html}</div>
</section>
