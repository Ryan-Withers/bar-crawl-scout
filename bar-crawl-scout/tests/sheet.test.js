// THE DRAFT SHEET — known answers for the re-scoring engine. Every number the
// sheet prints comes from here, so these are hand-checkable by design.
import { describe, it, expect } from 'vitest';
import {
  perGame, backfill, slotDemand, replacementLevels, median, rulesEdge,
  buildSheet, applyOrder, moveInOrder, coverage, STOCK_SCORING, SLOT_ELIGIBLE, firstDownPoints,
} from '../src/lib/engine/sheet.ts';

// Our league, straight off the fixture: half PPR, SIX point passing TDs, and
// half a point per rushing/receiving first down.
const OURS = {
  pass_yd: 0.04, pass_td: 6, pass_int: -2,
  rush_yd: 0.1, rush_td: 6, rush_fd: 0.5,
  rec: 0.5, rec_yd: 0.1, rec_td: 6, rec_fd: 0.5,
  fum: -1, fum_lost: -1,
  idp_tkl: 0.5, idp_sack: 2, idp_int: 2, idp_pass_def: 1,
};
const ROSTER = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'IDP_FLEX', 'BN', 'BN'];

describe('perGame', () => {
  it('divides a season line by games played', () => {
    expect(perGame({ rush_yd: 1700, rush_td: 17 }, 17)).toEqual({ rush_yd: 100, rush_td: 1 });
  });
  it('refuses to divide by nothing rather than returning Infinity', () => {
    expect(perGame({ rush_yd: 100 }, 0)).toEqual({});
    expect(perGame({ rush_yd: 100 }, -3)).toEqual({});
  });
});

describe('backfill', () => {
  it("fills a scored gap from the player's OWN prior rate", () => {
    const { line, filled } = backfill({ rush_yd: 80 }, { rush_yd: 60, rush_fd: 4 }, OURS);
    expect(line.rush_fd).toBe(4);      // taken from prior
    expect(line.rush_yd).toBe(80);     // projection wins where it exists
    expect(filled).toEqual(['rush_fd']);
  });
  it('never invents a stat the league does not score', () => {
    const { line } = backfill({}, { pass_att: 30, kr_yd: 200 }, OURS);
    expect(line.pass_att).toBeUndefined();
    expect(line.kr_yd).toBeUndefined();
  });
  it('does nothing at all without a prior season', () => {
    const { line, filled } = backfill({ rush_yd: 80 }, null, OURS);
    expect(line).toEqual({ rush_yd: 80 });
    expect(filled).toEqual([]);
  });
});

describe('slotDemand', () => {
  it('reads the real lineup, flexes kept separate from dedicated seats', () => {
    const { dedicated, flexes } = slotDemand(ROSTER, 10);
    expect(dedicated).toEqual({ QB: 10, RB: 20, WR: 20, TE: 10 });
    expect(flexes).toEqual([
      { slot: 'FLEX', elig: SLOT_ELIGIBLE.FLEX, n: 20 },
      { slot: 'IDP_FLEX', elig: SLOT_ELIGIBLE.IDP_FLEX, n: 10 },
    ]);
  });
  it('ignores bench, IR and taxi', () => {
    expect(slotDemand(['QB', 'BN', 'IR', 'TAXI'], 1).dedicated).toEqual({ QB: 1 });
  });
});

describe('replacementLevels', () => {
  const many = (pos, n, top) => Array.from({ length: n }, (_, i) => ({ pos, ours: top - i }));

  it('replacement is the next man after the league has filled its lineup', () => {
    // 1 team, lineup QB/RB/RB/WR/WR/TE/FLEX/FLEX/IDP_FLEX.
    const rows = [...many('QB', 5, 30), ...many('RB', 8, 20), ...many('WR', 8, 19), ...many('TE', 5, 12), ...many('LB', 5, 15)];
    const { levels, consumed } = replacementLevels(rows, ROSTER, 1);
    expect(consumed.QB).toBe(1);            // one dedicated QB seat
    expect(levels.QB).toBe(29);             // the 2nd best QB is free
    expect(consumed.LB).toBe(1);            // the IDP_FLEX took one
    expect(levels.LB).toBe(14);
    // Two FLEX seats went to the best RB/WR/TE left — RB 18 then WR 17.
    expect(consumed.RB + consumed.WR + consumed.TE).toBe(2 + 2 + 1 + 2);
  });

  it('hands each flex seat to whichever position has the best man left', () => {
    const rows = [...many('RB', 6, 30), ...many('WR', 6, 10), ...many('TE', 6, 9)];
    const { consumed } = replacementLevels(rows, ['RB', 'WR', 'TE', 'FLEX', 'FLEX'], 1);
    expect(consumed.RB).toBe(3); // 1 dedicated + both flexes, RBs being far better
  });

  it('keeps partial-season projections out of the fill entirely', () => {
    const rows = [
      { pos: 'RB', ours: 99, partial: true },   // a 4-game line must not set anything
      ...many('RB', 4, 20),
    ];
    const { levels } = replacementLevels(rows, ['RB', 'BN'], 1);
    expect(levels.RB).toBe(19); // next after the single dedicated seat took RB 20
  });

  it('names a position whose pool ran dry, so the page can say so', () => {
    const { dry } = replacementLevels([{ pos: 'QB', ours: 30 }], ['QB', 'QB', 'QB'], 1);
    expect(dry).toContain('QB');
  });
});

describe('median and the rules edge', () => {
  it('medians odd and even sets, ignoring junk', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
    expect(median([1, NaN, 3])).toBe(2);
  });

  it('measures a player against the tide, not the raw boost', () => {
    // Everyone gains 60%; a player who also gains exactly 60% has NO edge.
    expect(rulesEdge(160, 100, 0.6)).toBeCloseTo(0, 10);
    expect(rulesEdge(200, 100, 0.6)).toBeGreaterThan(0);
    expect(rulesEdge(120, 100, 0.6)).toBeLessThan(0);
  });

  it('is silent rather than infinite for a player with no stock baseline', () => {
    expect(rulesEdge(50, 0, 0.6)).toBe(0);
  });
});

describe('buildSheet on hand-checkable lines', () => {
  const P = (id, name, pos, proj, games = 17) => ({ id, name, pos, team: 'X', games, proj });

  it('scores per game under OUR rules, not season totals', () => {
    // 17 games, 4250 pass yd, 34 pass td -> per game 250 yd, 2 td.
    // Ours: 250*0.04 + 2*6 = 10 + 12 = 22.  Stock: 10 + 2*4 = 18.
    const { rows } = buildSheet([P('1', 'Arm', 'QB', { pass_yd: 4250, pass_td: 34 })], OURS, ROSTER, 10);
    expect(rows[0].ours).toBeCloseTo(22, 6);
    expect(rows[0].stock).toBeCloseTo(18, 6);
    expect(rows[0].boost).toBeCloseTo(22 / 18 - 1, 6);
  });

  it('prices the first-down rules a stock ranking cannot see', () => {
    // Two backs, identical yards and scores; one moves the chains twice as often.
    const chains = P('a', 'Chains', 'RB', { rush_yd: 1700, rush_td: 17, rush_fd: 102 });
    const boom = P('b', 'Boom', 'RB', { rush_yd: 1700, rush_td: 17, rush_fd: 51 });
    const { rows } = buildSheet([chains, boom], OURS, ROSTER, 10);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName.Chains.stock).toBeCloseTo(byName.Boom.stock, 6); // identical to a stock board
    expect(byName.Chains.ours).toBeGreaterThan(byName.Boom.ours);  // not to ours
    expect(byName.Chains.ours - byName.Boom.ours).toBeCloseTo(51 * 0.5 / 17, 6);
    // And the row says exactly how much of him is the first-down rules.
    expect(byName.Chains.fd).toBe(3);   // 102 fd * 0.5 / 17
    expect(byName.Boom.fd).toBe(1.5);
  });

  it('reports zero first-down points for someone who earns none', () => {
    const { rows } = buildSheet([P('q', 'Arm', 'QB', { pass_yd: 4250, pass_td: 34 })], OURS, ROSTER, 10);
    expect(rows[0].fd).toBe(0);
    expect(firstDownPoints({ rush_fd: 4 }, { rush_fd: 0.5 })).toBe(2);
    expect(firstDownPoints({}, OURS)).toBe(0);
  });

  it('gives a defender a real score and no stock baseline', () => {
    const lb = P('d', 'Backer', 'LB', { idp_tkl: 130, idp_sack: 8, idp_int: 2, idp_pass_def: 6 });
    const { rows } = buildSheet([lb], OURS, ROSTER, 10);
    // 130*0.5 + 8*2 + 2*2 + 6*1 = 91 for the season, over 17 games.
    //
    // The SEASON total is the anchor now, because it is the figure Sleeper puts
    // on the draft board and the one this page has to reproduce exactly; the
    // per-game rate is derived from it rather than the other way round. So it is
    // no longer pre-rounded to two places — 5.3529..., not 5.35.
    expect(rows[0].sleeper).toBe(91);
    expect(rows[0].ours).toBeCloseTo(91 / 17, 6);
    expect(rows[0].stock).toBe(0);
    expect(rows[0].boost).toBe(0);  // stated as nothing, never invented
    expect(rows[0].edge).toBe(0);
  });

  it('flags a partial season and drops a zero-game player entirely', () => {
    const { rows } = buildSheet([
      P('p', 'Half', 'RB', { rush_yd: 500 }, 8),
      P('z', 'Ghost', 'RB', { rush_yd: 500 }, 0),
    ], OURS, ROSTER, 10);
    expect(rows.map((r) => r.name)).toEqual(['Half']);
    expect(rows[0].partial).toBe(true);
  });

  it('ranks overall by VORP and within position off the same order', () => {
    const { rows } = buildSheet([
      P('1', 'RB1', 'RB', { rush_yd: 1700, rush_td: 17 }),
      P('2', 'RB2', 'RB', { rush_yd: 900, rush_td: 5 }),
      P('3', 'WR1', 'WR', { rec: 100, rec_yd: 1400, rec_td: 10 }),
    ], OURS, ROSTER, 10);
    expect(rows.map((r) => r.ovRank)).toEqual([1, 2, 3]);
    const rb = rows.filter((r) => r.pos === 'RB');
    expect(rb.map((r) => r.posRank)).toEqual([1, 2]);
  });
});

describe('your own list', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('an empty list leaves the standard board untouched', () => {
    expect(applyOrder(rows, []).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(applyOrder(rows, null).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('lays a custom order over the top, unlisted players trailing in board order', () => {
    expect(applyOrder(rows, ['d', 'b']).map((r) => r.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  const ALL = ['a', 'b', 'c', 'd'];

  it('moves a man up and down', () => {
    expect(moveInOrder([], ALL, ALL, 'c', -1)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveInOrder([], ALL, ALL, 'a', 1)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('refuses to move off either end', () => {
    expect(moveInOrder([], ALL, ALL, 'a', -1)).toEqual(ALL);
    expect(moveInOrder([], ALL, ALL, 'd', 1)).toEqual(ALL);
  });

  it('absorbs anyone new into an existing list rather than losing them', () => {
    const out = moveInOrder(['b', 'a'], ['a', 'b', 'z'], ['a', 'b', 'z'], 'z', -1);
    expect(out).toContain('z');
    expect(out.length).toBe(3);
  });

  it('seeds from the WHOLE board, not from what the filter is showing', () => {
    // The bug: on a filtered tab the saved order became only the visible ids, so
    // applying it hoisted that whole position group above everyone else.
    const all = ['qb1', 'rb1', 'qb2', 'rb2', 'qb3'];
    const shownQBs = ['qb1', 'qb2', 'qb3'];
    const out = moveInOrder([], all, shownQBs, 'qb2', -1);
    expect(out).toHaveLength(5);                       // nobody dropped
    expect(new Set(out)).toEqual(new Set(all));
    // The backs keep their places; only the two quarterbacks swapped.
    expect(out.indexOf('rb1')).toBe(1);
    expect(out.indexOf('rb2')).toBe(3);
  });

  it('swaps with the next VISIBLE man, not whoever sits one row up unfiltered', () => {
    const all = ['qb1', 'rb1', 'qb2'];
    const out = moveInOrder([], all, ['qb1', 'qb2'], 'qb2', -1);
    // qb2 goes above qb1 — the next quarterback — and rb1 is untouched.
    expect(out).toEqual(['qb2', 'rb1', 'qb1']);
  });

  it('will not move the top or bottom of a FILTERED view', () => {
    const all = ['qb1', 'rb1', 'qb2'];
    expect(moveInOrder([], all, ['qb1', 'qb2'], 'qb1', -1)).toEqual(all);
    expect(moveInOrder([], all, ['qb1', 'qb2'], 'qb2', 1)).toEqual(all);
  });
});

describe('coverage — what the league scores but nothing projects', () => {
  it('names every scored rule with no data behind it', () => {
    const { missing, scoredKeys } = coverage(OURS, [{ rush_yd: 80, rec: 4 }]);
    expect(scoredKeys).toContain('idp_sack');
    expect(missing).toContain('idp_sack');   // no defender in the lines
    expect(missing).not.toContain('rush_yd');
  });

  it('is empty when every rule has something behind it', () => {
    const { missing } = coverage({ rush_yd: 0.1 }, [{ rush_yd: 5 }]);
    expect(missing).toEqual([]);
  });

  it('ignores rules worth zero points', () => {
    const { scoredKeys } = coverage({ rush_yd: 0.1, sack: 0 }, [{}]);
    expect(scoredKeys).toEqual(['rush_yd']);
  });
});

describe('the stock baseline itself', () => {
  it('is a plain half-PPR book — 4 point passing TDs and no first downs', () => {
    expect(STOCK_SCORING.pass_td).toBe(4);
    expect(STOCK_SCORING.rec).toBe(0.5);
    expect(STOCK_SCORING.rush_fd).toBeUndefined();
    expect(STOCK_SCORING.rec_fd).toBeUndefined();
    expect(STOCK_SCORING.idp_tkl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// THE INVARIANT: keepers come OUT of the display and stay IN the fill.
//
// This is the trap the next change to this file will walk into, so it is written
// down as a test rather than as a comment. Thirty men are off the DRAFT. They are
// not off the LEAGUE — Bijan Robinson still starts at running back for ImyHunter
// in week one — so they still occupy a starting seat, and supply and demand fall
// by the same thirty at each position. Replacement is therefore unmoved, and the
// board must be built with them in it and merely hide them.
//
// Strip them from the pool while leaving demand at eighty seats and it is not a
// harmless constant shift: measured against the captured fixtures it moves 401 of
// 440 rows and turns the top thirty from 13 receivers into 16.
import projections from '../src/lib/api/fixtures/season-projections-2026.json';
import priorStats from '../src/lib/api/fixtures/season-stats-2025.json';
import playersBlob from '../src/lib/api/fixtures/players-trimmed.json';
import rosters2026 from '../src/lib/api/fixtures/rosters-2026.json';
import leagueFixture from '../src/lib/api/fixtures/league.json';

const OUT_OF_SCOPE = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;
const OFFENCE_SCORING = Object.fromEntries(
  Object.entries(leagueFixture.scoring_settings).filter(([k]) => !OUT_OF_SCOPE.test(k)),
);
const IDP_SLOTS = new Set(['IDP_FLEX', 'DL', 'LB', 'DB', 'IDP']);
const OFFENCE_SLOTS = leagueFixture.roster_positions.filter((p) => !IDP_SLOTS.has(p));
const FANTASY = new Set(['QB', 'RB', 'WR', 'TE']);

const REAL_INPUTS = Object.keys(projections).flatMap((id) => {
  const p = playersBlob[id];
  if (!p || !FANTASY.has(p.position)) return [];
  const proj = projections[id] || {};
  const prior = priorStats[id] || null;
  return [{
    id, name: p.full_name, pos: p.position, team: p.team || 'FA',
    games: Number(proj.gp) > 0 ? Number(proj.gp) : 17,
    proj,
    prior,
    priorGames: prior && Number(prior.gp) > 0 ? Number(prior.gp) : 17,
  }];
});
const KEPT = new Set(rosters2026.flatMap((r) => (r.keepers || []).map(String)));

describe('keepers leave the draft, not the league', () => {
  const teams = rosters2026.length;
  const withKeepers = buildSheet(REAL_INPUTS, OFFENCE_SCORING, OFFENCE_SLOTS, teams);
  const stripped = buildSheet(REAL_INPUTS.filter((i) => !KEPT.has(i.id)), OFFENCE_SCORING, OFFENCE_SLOTS, teams);

  it('the fixture really does hold thirty kept men inside the scored pool', () => {
    expect(KEPT.size).toBe(30);
    expect(REAL_INPUTS.filter((i) => KEPT.has(i.id))).toHaveLength(30);
  });

  it('stripping them from the FILL moves replacement at every position', () => {
    // Every one of them sits above the replacement line, so taking them out
    // without also taking out the seats they fill drags replacement down.
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      expect(stripped.levels[pos], `${pos} replacement drops`).toBeLessThan(withKeepers.levels[pos]);
    }
    // And not evenly — which is what makes it a re-ranking rather than a shift.
    expect(withKeepers.levels.RB - stripped.levels.RB).toBeGreaterThan(1);
    expect(withKeepers.levels.WR - stripped.levels.WR).toBeGreaterThan(1);
    expect(withKeepers.levels.QB - stripped.levels.QB).toBeLessThan(0.5);
  });

  it('and re-orders almost the whole board', () => {
    const rankOf = (rows) => new Map(
      rows.slice().sort((a, b) => b.vorp - a.vorp).map((r, i) => [r.id, i + 1]),
    );
    const right = rankOf(withKeepers.rows.filter((r) => !KEPT.has(r.id)));
    const wrong = rankOf(stripped.rows);
    let moved = 0;
    for (const [id, i] of right) if (wrong.has(id) && wrong.get(id) !== i) moved++;
    expect(moved / right.size).toBeGreaterThan(0.8);
  });

  it('the top thirty change SHAPE, not just order — receivers eat the board', () => {
    const top = (rows, skipKept) => rows.slice()
      .filter((r) => (skipKept ? !KEPT.has(r.id) : true))
      .sort((a, b) => b.vorp - a.vorp).slice(0, 30)
      .reduce((o, r) => ((o[r.pos] = (o[r.pos] || 0) + 1), o), {});
    const right = top(withKeepers.rows, true);
    const wrong = top(stripped.rows, false);
    expect(wrong.WR).toBeGreaterThan(right.WR);
    expect(wrong.TE).toBeLessThan(right.TE);
  });

  it('so the board is built with everyone and hides the kept — never the reverse', () => {
    // The contract in one line: buildSheet sees all 470, and the 30 are removed
    // by a display filter afterwards.
    expect(withKeepers.rows.length).toBeGreaterThan(stripped.rows.length);
    expect(withKeepers.rows.filter((r) => KEPT.has(r.id))).toHaveLength(30);
  });
});
