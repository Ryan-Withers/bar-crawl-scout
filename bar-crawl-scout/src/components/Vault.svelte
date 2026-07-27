<script>
  // THE VAULT — every draft this league has ever held, and what became of it.
  // The board is the nostalgia; the fates are the argument. A pick is KEPT if
  // the manager who made it still rosters the player, POACHED if someone else
  // in the league does, and GONE if nobody does.
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMSHORT } from '../lib/data.js';
  import { draftVaultQuery, rostersQuery } from '../api/queries';
  import { userHandleMap } from '../api/league';
  import { rosterHandleMap } from '../api/history';
  import {
    toVaultPicks, ownerNowMap, fatePicks, vaultRows, poachLines,
    vaultGrid, slotOrder, vaultHeadline,
  } from '../lib/engine/draftvault.ts';
  import { posColor } from './draft/theme.js';

  const vaultQ = createQuery(draftVaultQuery());
  const rostersQ = createQuery(rostersQuery());

  $: seasons = $vaultQ.data || [];
  $: if (seasons.length && !seasons.some((s) => s.season === chosen)) chosen = seasons[0].season;
  let chosen = '';
  $: season = seasons.find((s) => s.season === chosen) || null;

  // Today's ownership — the "what became of it" half of every fate.
  $: nowOwners = ownerNowMap($rostersQ.data || []);
  $: nowHandle = ($rostersQ.data && seasons.length)
    ? rosterHandleMap($rostersQ.data, userHandleMap(seasons[0].users || []))
    : {};

  // The drafting season's own roster->handle map, so a manager who has since
  // left is still named correctly on the board he drafted from.
  $: drafterHandle = season ? rosterHandleMap(season.rosters || [], userHandleMap(season.users || [])) : {};

  $: picks = season ? toVaultPicks(season.picks) : [];
  $: teams = Math.max(0, ...picks.map((p) => p.slot));
  $: fated = fatePicks(picks, nowOwners);
  $: rows = vaultRows(fated, drafterHandle);
  $: grid = vaultGrid(picks, teams);
  $: order = slotOrder(picks, teams);
  $: poached = poachLines(fated, drafterHandle, Object.keys(nowHandle).length ? nowHandle : drafterHandle);
  $: headline = vaultHeadline(rows, chosen);

  // Fate colours read off the same three inks the rest of the app uses.
  const FATE = {
    kept: { ink: 'var(--good)', label: 'still theirs' },
    poached: { ink: 'var(--brass)', label: 'changed hands' },
    gone: { ink: 'var(--muted)', label: 'off every roster' },
  };
  const tnm = (h) => TEAMSHORT[h] || h;
  const fatedAt = (over) => fated.find((f) => f.overall === over) || null;

  let view = 'board'; // 'board' | 'holders'
  let hi = 'all'; // fate filter for the board: all | kept | poached | gone
</script>

<section class="vault">
  {#if $vaultQ.isLoading}
    <p class="note">Opening the vault…</p>
  {:else if !seasons.length}
    <p class="note">No completed draft on record yet. Once this league drafts, every pick lands here for good —
      and until then the <a href="/mock" use:link>War Room</a> will happily run you a practice one.</p>
  {:else}
    <div class="seasons" role="tablist" aria-label="Draft season">
      {#each seasons as s}
        <button
          type="button" role="tab" class="syr" class:on={s.season === chosen}
          aria-selected={s.season === chosen}
          data-testid={'vault-season-' + s.season}
          on:click={() => (chosen = s.season)}
        >{s.season}</button>
      {/each}
    </div>

    <p class="headline" data-testid="vault-headline">{headline}</p>

    <div class="vtabs">
      <button type="button" class="vtab" class:on={view === 'board'} on:click={() => (view = 'board')} data-testid="vault-tab-board">The board</button>
      <button type="button" class="vtab" class:on={view === 'holders'} on:click={() => (view = 'holders')} data-testid="vault-tab-holders">Who held on</button>
    </div>

    {#if view === 'board'}
      <div class="legend">
        {#each ['all', 'kept', 'poached', 'gone'] as k}
          <button
            type="button" class="lg" class:on={hi === k} on:click={() => (hi = k)}
            style={k === 'all' ? '' : `--dot:${FATE[k].ink}`}
          >
            {#if k !== 'all'}<span class="dot"></span>{/if}
            {k === 'all' ? 'Every pick' : FATE[k].label}
          </button>
        {/each}
      </div>

      <div class="boardwrap">
        <table class="board" data-testid="vault-board">
          <thead>
            <tr>
              <th class="rh" scope="col"><span class="sr">Round</span></th>
              {#each order as rid, i}
                <th scope="col" title={drafterHandle[rid] || ''}>{rid ? tnm(drafterHandle[rid] || '') : i + 1}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each grid as row, r}
              <tr>
                <th class="rh" scope="row">{r + 1}</th>
                {#each row as cell}
                  {@const f = cell ? fatedAt(cell.overall) : null}
                  <td class:dim={f && hi !== 'all' && f.fate !== hi}>
                    {#if cell}
                      <span
                        class="cell {f ? 'f-' + f.fate : ''}"
                        style="--pos:{posColor(cell.pos)}"
                        title={f ? `${cell.name} — ${FATE[f.fate].label}` : cell.name}
                      >
                        <span class="pn">{cell.name}</span>
                        <span class="pm">{cell.pos}{cell.team ? ' · ' + cell.team : ''}{cell.isKeeper ? ' · kept' : ''}</span>
                      </span>
                    {:else}<span class="empty">—</span>{/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="holders">
        {#each rows as r (r.rosterId)}
          <article class="hcard" data-testid={'vault-holder-' + r.handle}>
            <header>
              <a class="hname" href={'/managers/' + r.handle} use:link>{tnm(r.handle)}</a>
              <span class="hrate">{r.keepRate}%</span>
            </header>
            <p class="hsub">{r.kept} of {r.picks} picks still theirs</p>
            <div class="bar" aria-hidden="true">
              <span class="seg kept" style="flex:{r.kept}"></span>
              <span class="seg poached" style="flex:{r.poached}"></span>
              <span class="seg gone" style="flex:{r.gone}"></span>
            </div>
            <ul class="hstats">
              <li><b>{r.kept}</b><span>still theirs</span></li>
              <li><b>{r.poached}</b><span>changed hands</span></li>
              <li><b>{r.gone}</b><span>off every roster</span></li>
            </ul>
            {#if r.best}
              <p class="hbest">Longest held: <b>{r.best.name}</b> <span class="mono">— round {r.best.round}, pick {r.best.overall}</span></p>
            {/if}
          </article>
        {/each}
      </div>

      {#if poached.length}
        <div class="poach">
          <h2>Who took whose</h2>
          <p class="psub">Drafted by one manager, sitting on another's roster today.</p>
          <ul>
            {#each poached as l}
              <li><b>{l.pick.name}</b> <span class="mono">{l.pick.pos} · round {l.pick.round}</span>
                <span class="arrow">{tnm(l.from)} → {tnm(l.to)}</span></li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .vault { padding-top: 2px; }
  .note { font-family: var(--mono); font-size: 12.5px; color: var(--muted); line-height: 1.7; max-width: 70ch; }
  .note a { color: var(--blue); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  .seasons { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .syr {
    font-family: var(--display); font-weight: 800; font-size: 13px; letter-spacing: .03em;
    border: 1px solid var(--line); background: #fff; color: var(--muted);
    border-radius: 9px; padding: 8px 15px; cursor: pointer; min-height: 40px;
  }
  .syr.on { background: var(--blue); border-color: var(--blue); color: #fff; }

  .headline {
    font-family: var(--body); font-size: 15px; line-height: 1.6; color: var(--chalk);
    margin: 0 0 14px; max-width: 74ch; border-left: 3px solid var(--blue-sky); padding-left: 12px;
  }

  .vtabs { display: flex; gap: 6px; margin-bottom: 12px; }
  .vtab {
    font-family: var(--body); font-weight: 700; font-size: 13px; border: 1px solid var(--line);
    background: #fff; color: var(--muted); border-radius: 9px; padding: 9px 14px; cursor: pointer; min-height: 42px;
  }
  .vtab.on { background: var(--blue-wash); border-color: var(--blue); color: var(--blue-deep); }

  .legend { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .lg {
    display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 11px;
    border: 1px solid var(--line); background: #fff; color: var(--muted);
    border-radius: 20px; padding: 7px 12px; cursor: pointer; min-height: 34px;
  }
  .lg.on { border-color: var(--blue); color: var(--blue-deep); background: var(--blue-wash); }
  .lg .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dot); }

  /* The board scrolls sideways rather than squashing 10 columns onto a phone. */
  .boardwrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  table.board { border-collapse: collapse; table-layout: fixed; width: 100%; min-width: 760px; }
  .board th {
    font-family: var(--mono); font-size: 9px; letter-spacing: .07em; text-transform: uppercase;
    color: var(--muted); font-weight: 500; padding: 9px 6px; border-bottom: 1px solid var(--line);
    background: var(--field-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .board th.rh { width: 34px; text-align: center; background: var(--field-3); }
  .board tbody th.rh {
    font-family: var(--display); font-weight: 800; font-size: 12px; color: var(--blue-deep);
    border-bottom: 1px solid var(--line); background: var(--field);
  }
  .board td { padding: 0; border-bottom: 1px solid var(--line); border-left: 1px solid var(--line); vertical-align: top; }
  .board td.dim { opacity: .22; }
  /* Position is the left stripe (same four inks as the War Room board); the
     fate is a wash across the cell, so you can read a manager's column and see
     what stuck without decoding two stripes. */
  .cell { display: block; padding: 7px 8px 8px; border-left: 3px solid var(--pos); }
  .cell.f-kept { background: rgba(29,138,78,.075); }
  .cell.f-poached { background: rgba(176,132,40,.10); }
  .cell.f-gone .pn { color: var(--muted); }
  .pn {
    display: block; font-family: var(--body); font-weight: 700; font-size: 12.5px; color: var(--chalk);
    line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pm { display: block; font-family: var(--mono); font-size: 9px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .empty { display: block; padding: 10px 8px; color: var(--line); font-family: var(--mono); font-size: 11px; }

  .holders { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; }
  .hcard { border: 1px solid var(--line); border-radius: 10px; background: #fff; padding: 13px 14px 14px; min-width: 0; }
  .hcard header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .hname { font-family: var(--display); font-weight: 800; font-size: 15px; color: var(--chalk); text-decoration: none; }
  .hname:hover { color: var(--blue); }
  .hrate { font-family: var(--display); font-weight: 800; font-size: 19px; color: var(--blue); }
  .bar { display: flex; height: 7px; border-radius: 4px; overflow: hidden; background: var(--field-3); margin: 9px 0 8px; }
  .seg { display: block; min-width: 0; }
  .seg.kept { background: var(--good); }
  .seg.poached { background: var(--brass); }
  .seg.gone { background: rgba(28,46,64,.14); }
  .hsub { font-family: var(--mono); font-size: 11px; color: var(--muted); margin: 4px 0 0; }
  .hstats { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .hstats li { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .hstats b { font-family: var(--display); font-weight: 800; font-size: 15px; color: var(--chalk); line-height: 1; }
  .hstats span { font-family: var(--mono); font-size: 9px; letter-spacing: .04em; color: var(--muted); line-height: 1.35; }
  .hstats li:nth-child(1) b { color: var(--good); }
  .hstats li:nth-child(2) b { color: var(--brass); }
  .hbest { font-family: var(--body); font-size: 12px; color: var(--muted); margin: 7px 0 0; line-height: 1.5; }
  .hbest b { color: var(--chalk); }
  .mono { font-family: var(--mono); font-size: 10.5px; }

  .poach { margin-top: 24px; border-top: 1px solid var(--line); padding-top: 16px; }
  .poach h2 { font-family: var(--display); font-weight: 800; font-size: 15px; text-transform: uppercase; letter-spacing: .03em; color: var(--chalk); margin: 0; }
  .psub { font-family: var(--mono); font-size: 11px; color: var(--muted); margin: 4px 0 12px; }
  .poach ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 6px; }
  .poach li {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; min-width: 0;
    font-family: var(--body); font-size: 13px; color: var(--chalk);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 11px; background: #fff;
  }
  .poach li .mono { color: var(--muted); }
  .arrow { margin-left: auto; font-family: var(--mono); font-size: 10.5px; color: var(--brass); white-space: nowrap; }

  @media (max-width: 620px) {
    .headline { font-size: 14px; }
    .poach .arrow { margin-left: 0; }
  }
</style>
