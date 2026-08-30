// ONE ANSWER TO "WHAT IS THE APP DOING", for every page that asks.
//
// The rule lives in engine/phase.ts and is tested there; this is the plumbing
// that feeds it live data. Call it once at the top of a component and read the
// store — the queries underneath are shared by TanStack, so ten pages asking
// costs one request.
//
// The draft query polls every thirty seconds, so the flip to planning mode
// happens on its own within half a minute of the last pick landing. Nobody has
// to deploy anything on draft night.
import { derived } from 'svelte/store';
import { createQuery } from '@tanstack/svelte-query';
import { leagueQuery, stateQuery, realDraftQuery } from '../api/queries';
import { leaguePhase, draftCountdown, untilDraft } from './engine/phase.ts';

export function usePhase() {
  const leagueQ = createQuery(leagueQuery());
  const stateQ = createQuery(stateQuery());
  const draftQ = createQuery(realDraftQuery());

  return derived([leagueQ, stateQ, draftQ], ([$league, $state, $draft]) => {
    const input = {
      draft: $draft.data?.draft || null,
      league: $league.data || null,
      state: $state.data || null,
    };
    const phase = leaguePhase(input);
    return {
      phase,
      prep: phase === 'prep',
      drafting: phase === 'drafting',
      planning: phase === 'planning',
      countdown: draftCountdown(input),
      until: untilDraft(input),
      draft: input.draft,
      picks: $draft.data?.picks || [],
      // True until the draft has been asked about at all — pages that swap
      // their whole layout should wait rather than flash the wrong one.
      loading: $draft.isLoading,
    };
  });
}
