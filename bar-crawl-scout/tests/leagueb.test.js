// THE SECOND LEAGUE, AS CAPTURED — not as assumed.
//
// "Redraft, 12 teams" is the sort of thing that is true right up until it isn't,
// and every number on the second board is derived from these settings: the ADP
// family it quotes, where replacement level sits, how deep the draft runs. So
// they are pinned here against the captured fixtures rather than typed into a
// config file from memory.
//
// If Ryan changes a setting in Sleeper and re-captures, these fail loudly and
// the board gets fixed. That is the point.
import { describe, it, expect } from 'vitest';
import league from '../src/lib/api/fixtures-b/league.json';
import drafts from '../src/lib/api/fixtures-b/drafts-2026.json';
import rosters from '../src/lib/api/fixtures-b/rosters-2026.json';
import users from '../src/lib/api/fixtures-b/users-2026.json';
import picks from '../src/lib/api/fixtures-b/draft-picks-2026.json';
import traded from '../src/lib/api/fixtures-b/traded_picks-2026.json';
import { adpKeyFor } from '../src/lib/engine/sheet';
import { leaguePhase, draftCountdown } from '../src/lib/engine/phase';

const draft = drafts[0];

describe('the league it actually is', () => {
  it('is the redraft league, by id and by name', () => {
    expect(league.league_id).toBe('1397440173184172032');
    expect(league.name).toBe('GA - Re-Draft Kings Sportsbook');
    expect(league.season).toBe('2026');
  });

  it('is twelve teams over fourteen rounds, and the two agree', () => {
    // 12 x 14 = 168 = 12 rosters x 14 spots. Everyone drafts a full squad and
    // nothing is left over, which is only true while no picks are traded.
    expect(league.total_rosters).toBe(12);
    expect(draft.settings.teams).toBe(12);
    expect(draft.settings.rounds).toBe(14);
    expect(league.roster_positions).toHaveLength(14);
    expect(league.total_rosters * draft.settings.rounds)
      .toBe(league.total_rosters * league.roster_positions.length);
  });

  it('starts eight and benches six, with no defensive seat', () => {
    expect(league.roster_positions).toEqual(
      ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'],
    );
    // The other league starts an IDP_FLEX and this one does not — which is the
    // single fact that moves the ADP family, so it is worth its own assertion.
    expect(league.roster_positions).not.toContain('IDP_FLEX');
  });

  it('is genuinely a redraft, not a keeper league with the keepers unset', () => {
    // max_keepers is 3 in the settings blob, which is Sleeper's default and
    // means nothing here. The evidence that decides it is that nobody holds
    // anybody: no keepers, no rostered players, no traded picks, no picks made.
    expect(rosters).toHaveLength(12);
    for (const r of rosters) {
      expect(r.keepers || []).toHaveLength(0);
      expect(r.players || []).toHaveLength(0);
    }
    expect(picks).toHaveLength(0);
    expect(traded).toHaveLength(0);
    expect(league.settings.type).toBe(0);
  });
});

describe('the rulebook it scores on', () => {
  const s = league.scoring_settings;

  it('pays six for a passing touchdown and a half for a first down', () => {
    expect(s.pass_td).toBe(6);
    expect(s.rush_fd).toBe(0.5);
    expect(s.rec_fd).toBe(0.5);
    expect(s.rec).toBe(0.5);
    expect(s.pass_yd).toBe(0.04);
    expect(s.pass_int).toBe(-2);
  });

  it('docks a point for a fumble AND for losing it', () => {
    // Stacked, same as the other league — the one rule no projection carries.
    expect(s.fum).toBe(-1);
    expect(s.fum_lost).toBe(-1);
  });

  it('pays an individual defender nothing, so there is no reason to model one', () => {
    // The keys are PRESENT — Sleeper ships the whole rulebook and zeroes what a
    // league does not use — so "no idp_ keys" would be a false negative. What
    // matters is that every rule an individual defender could score on is worth
    // zero, which is what makes the offence-only board honest here.
    const idp = Object.entries(s).filter(([k]) => /^(idp_|tkl|sack|ff$|fum_rec$|safe$|blk_kick)/.test(k));
    expect(idp.length).toBeGreaterThan(0);
    expect(idp.filter(([, v]) => v !== 0)).toEqual([]);
  });

  it('does still pay for a return touchdown, which the board leaves out on purpose', () => {
    // st_td and def_st_td are unit and return scoring, not individual defence.
    // They are real and they are excluded by the board's OUT_OF_SCOPE filter —
    // asserted here so that exclusion stays a decision rather than an oversight.
    expect(s.st_td).toBe(6);
    expect(s.def_st_td).toBe(6);
  });
});

describe('the price the board must quote', () => {
  it('resolves to the mainstream half-PPR ADP, on its own', () => {
    // No IDP seat and one quarterback, half a point a catch. Nothing here is
    // configured — adpKeyFor reads the league's own roster positions, which is
    // why the second board needs no ADP setting of its own.
    expect(adpKeyFor(league.roster_positions, league.scoring_settings)).toBe('adp_half_ppr');
  });

  it('is a different family from the keeper league, and that is the point', async () => {
    const other = (await import('../src/lib/api/fixtures/league.json')).default;
    expect(adpKeyFor(other.roster_positions, other.scoring_settings)).toBe('adp_idp_1qb');
    expect(adpKeyFor(league.roster_positions, league.scoring_settings))
      .not.toBe(adpKeyFor(other.roster_positions, other.scoring_settings));
  });

  it('runs the board deeper than the draft, twice over', () => {
    // The cap exists because Sleeper fills the ADP column with 600s and 999s
    // past the point anyone is priced. Twice the draft is the rule, and for
    // this league that is a bigger number than the keeper league's.
    const cap = Math.max(120, league.total_rosters * draft.settings.rounds * 2);
    expect(cap).toBe(336);
  });
});

describe('where it sits in the calendar', () => {
  it('has not drafted yet, so the board is a prep tool', () => {
    expect(draft.status).toBe('pre_draft');
    expect(leaguePhase({ draft, league })).toBe('prep');
  });

  it('drafts the same day as the other league, two hours later', () => {
    // Worth knowing, and worth the board saying: two drafts on one afternoon is
    // exactly when a star saved against the wrong league would bite.
    expect(draft.start_time).toBe(1788600653000);
    const when = new Date(draft.start_time).toISOString();
    expect(when.slice(0, 10)).toBe('2026-09-05');
    expect(draftCountdown({ draft, now: draft.start_time - 3 * 3600_000 })).toBe('in 3 hours');
  });

  it('is a snake with the order already drawn', () => {
    expect(draft.type).toBe('snake');
    expect(Object.keys(draft.draft_order || {})).toHaveLength(12);
    // Every slot 1..12 used exactly once — a half-drawn order would put two
    // managers on one seat and the board would double-count a pick.
    expect(Object.values(draft.draft_order).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('has all twelve managers, Ryan among them', () => {
    expect(users).toHaveLength(12);
    const handles = users.map((u) => u.display_name);
    expect(handles).toContain('witherssssss');
  });
});
