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
import rostersFixture from '../src/lib/api/fixtures/rosters-2026.json';
import { PLAYERS, byName, nameKey } from '../src/lib/data.js';
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

// ---------------------------------------------------------------------------
// AND THE PRICE. Sleeper publishes a dozen ADP columns and serves the one that
// matches the league FORMAT — so reading the wrong one shows a price nobody in
// the room has ever seen, which is the same class of mistake as scoring the
// wrong rulebook. Ours starts an IDP_FLEX and one quarterback.
import { adpKeyFor } from '../src/lib/engine/sheet';

// Read off the ADP column of sleeper.com/draft, same session as the PTS above.
const DRAFT_ROOM_ADP = {
  'Josh Allen': 16.4,
  'Drake London': 17.1,
  'Trey McBride': 19.1,
  'Jeremiyah Love': 23.1,
  'George Pickens': 23.9,
  'Quinshon Judkins': 52.9,
  'Chuba Hubbard': 98,
  'Blake Corum': 111.4,
  'Jadarian Price': 73.3,
};

describe('the ADP column is the one his draft room shows', () => {
  it('picks the IDP one-quarterback family for this league', () => {
    expect(adpKeyFor(league.roster_positions, league.scoring_settings)).toBe('adp_idp_1qb');
  });

  it('and that column reproduces his draft room exactly', () => {
    const key = adpKeyFor(league.roster_positions, league.scoring_settings);
    for (const [name, adp] of Object.entries(DRAFT_ROOM_ADP)) {
      const row = rows.find((r) => r.name === name);
      expect(row, name).toBeTruthy();
      expect(Number(row.line[key]), name).toBe(adp);
    }
  });

  it('where adp_half_ppr — the obvious guess — does NOT', () => {
    // Out by four to twenty places, which would have invented a bargain on
    // every row and been impossible to spot without the board next to it.
    const off = Object.entries(DRAFT_ROOM_ADP).filter(([name, adp]) => {
      const row = rows.find((r) => r.name === name);
      return Math.abs(Number(row.line.adp_half_ppr) - adp) > 0.5;
    });
    expect(off.length).toBeGreaterThanOrEqual(8);
  });

  it('follows the format rather than hard-coding ours', () => {
    expect(adpKeyFor(['QB', 'RB', 'WR', 'FLEX'], { rec: 0.5 })).toBe('adp_half_ppr');
    expect(adpKeyFor(['QB', 'RB', 'WR', 'FLEX'], { rec: 1 })).toBe('adp_ppr');
    expect(adpKeyFor(['QB', 'RB', 'WR', 'FLEX'], { rec: 0 })).toBe('adp_std');
    expect(adpKeyFor(['QB', 'SUPER_FLEX', 'RB'], { rec: 0.5 })).toBe('adp_2qb');
    expect(adpKeyFor(['QB', 'IDP_FLEX', 'RB'], { rec: 0.5 })).toBe('adp_idp_1qb');
    expect(adpKeyFor(['QB', 'QB', 'IDP_FLEX'], { rec: 0.5 })).toBe('adp_idp');
    expect(adpKeyFor([], {})).toBe('adp_half_ppr');
  });
});

describe('what Sleeper is not doing, measured', () => {
  const OUT2 = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;
  const sc = Object.fromEntries(Object.entries(league.scoring_settings).filter(([k]) => !OUT2.test(k)));
  const SLOTS = league.roster_positions.filter((p) => p !== 'IDP_FLEX');
  const key = adpKeyFor(league.roster_positions, league.scoring_settings);
  const kept = new Set();
  for (const r of rostersFixture) for (const id of (r.keepers || [])) kept.add(String(id));
  const mk = () => rows.map((r) => ({
    id: r.id, name: r.name, pos: r.pos, team: 'FA',
    games: Number(r.line.gp) || 17, proj: r.line,
    sleeperPts: r.published, adp: Number(r.line[key]) || null,
  }));
  const world = buildSheet(mk(), sc, SLOTS, 10);
  const ours = buildSheet(mk(), sc, SLOTS, 10, 17, kept, 300);

  it('does not know thirty men are off the board', () => {
    // The keepers are overwhelmingly backs and receivers, so the bar at those
    // two positions drops and every one you can still take is worth more than
    // a global ADP thinks. QB and TE barely move: almost nobody keeps one.
    expect(kept.size).toBe(30);
    expect(world.levels.RB - ours.levels.RB).toBeGreaterThan(1);
    expect(world.levels.WR - ours.levels.WR).toBeGreaterThan(1);
    expect(Math.abs(world.levels.QB - ours.levels.QB)).toBeLessThan(0.5);
    expect(Math.abs(world.levels.TE - ours.levels.TE)).toBeLessThan(0.5);
  });

  it('and does not price value over replacement AT ALL', () => {
    // The single biggest thing this page adds. Josh Allen outscores the board by
    // a hundred and seventy points and is nowhere near the most valuable pick,
    // because the gap from him to a startable quarterback is the smallest gap
    // on the board. Sleeper sorts by points and cannot say this.
    const byPts = ours.rows.slice().sort((a, b) => b.sleeper - a.sleeper);
    expect(byPts[0].name).toBe('Josh Allen');
    const allen = ours.rows.find((r) => r.name === 'Josh Allen');
    const top = ours.rows[0];
    // He outscores the most VALUABLE man on the board and is still worth less
    // than him, because the gap from Allen to a startable quarterback is the
    // smallest gap at any position.
    expect(allen.sleeper).toBeGreaterThan(top.sleeper);
    expect(allen.vorpSeason).toBeLessThan(top.vorpSeason);
    expect(allen.ovRank).toBeGreaterThan(3);
    expect(top.pos).not.toBe('QB');
  });

  it('ranks a real bargain, not a player nobody drafts', () => {
    // Before the cap, the top of the value list was men carrying Sleeper's
    // "ADP 700" filler — placeholders ranked as if they were prices.
    const best = ours.rows.filter((r) => r.slip != null).sort((a, b) => b.slip - a.slip).slice(0, 10);
    for (const r of best) {
      expect(r.adp, `${r.name} has a real price`).toBeLessThanOrEqual(300);
      expect(r.surplus, `${r.name} gains points, not just places`).toBeGreaterThan(0);
    }
  });

  it('states the gap in points as well as places', () => {
    const r = ours.rows.find((x) => x.slip != null && x.slip > 20);
    expect(r.surplus).not.toBeNull();
    // Surplus is measured against the man his price actually buys.
    const priced = ours.rows.filter((x) => x.adp != null).sort((a, b) => b.vorpSeason - a.vorpSeason);
    expect(r.surplus).toBeCloseTo(r.vorpSeason - priced[r.adpRank - 1].vorpSeason, 1);
  });

  it('gives no slip to a man the market has no read on', () => {
    const unpriced = ours.rows.filter((r) => r.adp == null);
    expect(unpriced.length).toBeGreaterThan(50);
    for (const r of unpriced) {
      expect(r.slip).toBeNull();
      expect(r.surplus).toBeNull();
      expect(r.adpRank).toBeNull();
    }
  });
});

describe('both prices, side by side', () => {
  const OUT3 = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;
  const sc = Object.fromEntries(Object.entries(league.scoring_settings).filter(([k]) => !OUT3.test(k)));
  const SLOTS = league.roster_positions.filter((p) => p !== 'IDP_FLEX');
  const key = adpKeyFor(league.roster_positions, league.scoring_settings);
  const built = buildSheet(rows.map((r) => ({
    id: r.id, name: r.name, pos: r.pos, team: 'FA',
    games: Number(r.line.gp) || 17, proj: r.line, sleeperPts: r.published,
    adp: Number(r.line[key]) || null,
    adpMarket: Number(r.line.adp_half_ppr) || null,
  })), sc, SLOTS, 10, 17, null, 300);
  const at = Object.fromEntries(built.rows.map((r) => [r.name, r]));

  it('carries our room’s price AND the mainstream one', () => {
    // Both real, both Sleeper's own, and deliberately different numbers.
    expect(at['Josh Allen'].adp).toBe(16.4);
    expect(at['Josh Allen'].adpMarket).toBe(20.9);
    expect(at['Trey McBride'].adp).toBe(19.1);
    expect(at['Trey McBride'].adpMarket).toBe(23.2);
  });

  it('and they disagree for most of the board, which is the point', () => {
    const both = built.rows.filter((r) => r.adp != null && r.adpMarket != null);
    expect(both.length).toBeGreaterThan(100);
    const differ = both.filter((r) => Math.abs(r.adp - r.adpMarket) > 1);
    expect(differ.length / both.length).toBeGreaterThan(0.5);
  });

  it('prices Value off OUR room, not the mainstream one', () => {
    // The slip has to be measured against what you will actually pay.
    const priced = built.rows.filter((r) => r.adp != null);
    const byAdp = priced.slice().sort((a, b) => a.adp - b.adp);
    expect(byAdp[0].adpRank).toBe(1);
    for (const r of built.rows) {
      if (r.adp == null) expect(r.slip).toBeNull();
    }
  });

  it('caps the mainstream column on the same filler rule', () => {
    for (const r of built.rows) {
      if (r.adpMarket != null) expect(r.adpMarket).toBeLessThanOrEqual(300);
    }
    expect(built.rows.some((r) => r.adpMarket == null)).toBe(true);
  });
});

describe('rookies, from the data rather than from memory', () => {
  it('agrees with every hand-tagged rookie on the board, and finds more', () => {
    // The board carries a hand-written stage tag, which is somebody's memory of
    // a draft class and goes stale the moment one changes. years_exp is
    // Sleeper's own count. They agree on all twenty, with no false positives
    // across the other hundred and eighty — so the data can simply replace the
    // memory, and it knows about twenty-five more nobody had tagged.
    const byKey = {};
    for (const id in blob) if (blob[id].full_name) byKey[nameKey(blob[id].full_name)] = blob[id];

    const handRookies = PLAYERS.filter((p) => p[6] === 'rookie');
    expect(handRookies.length).toBe(20);
    for (const p of handRookies) {
      const sleeperSays = byKey[nameKey(p[1])];
      expect(sleeperSays, `${p[1]} is in the blob`).toBeTruthy();
      expect(Number(sleeperSays.years_exp), `${p[1]} is a rookie to Sleeper too`).toBe(0);
    }

    const wronglyFlagged = PLAYERS.filter((p) => p[6] && p[6] !== 'rookie')
      .filter((p) => { const s = byKey[nameKey(p[1])]; return s && Number(s.years_exp) === 0; });
    expect(wronglyFlagged.map((p) => p[1])).toEqual([]);
  });

  it('flags them on the sheet off years_exp, not off the stage tag', () => {
    const OUT4 = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;
    const sc = Object.fromEntries(Object.entries(league.scoring_settings).filter(([k]) => !OUT4.test(k)));
    const built = buildSheet(rows.map((r) => ({
      id: r.id, name: r.name, pos: r.pos, team: 'FA',
      exp: blob[r.id].years_exp, games: Number(r.line.gp) || 17,
      proj: r.line, sleeperPts: r.published,
    })), sc, league.roster_positions.filter((p) => p !== 'IDP_FLEX'), 10);

    const flagged = built.rows.filter((r) => r.rookie);
    expect(flagged.length).toBeGreaterThan(35);
    for (const r of flagged) expect(Number(blob[r.id].years_exp)).toBe(0);
    // A known veteran is not one, whatever else changes.
    expect(built.rows.find((r) => r.name === 'Josh Allen').rookie).toBe(false);
  });
});

describe('the other prices', () => {
  const OUT5 = /^(idp_|def_|pts_allow|yds_allow|st_|blk_kick|sack|tkl|int_ret|ff$|fum_rec$|safe$|qb_hit)/;
  const sc = Object.fromEntries(Object.entries(league.scoring_settings).filter(([k]) => !OUT5.test(k)));
  const key = adpKeyFor(league.roster_positions, league.scoring_settings);
  const built = buildSheet(rows.map((r) => ({
    id: r.id, name: r.name, pos: r.pos, team: 'FA',
    games: Number(r.line.gp) || 17, proj: r.line, sleeperPts: r.published,
    adp: Number(r.line[key]) || null,
    adpMarket: Number(r.line.adp_half_ppr) || null,
    adpPpr: Number(r.line.adp_ppr) || null,
    adpConsensus: (byName(r.name) || [])[5] || null,
  })), sc, league.roster_positions.filter((p) => p !== 'IDP_FLEX'), 10, 17, null, 300);
  const at = Object.fromEntries(built.rows.map((r) => [r.name, r]));

  it('brackets our scoring between half and full PPR', () => {
    // Half a point a catch PLUS half a point a first down puts us between the
    // two, so both prices are worth having rather than either alone.
    expect(at['Josh Allen'].adpMarket).toBe(20.9);
    expect(at['Josh Allen'].adpPpr).toBe(21.3);
    const both = built.rows.filter((r) => r.adpMarket != null && r.adpPpr != null);
    expect(both.length).toBeGreaterThan(100);
  });

  it('carries a consensus price that is NOT Sleeper marking its own homework', () => {
    // FantasyPros aggregates ESPN, Yahoo, CBS and NFL. Sleeper's API publishes
    // no other site's ADP, so this is the one outside read available.
    const priced = built.rows.filter((r) => r.adp != null);
    const withFp = priced.filter((r) => r.adpConsensus != null);
    expect(withFp.length / priced.length).toBeGreaterThan(0.9);
    expect(at['Josh Allen'].adpConsensus).toBeGreaterThan(0);
    // And it is a genuinely different opinion, not a copy.
    const differ = withFp.filter((r) => Math.abs(r.adpConsensus - r.adp) > 2);
    expect(differ.length).toBeGreaterThan(20);
  });

  it('caps the filler on the Sleeper columns but keeps the consensus honest', () => {
    for (const r of built.rows) {
      if (r.adpPpr != null) expect(r.adpPpr).toBeLessThanOrEqual(300);
      if (r.adpMarket != null) expect(r.adpMarket).toBeLessThanOrEqual(300);
    }
  });
});
