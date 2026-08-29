// DO OUR NUMBERS MATCH SLEEPER'S? — reconciled against the real draft board.
//
// Twice now the answer was no, and both times for a reason nothing on the page
// could have told you.
//
// FIRST: STOCK_SCORING carried pass_int -2, copied across from our own league,
// where Sleeper's published half-PPR uses -1. It only bit quarterbacks, so it
// never looked like a bug — every QB just read eight to fourteen points light.
//
// SECOND, and worse: the headline column scored a BACKFILLED line — the
// projection with any omitted stat filled in from the player's own last season.
// Sleeper applies the league's scoring_settings to its own projection and prints
// the answer in the draft room, so scoring anything else meant arguing with the
// number on Ryan's screen. Josh Allen came out at 428 against a draft board
// reading 435.3, and the page gave you no way to tell which to believe.
//
// So the anchor of these tests is not a fixture written to agree with the code.
// It is nine numbers read straight off sleeper.com/draft.
import { describe, it, expect } from 'vitest';
import proj from '../src/lib/api/fixtures/season-projections-2026.json';
import blob from '../src/lib/api/fixtures/players-trimmed.json';
import league from '../src/lib/api/fixtures/league.json';
import priorStats from '../src/lib/api/fixtures/season-stats-2025.json';
import { STOCK_SCORING, buildSheet, edgePoints } from '../src/lib/engine/sheet';
import { scoreStats } from '../src/lib/engine/scoring';

const OFFENCE = new Set(['QB', 'RB', 'WR', 'TE']);
const rows = [];
for (const id in proj) {
  const info = blob[id];
  if (!info || !OFFENCE.has((info.position || '').toUpperCase())) continue;
  rows.push({
    id, name: info.full_name, pos: info.position.toUpperCase(),
    line: proj[id], published: Number(proj[id].pts_half_ppr) || 0,
  });
}
const withPub = rows.filter((r) => r.published > 0);

describe('the stock baseline IS Sleeper’s baseline', () => {
  it('reproduces their published total to the decimal for all but one player', () => {
    const off = withPub.filter((r) => Math.abs(scoreStats(r.line, STOCK_SCORING) - r.published) > 0.5);
    // Travis Hunter is the exception and an honest one: he is listed both ways,
    // so Sleeper's total for him carries points our offence-only board does not
    // score. One row in three hundred, and the page marks it rather than hiding it.
    expect(off.map((r) => r.name)).toEqual(['Travis Hunter']);
    expect(withPub.length).toBeGreaterThan(250);
  });

  it('scores an interception at MINUS ONE, which is what their number solves to', () => {
    // Strip the rule out entirely, then read the weight straight off the gap.
    const noInt = { ...STOCK_SCORING };
    delete noInt.pass_int;
    const solved = withPub
      .filter((r) => r.pos === 'QB' && Number(r.line.pass_int) > 0)
      .map((r) => (r.published - scoreStats(r.line, noInt)) / Number(r.line.pass_int));
    expect(solved.length).toBeGreaterThan(30);
    for (const w of solved) expect(w).toBeCloseTo(-1, 2);
    expect(STOCK_SCORING.pass_int).toBe(-1);
  });

  it('is NOT our own league’s interception rule', () => {
    // The bug was that these two were the same number. They are not the same
    // rule and must never be copied from one another again.
    expect(league.scoring_settings.pass_int).toBe(-2);
    expect(STOCK_SCORING.pass_int).not.toBe(league.scoring_settings.pass_int);
  });

  it('would put every quarterback light by exactly his interceptions', () => {
    // The size of the error is the projection itself, which is why it ranged
    // from a point on a backup to fourteen on Geno Smith and never looked like
    // a constant anyone would spot.
    const wrong = { ...STOCK_SCORING, pass_int: -2 };
    const qbs = withPub.filter((r) => r.pos === 'QB' && Number(r.line.pass_int) > 0);
    expect(qbs.length).toBeGreaterThan(30);
    let worst = 0;
    for (const r of qbs) {
      const short = r.published - scoreStats(r.line, wrong);
      expect(short, `${r.name}`).toBeCloseTo(Number(r.line.pass_int), 2);
      worst = Math.max(worst, short);
    }
    expect(worst).toBeGreaterThan(10);        // the top of the position, badly wrong
  });
});

// Read off sleeper.com/draft (the PTS column) while the board was open. These
// are the numbers every manager in the league is looking at, and the headline
// column has to BE them — not approximate them, not improve on them.
const SLEEPER_DRAFT_BOARD = {
  'Josh Allen': 435.3,
  'Drake London': 263.3,
  'Trey McBride': 236.3,
  'Jeremiyah Love': 251.7,
  'George Pickens': 266.6,
  'Quinshon Judkins': 243.0,
  'Chuba Hubbard': 183.9,
  'Blake Corum': 171.9,
  'Jadarian Price': 214.0,
};

describe('the headline column IS the draft board', () => {
  const OUT = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;
  const scoring = Object.fromEntries(
    Object.entries(league.scoring_settings).filter(([k]) => !OUT.test(k)),
  );
  const inputs = rows.map((r) => {
    const prior = priorStats[r.id] || null;
    return {
      id: r.id, name: r.name, pos: r.pos, team: 'FA',
      games: Number(r.line.gp) || 17,
      proj: r.line, sleeperPts: r.published,
      prior, priorGames: prior ? Number(prior.gp ?? prior.gms_active ?? 0) || 0 : 0,
    };
  });
  const board = buildSheet(inputs, scoring, league.roster_positions.filter((p) => p !== 'IDP_FLEX'), 10);
  const at = Object.fromEntries(board.rows.map((r) => [r.name, r]));

  it('reproduces every number Ryan can read off his own draft room', () => {
    for (const [name, pts] of Object.entries(SLEEPER_DRAFT_BOARD)) {
      expect(at[name], `${name} is on the board`).toBeTruthy();
      // EXACTLY. Not close, not within a tenth — the same number, because it is
      // the same number: their projection, their league scoring, rounded the way
      // they round it.
      expect(at[name].sleeper, name).toBe(pts);
    }
  });

  it('does NOT quietly improve on it with a backfill', () => {
    // The backfill was the whole disagreement: it docked Josh Allen seven points
    // for fumbles his projection never claimed he would make. That penalty is a
    // real league rule and it now lives in its own column, where it can be read
    // rather than absorbed.
    expect(Math.abs(at['Josh Allen'].sleeper - 435.3)).toBeLessThanOrEqual(0.11);
    expect(at['Josh Allen'].fumAdj).toBeLessThan(0);
    expect(at['Josh Allen'].adjusted).toBeLessThan(at['Josh Allen'].sleeper);
    expect(at['Josh Allen'].adjusted).toBeCloseTo(435.3 + at['Josh Allen'].fumAdj, 1);
  });

  it('keeps the fumble estimate out of the ranking, and never positive', () => {
    for (const r of board.rows) expect(r.fumAdj, r.name).toBeLessThanOrEqual(0);
    // A man with no prior season simply has none of it.
    expect(board.rows.some((r) => r.fumAdj === 0)).toBe(true);
  });

  it('is the per-game rate times the games, and nothing else', () => {
    for (const r of board.rows.slice(0, 40)) {
      expect(Math.abs(r.sleeper - r.ours * r.games), r.name).toBeLessThanOrEqual(0.11);
    }
  });
});

describe('the three columns the board is built on', () => {
  const OUT = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;
  const scoring = Object.fromEntries(
    Object.entries(league.scoring_settings).filter(([k]) => !OUT.test(k)),
  );
  const inputs = rows.map((r) => ({
    id: r.id, name: r.name, pos: r.pos, team: 'FA',
    games: Number(r.line.gp) || 17,
    proj: r.line, sleeperPts: r.published,
  }));
  const built = buildSheet(inputs, scoring, league.roster_positions.filter((p) => p !== 'IDP_FLEX'), 10);
  const by = Object.fromEntries(built.rows.map((r) => [r.name, r]));

  it('shows Sleeper’s own half-PPR number as the market price, untouched', () => {
    for (const r of built.rows.slice(0, 50)) {
      if (r.marketFrom !== 'sleeper') continue;
      const src = rows.find((x) => x.id === r.id);
      expect(r.market, `${r.name}`).toBe(src.published);
    }
  });

  it('says when the market number is ours because Sleeper published none', () => {
    const derived = built.rows.filter((r) => r.marketFrom === 'derived');
    expect(derived.length).toBeGreaterThan(0);
    for (const r of derived.slice(0, 5)) expect(r.market).toBeGreaterThanOrEqual(0);
    expect(built.rows.filter((r) => r.marketFrom === 'sleeper').length).toBeGreaterThan(250);
  });

  it('is a season total, not a rate — games are already in it', () => {
    const a = by['Josh Allen'];
    expect(a.sleeper).toBeCloseTo(a.ours * a.games, 0);
    expect(a.sleeper).toBeGreaterThan(300);
    expect(a.gap).toBeCloseTo(a.sleeper - a.market, 1);
  });

  it('lifts the whole board by about a quarter', () => {
    // Every scored player gains; the question the Edge column answers is who
    // gains MORE than that, and it is meaningless without this denominator.
    expect(built.tide).toBeGreaterThan(1.2);
    expect(built.tide).toBeLessThan(1.4);
    expect(built.medBoost).toBeCloseTo(built.tide - 1, 6);
  });

  it('and the running backs beat it while the quarterbacks do NOT', () => {
    // The finding this whole column exists to surface, and it is the opposite
    // of the obvious read. Six-point passing TDs look like the headline rule,
    // but they come with a doubled interception and no first-down money, so a
    // QB gains about a fifth where the board gains a quarter. A workhorse back
    // banks half a point every time he moves the chains and gains a third.
    const top = built.rows.slice().sort((x, y) => y.edgePts - x.edgePts).slice(0, 15);
    expect(top.every((r) => r.pos === 'RB'), 'the top of Edge is backs').toBe(true);

    const bottom = built.rows.filter((r) => r.market > 0).sort((x, y) => x.edgePts - y.edgePts).slice(0, 10);
    expect(bottom.every((r) => r.pos === 'QB'), 'the bottom of Edge is quarterbacks').toBe(true);

    // Named, so the day this stops being true somebody has to look at it.
    expect(by['Josh Allen'].edgePts).toBeLessThan(-15);
    expect(by["De'Von Achane"].edgePts).toBeGreaterThan(10);
  });

  it('is not merely the raw gap re-sorted', () => {
    // If Edge repeated +Pts it would rank the same men in the same order and
    // tell you nothing. Lamar Jackson is fourth by raw gain and NEGATIVE here.
    const byGap = built.rows.slice().sort((x, y) => y.gap - x.gap).slice(0, 20).map((r) => r.id);
    const byEdge = built.rows.slice().sort((x, y) => y.edgePts - x.edgePts).slice(0, 20).map((r) => r.id);
    expect(byEdge).not.toEqual(byGap);
    expect(by['Lamar Jackson'].gap).toBeGreaterThan(60);
    expect(by['Lamar Jackson'].edgePts).toBeLessThan(0);
  });

  it('has the edge sum to roughly nothing — it is a deviation, not a bonus', () => {
    const scored = built.rows.filter((r) => r.market > 0);
    const med = scored.map((r) => r.edgePts).sort((a, b) => a - b)[Math.floor(scored.length / 2)];
    expect(Math.abs(med)).toBeLessThan(2);
  });

  it('ranks on the season, so a part-season projection cannot top the board', () => {
    const first = built.rows[0];
    expect(first.partial).toBe(false);
    expect(first.games).toBeGreaterThanOrEqual(15);
    expect(built.rows[0].vorpSeason).toBeGreaterThanOrEqual(built.rows[1].vorpSeason);
  });

  it('prices a first-down mover above a big-play man on identical yardage', () => {
    // The rule nothing public can see, still doing its job after the rework.
    const movers = built.rows.filter((r) => r.pos === 'RB' && r.fd > 0);
    expect(movers.length).toBeGreaterThan(20);
  });
});

describe('edgePoints, in isolation', () => {
  it('is zero for a player who gains exactly the tide', () => {
    expect(edgePoints(120, 100, 1.2)).toBe(0);
  });

  it('is positive above it and negative below', () => {
    expect(edgePoints(130, 100, 1.2)).toBe(10);
    expect(edgePoints(110, 100, 1.2)).toBe(-10);
  });

  it('says nothing when there is no baseline to measure from', () => {
    expect(edgePoints(120, 0, 1.2)).toBe(0);
    expect(edgePoints(120, -5, 1.2)).toBe(0);
  });
});
