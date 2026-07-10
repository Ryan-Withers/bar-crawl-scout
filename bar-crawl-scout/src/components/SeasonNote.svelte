<script>
  // Phase-aware guidance so draft-prep pages still make sense in-season.
  // Reads the live league status; defaults to draft-prep in the offseason.
  import { link } from 'svelte-spa-router';
  import { createQuery } from '@tanstack/svelte-query';
  import { leagueQuery, stateQuery } from '../api/queries';

  export let page = 'board'; // 'board' | 'keepers'

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
      <b>Keeper planning for next season.</b> Lock in who you'd protect — the clock shows contract years. Revisit as the season reshapes your roster.
    {:else}
      Three keeper slots plus a watch slot per team. Tap the pill to flip L ↔ VL, × to clear. The clock shows contract years.
    {/if}
  {/if}
</div>

<style>
  .snote.season { border-left-color: var(--brass); }
  .snote a { color: var(--neon); }
</style>
