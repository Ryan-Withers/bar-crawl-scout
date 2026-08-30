<script>
  // Phase-aware guidance so draft-prep pages still make sense afterwards.
  //
  // This used to work the phase out for itself, off the LEAGUE status and
  // whether games were being played — which missed the one moment that matters
  // here. Sleeper can leave a league on `pre_draft` for hours after the last
  // pick lands, and the season does not start for another week, so the night of
  // the draft this note still told you how to prepare for it. The draft's own
  // status flips the instant it finishes, and usePhase reads that.
  import { link } from '../lib/router.js';
  import { usePhase } from '../lib/usePhase.js';

  export let page = 'board'; // 'board' | 'keepers' | 'draftboard'

  const phaseStore = usePhase();
  // 'season' is kept as the name the markup below uses: everything from the
  // moment the draft ends onwards reads the same.
  $: phase = $phaseStore.planning ? 'season' : 'draft';
  $: drafting = $phaseStore.drafting;
  $: countdown = $phaseStore.countdown;
</script>

<div class="note snote {phase}">
  {#if page === 'board'}
    {#if phase === 'season'}
      <b>The draft's done — this is your live rankings database now.</b> Same WIN engine, but use it to scout the <a href="/players" use:link>wire</a>, weigh <a href="/trade" use:link>trades</a>, and check any player's file. See how everyone did on <a href="/grades" use:link>draft grades</a>. Your saved draft boards stay here for next year.
    {:else}
      {#if drafting}<b>The draft is under way.</b> The <b>draft</b> button crosses players off live, and the pool shrinks as picks land. {:else}<b>WIN</b> ranks everyone for your window; click any header to re-sort. {/if}<b>Build a draft board</b> from the dropdown to rank your own way{#if !drafting} — the <b>draft</b> button crosses players off live{/if}.{#if countdown && !drafting} Draft <b>{countdown}</b>.{/if}
    {/if}
  {:else if page === 'keepers'}
    {#if phase === 'season'}
      <b>Keeper planning for next season.</b> The clock shows contract years — a man in his second straight year is on his last one. Revisit as the season reshapes your roster.
    {:else}
      <b>These are locked.</b> Every manager's three come straight off Sleeper, so there is nothing left to guess and nothing here to type. Everyone else on every roster goes back into the pool.
    {/if}
  {:else if page === 'draftboard'}
    {#if phase === 'season'}
      <b>The draft is done.</b> This is the board as it finished — useful for settling arguments about who took whom, and where. Every manager's <a href="/grades" use:link>draft grade</a> is now in.
    {:else}
      Read a manager's draft <b>down his column</b>. Keepers are shaded and already spent; the brass edge marks a pick that changed hands. Scroll sideways on a phone.
    {/if}
  {/if}
</div>

<style>
  .snote.season { border-left-color: var(--brass); }
  .snote a { color: var(--neon); }
</style>
