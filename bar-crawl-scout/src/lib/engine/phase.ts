// WHAT THE LEAGUE IS DOING RIGHT NOW.
//
// The app has two jobs that barely overlap. Before the draft it is a prep tool:
// a board, a mock room, keeper maths, trade valuations. Afterwards none of that
// is what you open it for — you want to know how the draft went, who your side
// is, and what to do on Sunday. It should not need telling which of those it is.
//
// SeasonNote worked this out for itself on three pages, off the LEAGUE status
// and whether games were being played. That misses exactly the moment Ryan
// cares about: the draft finishing. Sleeper leaves a league on `in_season` from
// the day it is created in some setups, and moves it to `drafting` and then
// `in_season` in others — but the DRAFT's own status is unambiguous and flips
// the instant the last pick lands.
//
// So the draft answers first, and the season answers only when there is no
// draft to ask.
//
// Pure module: statuses in, a phase out.

export type Phase = 'prep' | 'drafting' | 'planning';

export interface PhaseInput {
  /** The league's own draft, from /league/{id}/drafts. */
  draft?: { status?: string | null; start_time?: number | null } | null;
  /** The league object, for the fallback. */
  league?: { status?: string | null } | null;
  /** /state/nfl, for the other fallback. */
  state?: { season_type?: string | null; week?: number | null } | null;
  /** Now, in epoch ms. Injected so the tests are not hostage to the clock. */
  now?: number;
}

/** True once real games are being played — preseason does not count. */
export function inSeason(state: PhaseInput['state']): boolean {
  const type = state?.season_type || '';
  const week = Number(state?.week ?? 0);
  // Sleeper counts preseason weeks too, so `week > 0` alone reads week 3 of the
  // preseason as in-season while the league is still waiting to draft.
  return (type === 'regular' || type === 'post') && week > 0;
}

/**
 * Which of its two jobs the app should be doing.
 *
 * `drafting` is deliberately narrow — it is draft night and nothing else — so
 * that the pages which behave differently while picks are landing (the live
 * board) can say so without every prep page changing too.
 */
export function leaguePhase(input: PhaseInput): Phase {
  const draftStatus = String(input?.draft?.status || '').toLowerCase();
  if (draftStatus === 'complete') return 'planning';
  if (draftStatus === 'drafting' || draftStatus === 'paused') return 'drafting';

  // No draft, or one that has not started. The season can still say the prep
  // window is over — a league that never drafted on Sleeper, or a fixture set
  // captured mid-season, should not be offering to help you draft.
  if (inSeason(input?.state)) return 'planning';
  const leagueStatus = String(input?.league?.status || '').toLowerCase();
  if (leagueStatus === 'complete' || leagueStatus === 'post_season') return 'planning';

  return 'prep';
}

/**
 * How long until the draft, in ms. Negative once it has started, null when
 * there is no scheduled start. The countdown is the one thing worth saying on
 * every page in the last week, and it is the same maths everywhere.
 */
export function untilDraft(input: PhaseInput): number | null {
  const t = Number(input?.draft?.start_time);
  if (!Number.isFinite(t) || t <= 0) return null;
  return t - (input?.now ?? Date.now());
}

/** "in 6 days", "in 3 hours", "under way". Short enough for a header. */
export function draftCountdown(input: PhaseInput): string {
  const phase = leaguePhase(input);
  if (phase === 'planning') return 'done';
  if (phase === 'drafting') return 'under way';
  const ms = untilDraft(input);
  if (ms == null) return '';
  if (ms <= 0) return 'any minute';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `in ${Math.round(hours / 24)} days`;
}
