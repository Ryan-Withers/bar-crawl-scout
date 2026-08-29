<script>
  // Phase-aware guidance so draft-prep pages still make sense in-season.
  // Reads the live league status; defaults to draft-prep in the offseason.
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { leagueQuery, stateQuery } from '../api/queries';

  export let page = 'board'; // 'board' | 'keepers' | 'draftboard'

  const leagueQ = createQuery(leagueQuery());
  const stateQ = createQuery(stateQuery());

  // 'draft' before/at the draft; 'season' once games are being played.
  $: status = $leagueQ.data?.status || '';
  $: week = $stateQ.data?.week ?? 0;
  $: phase = status === 'in_season' || status === 'complete' || status === 'post_season' || week > 0 ? 'season' : 'draft';
</script>

<div class="note snote {phase}">
  {#if page === 'board'}
    {#if phase === 'season'}
      <b>The draft's done — this is your live rankings database now.</b> Same WIN engine, but use it to scout the <a href="/players" use:link>wire</a>, weigh <a href="/trade" use:link>trades</a>, and check any player's file. Your saved draft boards stay here for next year.
    {:else}
      <b>WIN</b> ranks everyone for your window; click any header to re-sort. <b>Build a draft board</b> from the dropdown to rank your own way — the <b>draft</b> button crosses players off live.
    {/if}
  {:else if page === 'keepers'}
    {#if phase === 'season'}
      <b>Keeper planning for next season.</b> The clock shows contract years — a man in his second straight year is on his last one. Revisit as the season reshapes your roster.
    {:else}
      <b>These are locked.</b> Every manager's three come straight off Sleeper, so there is nothing left to guess and nothing here to type. Everyone else on every roster goes back into the pool.
    {/if}
  {:else if page === 'draftboard'}
    {#if phase === 'season'}
      <b>The draft is done.</b> This is the board as it finished — useful for settling arguments about who took whom, and where.
    {:else}
      Read a manager's draft <b>down his column</b>. Keepers are shaded and already spent; the brass edge marks a pick that changed hands. Scroll sideways on a phone.
    {/if}
  {/if}
</div>

<style>
  .snote.season { border-left-color: var(--brass); }
  .snote a { color: var(--neon); }
</style>
