<script>
  // DRAFT GRADES — the app's other half, and it turns itself on.
  //
  // The moment the draft's own status reads `complete`, this page stops saying
  // "not yet" and starts saying who won the night. Nothing to deploy, nothing to
  // toggle: the draft query polls every thirty seconds, so it lands within half a
  // minute of the last pick.
  //
  // WHAT IT GRADES ON. Not vibes, and not ADP. Every pick is measured against
  // The Sheet — Sleeper's own projections, re-scored under this league's rulebook
  // and ranked by value over replacement with the thirty keepers already out of
  // the pool. Take the best man left and you score nothing. Let one fall to you
  // and you score the slots he fell. Reach and you pay for it. Divided by picks,
  // so nineteen selections beats six only if they were better ones.
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { draftSheetQuery, playersQuery } from '../api/queries';
  import { userHandleMap } from '../api/league';
  import { TEAMSHORT, RYAN } from '../lib/data.js';
  import { buildSheet, adpKeyFor } from '../lib/engine/sheet.ts';
  import { gradeDraft, draftIsDone } from '../lib/engine/draftgrade.ts';
  import { usePhase } from '../lib/usePhase.js';

  const sheetQ = createQuery(draftSheetQuery());
  const playersQ = createQuery(playersQuery());
  const phaseStore = usePhase();

  $: raw = $sheetQ.data || null;
  $: blob = $playersQ.data || null;
  $: scoring = raw?.league?.scoring_settings || {};
  $: rosterPos = raw?.league?.roster_positions || [];
  $: teams = raw?.rosters?.length || 10;
  $: rounds = Number(raw?.draft?.settings?.rounds) || 15;
  $: picks = raw?.picks || [];
  $: done = draftIsDone(raw?.draft);
  $: live = $phaseStore.drafting;

  $: uh = raw?.users ? userHandleMap(raw.users) : {};
  $: handleOf = Object.fromEntries((raw?.rosters || []).map((r) => [r.roster_id, uh[r.owner_id] || ('roster ' + r.roster_id)]));

  // THE BOARD AS IT STOOD BEFORE A PICK WAS MADE. Keepers out — they were never
  // draftable — and everybody else in, because they were. Grading against the
  // board as it stands afterwards would rank each man against a pool he has
  // himself been removed from, and every pick would come out par.
  $: keptIds = new Set(
    (raw?.rosters || []).flatMap((r) => (r.keepers || []).map((id) => String(id))),
  );

  const FANTASY = new Set(['QB', 'RB', 'WR', 'TE']);
  const IDP_SLOTS = new Set(['IDP_FLEX', 'DL', 'LB', 'DB', 'IDP']);
  const OUT_OF_SCOPE = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;
  $: offenceSlots = (rosterPos || []).filter((p) => !IDP_SLOTS.has(p));
  $: offenceScoring = Object.fromEntries(Object.entries(scoring).filter(([k]) => !OUT_OF_SCOPE.test(k)));
  $: adpKey = adpKeyFor(rosterPos, scoring);
  $: adpCap = Math.max(120, teams * rounds * 2);

  $: inputs = (() => {
    if (!raw?.proj || !blob) return [];
    const out = [];
    for (const pid in raw.proj) {
      const info = blob[pid];
      if (!info || !info[0]) continue;
      const pos = (info[1] || '').toUpperCase();
      if (!FANTASY.has(pos)) continue;
      const line = raw.proj[pid] || {};
      out.push({
        id: String(pid), name: info[0], pos, team: info[2] || 'FA',
        age: info[3] ?? null, exp: info[4] ?? null,
        games: Number(line.gp ?? line.gms_active ?? 17) || 17,
        proj: line, prior: raw.priorStats?.[pid] || null,
        priorGames: 0,
        sleeperPts: Number(line.pts_half_ppr) || 0,
        adp: Number(line[adpKey]) || null,
        adpMarket: Number(line.adp_half_ppr) || null,
        adpPpr: Number(line.adp_ppr) || null,
        pprPts: Number(line.pts_ppr) || null,
        adpDyn: Number(line.adp_dynasty_half_ppr) || null,
        adpConsensus: null,
      });
    }
    return out;
  })();

  $: built = inputs.length
    ? buildSheet(inputs, offenceScoring, offenceSlots, teams, 17, keptIds, adpCap)
    : { rows: [] };

  // Rank by VALUE, which is the whole argument of this app: the best pick is not
  // the highest scorer, it is the man furthest clear of what the next man at his
  // position would have given you. Josh Allen is the top scorer on the board and
  // the eleventh most valuable player on it.
  $: rankById = (() => {
    const m = {};
    built.rows
      .filter((r) => r.valueRank != null)
      .slice()
      .sort((a, b) => a.valueRank - b.valueRank)
      .forEach((r, i) => { m[r.id] = { rank: i + 1, name: r.name, pos: r.pos }; });
    return m;
  })();
  $: haveBoard = Object.keys(rankById).length > 0;

  // How deep the draft actually is: ten seats, fifteen rounds. Past that the
  // board's ordering is noise and grading on it would drown round one in round
  // fourteen — see the note in draftgrade.ts.
  $: depth = Math.max(1, teams * rounds);
  $: grades = haveBoard
    ? gradeDraft(picks, { rank: (id) => rankById[id] || null, handleOf, userHandle: uh }, { depth })
    : { rows: [], steals: [], reaches: [], unranked: 0, graded: 0, field: 0, depth };

  const nm = (h) => TEAMSHORT[h] || h;
  const sign = (n) => (n > 0 ? '+' : '') + n;
  const gradeClass = (g) => (g.startsWith('A') ? 'a' : g.startsWith('B') ? 'b' : g.startsWith('C') ? 'c' : 'd');
  const posLine = (counts) => ['QB', 'RB', 'WR', 'TE']
    .filter((p) => counts[p]).map((p) => `${counts[p]} ${p}`).join(' · ');
</script>

<section class="table-page">
  {#if !done && !live}
    <div class="waiting">
      <span class="eyebrow">Not yet</span>
      <b>The draft hasn't happened.</b>
      <p class="blurb">
        This page fills itself in the moment the last pick lands — {#if $phaseStore.countdown}the draft is <b>{$phaseStore.countdown}</b>, and{/if}
        nothing here needs a button pressed. Until then, the board you'll be graded against is
        <a href="/board" use:link>the Big Board</a>.
      </p>
    </div>
  {:else if !haveBoard}
    <p class="blurb">Building the board…</p>
  {:else}
    <p class="blurb">
      {#if live}<b class="livedot">● Live — the draft is still running.</b> Grades so far, and they'll move.{:else}<b>Final.</b>{/if}
      Every pick measured against <a href="/sheet" use:link>the value board</a> as it stood before the draft: projections re-scored
      under this league's rulebook, ranked by value over replacement, keepers already out.
      Let a man fall to you and you bank the slots he fell; reach and you pay for them. Per pick, so holding
      more of them isn't the same as using them well — and measured against <b>the room</b>, not against the board,
      because nobody drafts off a value board. <b>B is exactly average for this league.</b>
      <span class="fine">
        {grades.graded} picks graded{#if grades.unranked}, {grades.unranked} outside the board and not counted{/if}. Keepers aren't picks and don't count.
        Past #{grades.depth} everyone is replacement level, so a round-15 flier isn't scored as a reach.
      </span>
    </p>

    <div class="ledger">
      <div class="lrow head">
        <span class="rk">#</span><span class="tm">Team</span><span class="c">GRADE</span>
        <span class="c">/PICK</span><span class="c tot">TOTAL</span><span class="c pk">PICKS</span><span class="who">HAUL</span>
      </div>
      {#each grades.rows as r, i (r.handle)}
        <div class="lrow" class:leader={i === 0} class:you={r.handle === RYAN}>
          <span class="rk">{i + 1}</span>
          <span class="tm">
            <a href={'/managers/' + r.handle} use:link>{nm(r.handle)}</a>
            <span class="hnd">@{r.handle}</span>
          </span>
          <span class="c"><b class="grade {gradeClass(r.grade)}">{r.grade}</b></span>
          <span class="c num" class:pos={r.perPick > 0} class:neg={r.perPick < 0}>{sign(r.perPick)}</span>
          <span class="c num tot" class:pos={r.surplus > 0} class:neg={r.surplus < 0}>{sign(r.surplus)}</span>
          <span class="c pk">{r.picks.length}</span>
          <span class="who">
            {posLine(r.posCounts)}
            {#if r.best && r.best.delta > 0}<em>· best: {r.best.name} ({sign(r.best.delta)})</em>{/if}
          </span>
        </div>
      {/each}
    </div>

    <div class="pair">
      <div>
        <span class="eyebrow">Steals</span>
        <p class="blurb">Men who lasted well past their value rank.</p>
        <div class="ledger tight">
          {#each grades.steals as s (s.playerId)}
            <div class="lrow small">
              <span class="tm"><a href={'/player/' + encodeURIComponent(s.name)} use:link>{s.name}</a><span class="hnd">{s.pos}</span></span>
              <span class="c">{s.round}.{String(s.slot).padStart(2, '0')}</span>
              <span class="c who">{nm(s.handle)}</span>
              <span class="c num pos">{sign(s.delta)}</span>
            </div>
          {:else}
            <div class="lrow small"><span class="tm">Nobody fell far. Disciplined room.</span></div>
          {/each}
        </div>
      </div>
      <div>
        <span class="eyebrow">Reaches</span>
        <p class="blurb">Taken well before the board said to.</p>
        <div class="ledger tight">
          {#each grades.reaches as s (s.playerId)}
            <div class="lrow small">
              <span class="tm"><a href={'/player/' + encodeURIComponent(s.name)} use:link>{s.name}</a><span class="hnd">{s.pos}</span></span>
              <span class="c">{s.round}.{String(s.slot).padStart(2, '0')}</span>
              <span class="c who">{nm(s.handle)}</span>
              <span class="c num neg">{sign(s.delta)}</span>
            </div>
          {:else}
            <div class="lrow small"><span class="tm">Nobody reached. Everyone took the board.</span></div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .table-page { padding-top: 2px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 0 0 14px; line-height: 1.6; max-width: 78ch; }
  .blurb a { color: var(--neon); }
  .fine { display: block; margin-top: 4px; font-size: 11px; opacity: .8; }
  .livedot { color: #4fb286; }

  .waiting { background: var(--paper); color: var(--ink); border-radius: 6px; padding: 18px 16px; box-shadow: 0 12px 26px rgba(0,0,0,.4); }
  .waiting b { font-family: 'Archivo Black', sans-serif; font-size: 20px; display: block; margin: 6px 0 8px; }
  .waiting .blurb { color: #2a271f; margin: 0; }

  .ledger { background: var(--paper); color: var(--ink); border-radius: 6px; padding: 8px 10px; box-shadow: 0 12px 26px rgba(0,0,0,.4); background-image: repeating-linear-gradient(rgba(22,32,43,.035) 0 1px, transparent 1px 34px); }
  .lrow { display: grid; grid-template-columns: 28px minmax(120px, 1fr) 54px 54px 56px 48px minmax(0, 1.4fr); align-items: center; gap: 8px; padding: 9px 8px; border-bottom: 1px dashed rgba(22,32,43,.18); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .lrow:last-child { border-bottom: none; }
  .lrow.head { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); border-bottom: 1.5px solid rgba(22,32,43,.4); }
  .lrow.leader { background: rgba(201,164,92,.14); border-radius: 4px; }
  .lrow.you { background: rgba(130,201,252,.1); border-radius: 4px; }
  .rk { font-weight: 700; color: var(--ink-soft); text-align: center; }
  .tm { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .tm a { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 14px; color: var(--ink); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tm a:hover { color: #2f7fb8; }
  .hnd { font-size: 9.5px; color: var(--ink-soft); white-space: nowrap; }
  .c { text-align: right; color: #2a271f; }
  .num.pos { color: #2e7d46; font-weight: 700; } .num.neg { color: #b5442f; font-weight: 700; }
  .grade { font-family: 'Archivo Black', sans-serif; font-size: 16px; }
  .grade.a { color: #2e7d46; } .grade.b { color: #2a271f; } .grade.c { color: #a9791f; } .grade.d { color: #b5442f; }
  .who { font-size: 10.5px; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .who em { font-style: normal; }

  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 24px; }
  .ledger.tight .lrow { grid-template-columns: minmax(90px, 1fr) 46px 74px 44px; font-size: 11.5px; padding: 7px 6px; }
  .ledger.tight .tm a { font-size: 12.5px; }

  /* A phone gets the four columns that carry the verdict: who, what grade, by
     how much, off how many picks. TOTAL is the same fact as /PICK times PICKS. */
  @media (max-width: 560px) {
    .lrow { grid-template-columns: 22px minmax(0, 1fr) 42px 50px 38px; }
    .lrow .who, .lrow .tot { display: none; }
    .tm { flex-wrap: wrap; gap: 0 6px; }
    .tm a { font-size: 13px; white-space: normal; }
    .ledger.tight .lrow { grid-template-columns: minmax(0, 1fr) 42px 62px 42px; }
  }
</style>
