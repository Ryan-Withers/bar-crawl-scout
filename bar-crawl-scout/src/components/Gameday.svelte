<script>
  import { derived, writable } from 'svelte/store';
  import { link } from 'svelte-spa-router';
  import { createQuery } from '@tanstack/svelte-query';
  import { TEAMSHORT, RYAN } from '../lib/data.js';
  import { pairMatchups } from '../lib/engine/gameday.ts';
  import { stateQuery, usersQuery, rostersQuery, matchupsQuery } from '../api/queries';
  import { userHandleMap } from '../api/league';

  const stateQ = createQuery(stateQuery());
  const usersQ = createQuery(usersQuery());
  const rostersQ = createQuery(rostersQuery());

  $: season = $stateQ.data?.season || '';
  $: week = $stateQ.data?.week ?? $stateQ.data?.display_week ?? 0;

  // roster_id -> handle, from live rosters + users.
  $: rosterHandle = ($rostersQ.data && $usersQ.data)
    ? Object.fromEntries($rostersQ.data.map((r) => [r.roster_id, userHandleMap($usersQ.data)[r.owner_id]]).filter(([, h]) => h))
    : {};

  // Reactive weekly matchups query (fires once the week is known).
  const weekStore = writable(0);
  $: weekStore.set(week);
  const matchupsQ = createQuery(derived(weekStore, ($w) => ({ ...matchupsQuery($w), enabled: $w > 0 })));

  $: games = ($matchupsQ.data && Object.keys(rosterHandle).length)
    ? pairMatchups($matchupsQ.data, rosterHandle, TEAMSHORT)
    : [];
  $: loading = $stateQ.isLoading || $matchupsQ.isFetching;
</script>

<section class="gameday">
  <div class="eyebrow">File 07 / Gameday</div>
  <p class="blurb">This week's slate, live from Sleeper.{#if season && week} Season {season} · Week {week}.{/if}</p>

  {#if games.length}
    <div class="slate">
      {#each games as g (g.id)}
        <div class="game">
          {#each [g.a, g.b] as s}
            {#if s}
              <div class="side" class:win={g.b && s.points === Math.max(g.a.points, g.b.points) && g.margin > 0} class:you={s.handle === RYAN}>
                <a class="tm" href={'/managers/' + s.handle} use:link>{s.team}{#if s.handle === RYAN} 🔒{/if}</a>
                <span class="pts">{s.points.toFixed(1)}</span>
              </div>
            {:else}
              <div class="side bye"><span class="tm">— bye —</span><span class="pts"></span></div>
            {/if}
          {/each}
          {#if g.b}<div class="margin">{g.margin === 0 ? 'DEAD EVEN' : 'by ' + g.margin.toFixed(1)}</div>{/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty">{loading ? 'Pulling the scoreboard…' : 'No live scoreboard yet — this week’s matchups load from Sleeper in your browser. Open the site in a real tab; the in-app preview blocks the network.'}</div>
  {/if}
</section>

<style>
  .gameday { max-width: 820px; padding-top: 6px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 8px 0 16px; }
  .slate { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  .game { position: relative; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .side { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 0; }
  .side + .side { border-top: 1px dashed var(--line); }
  .tm { font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 15px; color: var(--chalk); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .side a.tm:hover { color: var(--neon-hot); }
  .side.win .tm { color: var(--neon-hot); }
  .side.win .pts { color: var(--neon); }
  .side.you { background: rgba(130,201,252,.07); border-radius: 6px; margin: 0 -6px; padding: 7px 6px; }
  .side.bye .tm { color: var(--muted); font-weight: 400; font-style: italic; }
  .pts { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 17px; color: var(--chalk); }
  .margin { position: absolute; top: 12px; right: 14px; font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); line-height: 1.7; max-width: 60ch; }
</style>
