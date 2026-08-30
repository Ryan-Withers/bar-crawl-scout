// WHICH JOB THE APP IS DOING — and the moment it changes.
//
// Before the draft this is a prep tool. Afterwards none of that is what you
// open it for. The switch has to happen on its own, the moment the last pick
// lands, because nobody is going to deploy a flag at 11pm on draft night.
import { describe, it, expect } from 'vitest';
import league from '../src/lib/api/fixtures/league.json';
import drafts from '../src/lib/api/fixtures/drafts-2026.json';
import state from '../src/lib/api/fixtures/state.json';
import { leaguePhase, inSeason, untilDraft, draftCountdown } from '../src/lib/engine/phase';

const draft = drafts[0];

describe('the captured league, as it stands today', () => {
  it('is in prep: the draft has not happened', () => {
    expect(draft.status).toBe('pre_draft');
    expect(leaguePhase({ draft, league, state })).toBe('prep');
  });

  it('is not fooled by preseason week 3', () => {
    // `week > 0` was the old test and it read this state as in-season while the
    // league was still waiting to draft.
    expect(state.week).toBe(3);
    expect(state.season_type).toBe('pre');
    expect(inSeason(state)).toBe(false);
  });

  it('counts down to the real start time', () => {
    const now = draft.start_time - 3 * 24 * 3600 * 1000;
    expect(draftCountdown({ draft, league, state, now })).toBe('in 3 days');
    expect(untilDraft({ draft, now })).toBe(3 * 24 * 3600 * 1000);
  });
});

describe('the moment it flips', () => {
  it('goes to planning the instant the draft says complete', () => {
    // The one that matters, and the one the old per-page version missed: the
    // LEAGUE can still say pre_draft here, and often does for a while.
    const done = { ...draft, status: 'complete' };
    expect(leaguePhase({ draft: done, league, state })).toBe('planning');
    expect(league.status).toBe('pre_draft');       // unchanged, and irrelevant
  });

  it('is drafting while the picks are landing, and only then', () => {
    expect(leaguePhase({ draft: { ...draft, status: 'drafting' }, league, state })).toBe('drafting');
    expect(leaguePhase({ draft: { ...draft, status: 'paused' }, league, state })).toBe('drafting');
    expect(leaguePhase({ draft, league, state })).toBe('prep');
  });

  it('does not need the draft at all once games are being played', () => {
    // A league that never drafted on Sleeper should still not offer to help you
    // draft in week 4.
    const playing = { season_type: 'regular', week: 4 };
    expect(leaguePhase({ draft: null, league, state: playing })).toBe('planning');
    expect(leaguePhase({ draft: { status: 'pre_draft' }, league, state: playing })).toBe('planning');
    expect(inSeason(playing)).toBe(true);
    expect(inSeason({ season_type: 'post', week: 1 })).toBe(true);
  });

  it('takes the draft’s word over the season’s', () => {
    // Mid-draft on the day the season opens, the live board is still the point.
    const playing = { season_type: 'regular', week: 1 };
    expect(leaguePhase({ draft: { status: 'drafting' }, league, state: playing })).toBe('drafting');
  });

  it('degrades to prep on rubbish rather than guessing', () => {
    expect(leaguePhase({})).toBe('prep');
    expect(leaguePhase({ draft: null, league: null, state: null })).toBe('prep');
    expect(leaguePhase({ draft: { status: null } })).toBe('prep');
    expect(untilDraft({})).toBeNull();
    expect(draftCountdown({})).toBe('');
  });
});

describe('the countdown reads like a person wrote it', () => {
  // A real epoch, not a toy one: a start_time of 0 or below means "no start time
  // set", so a draft five seconds in the past has to be expressed as a real
  // timestamp five seconds before now.
  const BASE = Date.UTC(2026, 8, 5, 7, 30);
  const at = (ms) => draftCountdown({ draft: { status: 'pre_draft', start_time: BASE + ms }, now: BASE });
  it('minutes, then hours, then days', () => {
    expect(at(20 * 60_000)).toBe('in 20 min');
    expect(at(3 * 3600_000)).toBe('in 3 hours');
    expect(at(1 * 3600_000)).toBe('in 1 hour');
    expect(at(6 * 24 * 3600_000)).toBe('in 6 days');
  });

  it('says something sensible on the doorstep and after it', () => {
    expect(at(0)).toBe('any minute');
    expect(at(-5000)).toBe('any minute');
    expect(draftCountdown({ draft: { status: 'drafting' } })).toBe('under way');
    expect(draftCountdown({ draft: { status: 'complete' } })).toBe('done');
  });
});
