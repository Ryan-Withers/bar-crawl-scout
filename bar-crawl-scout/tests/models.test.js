import { describe, it, expect } from 'vitest';
import { PLAYERS, PROJ, TEAMS, REPLACEMENT, STAGE, GROWTH } from '../src/lib/data.js';
import {
  ownerOf, isKept, isAvailable, r26, r27, windowVal, yearsLeft, needScores,
  tierFromADP, ADP_ANCHORS, rookieYearOne, ROOKIE_Y1, stageMult, stageYear2,
} from '../src/lib/models.js';

// Build the keeper map exactly as the app does: start from PROJ, pad to 4 slots
// per team, and force the 4th (watch) slot to "U".
function initKS() {
  const ks = JSON.parse(JSON.stringify(PROJ));
  for (const t of TEAMS) {
    if (!ks[t[0]]) ks[t[0]] = [];
    while (ks[t[0]].length < 4) ks[t[0]].push(['', '']);
    if (ks[t[0]][3][0]) ks[t[0]][3] = [ks[t[0]][3][0], 'U'];
  }
  return ks;
}
const KS = initKS();

// Authoritative 2026 keepers (mirrors the legacy suite).
const EXPECT = {
  joshleota: { 'Jahmyr Gibbs': 'VL', 'Puka Nacua': 'VL', 'Drake London': 'VL', 'Justin Jefferson': 'U' },
  WinzTheBrah: { 'James Cook': 'VL', 'Breece Hall': 'VL', 'A.J. Brown': 'L', 'Garrett Wilson': 'U' },
  JohnnyDuff: { 'Ashton Jeanty': 'VL', "De'Von Achane": 'VL', 'Jaxon Smith-Njigba': 'VL', 'Trey McBride': 'U' },
  jduddy9: { 'Omarion Hampton': 'VL', 'Christian McCaffrey': 'VL', 'Rashee Rice': 'L', 'Derrick Henry': 'U' },
  jpdonners: { 'CeeDee Lamb': 'VL', 'Josh Jacobs': 'VL', 'Travis Etienne Jr.': 'L', 'Jordan Addison': 'U' },
  ATorelli4: { 'Amon-Ra St. Brown': 'VL', 'TreVeyon Henderson': 'VL', 'Kenneth Walker III': 'L', 'Drake Maye': 'U' },
  JShrimp341: { 'Saquon Barkley': 'VL', 'Chase Brown': 'VL', 'Kyren Williams': 'VL', 'Tyler Warren': 'U' },
  ShaydenB: { 'Jonathan Taylor': 'VL', 'Nico Collins': 'VL', 'Quinshon Judkins': 'L', 'DeVonta Smith': 'U' },
  ImyHunter: { 'Bijan Robinson': 'VL', 'Malik Nabers': 'VL', 'Emeka Egbuka': 'L', 'Cam Skattebo': 'U' },
};
const RYAN_KEEPERS = ['Tetairoa McMillan', "Ja'Marr Chase", 'Brock Bowers'];
const byName = nm => PLAYERS.find(p => p[1] === nm);

describe('keeper integrity', () => {
  it('every projected keeper resolves to the right owner and confidence', () => {
    for (const h of Object.keys(EXPECT)) {
      for (const nm of Object.keys(EXPECT[h])) {
        const o = ownerOf(KS, nm);
        expect(o, `${nm} should be owned`).toBeTruthy();
        expect(o.owner, `${nm} owner`).toBe(h);
        expect(o.conf, `${nm} confidence`).toBe(EXPECT[h][nm]);
      }
    }
  });

  it("Ryan's three keepers are his, and stay classified to Ryan", () => {
    for (const nm of RYAN_KEEPERS) {
      expect(ownerOf(KS, nm)?.owner).toBe('Ryan');
    }
  });

  it('no player is a VL/L keeper for two teams', () => {
    const seen = {};
    let dup = 0;
    for (const t of TEAMS) for (const s of (KS[t[0]] || [])) {
      if (s[0] && s[1] !== 'U') { if (seen[s[0]]) dup++; else seen[s[0]] = t[0]; }
    }
    expect(dup).toBe(0);
  });

  it('Justin Jefferson is only a watch (U), never a real keeper, and stays in the pool', () => {
    expect(isKept(KS, 'Justin Jefferson')).toBe(false);
    expect(isAvailable(KS, 'Justin Jefferson')).toBe(true);
    expect(ownerOf(KS, 'Justin Jefferson')).toEqual({ owner: 'joshleota', conf: 'U' });
  });
});

describe('valuation model', () => {
  it("a final-year keeper's R27 is the replacement value, not zero", () => {
    expect(yearsLeft("Ja'Marr Chase")).toBe(1); // kept in 2025, so final year in 2026
    expect(r27(byName("Ja'Marr Chase"), KS)).toBe(REPLACEMENT);
  });

  it('an unkept 2-year player keeps a real R27', () => {
    const jeanty = byName('Ashton Jeanty'); // yr2, not previously kept
    expect(r27(jeanty, KS)).toBeGreaterThan(REPLACEMENT);
  });

  it('WIN weights the window mode: win-now leans on 2026', () => {
    const chase = byName("Ja'Marr Chase");
    // winnow weights (1.0, 0.15): r26 + 0.15*52
    expect(windowVal(chase, KS, 'winnow')).toBe(Math.round(r26(chase) * 1.0 + REPLACEMENT * 0.15));
    // a genuine two-year phenom should out-score him in balanced mode
    const jeanty = byName('Ashton Jeanty');
    expect(windowVal(jeanty, KS, 'balanced')).toBeGreaterThan(windowVal(chase, KS, 'balanced'));
  });
});

describe('roster need', () => {
  it('scores each position 0..10 from the kept starters', () => {
    const ns = needScores(KS, 'joshleota');
    for (const k of ['QB', 'RB', 'WR', 'TE']) {
      expect(ns[k]).toBeGreaterThanOrEqual(0);
      expect(ns[k]).toBeLessThanOrEqual(10);
    }
  });
});

// A player row is [rank, name, pos, team, bye, adp, stage].
const row = (name, pos, adp, stage) => [0, name, pos, 'X', 5, adp, stage];

describe('the ADP talent curve', () => {
  it('hits every anchor exactly — the old tier numbers still mean what they meant', () => {
    for (const [adp, want] of ADP_ANCHORS) expect(tierFromADP(adp)).toBeCloseTo(want, 6);
  });

  it('never rewards a WORSE ADP, anywhere on the board', () => {
    for (let a = 1; a < 260; a++) expect(tierFromADP(a)).toBeGreaterThanOrEqual(tierFromADP(a + 1));
  });

  it('separates players the staircase used to call identical', () => {
    // The exact defect: 61 and 110 both scored 48, so ~50 picks of ADP were
    // invisible and a stage multiplier alone decided the order inside a tier.
    expect(tierFromADP(61)).toBeGreaterThan(tierFromADP(110));
    expect(tierFromADP(71.3)).toBeGreaterThan(tierFromADP(110));
    expect(tierFromADP(61) - tierFromADP(110)).toBeGreaterThan(15);
  });

  it('has no cliff at a boundary — one pick can\'t cost 15 points any more', () => {
    for (const edge of [12, 30, 60, 110, 160, 200]) {
      expect(Math.abs(tierFromADP(edge) - tierFromADP(edge + 1))).toBeLessThan(1);
    }
  });

  it('clamps both ends instead of running off the scale', () => {
    expect(tierFromADP(0)).toBe(100);
    expect(tierFromADP(-5)).toBe(100);
    expect(tierFromADP(9999)).toBe(12);
    expect(tierFromADP(undefined)).toBe(12);
  });
});

describe('a rookie is priced as the player he becomes', () => {
  it('gains more into 2027 than the risers he is about to join', () => {
    // rookie -> sophomore is the steepest step on the curve. It used to read
    // 1.10, BELOW yr2 and asc, which is what sank rookies on a future board.
    expect(STAGE.rookie[1]).toBeGreaterThan(STAGE.yr2[1]);
    expect(STAGE.rookie[1]).toBeGreaterThan(STAGE.asc[1]);
    expect(GROWTH.rookie).toBeGreaterThan(GROWTH.yr2);
  });

  it('is still discounted for 2026 — year one is genuinely a risk', () => {
    expect(STAGE.rookie[0]).toBeLessThan(1);
    expect(STAGE.rookie[0]).toBeLessThan(STAGE.prime[0]);
  });

  it('a better-ADP rookie lands level on 2026 and clear on future', () => {
    // The Tate/Pearsall shape, as a property. A rookie taken ~40 picks earlier
    // than an ascending vet should land LEVEL on the 2026-only column — that's
    // where win-now truth lives — and clear of him once 2027 counts.
    const rookie = row('Rook', 'WR', 71, 'rookie');
    const riser = row('Riser', 'WR', 110, 'asc');
    expect(Math.abs(r26(rookie) - r26(riser))).toBeLessThanOrEqual(1);
    expect(windowVal(rookie, {}, 'future')).toBeGreaterThan(windowVal(riser, {}, 'future'));
    expect(windowVal(rookie, {}, 'balanced')).toBeGreaterThan(windowVal(riser, {}, 'balanced'));
    // Win-now still counts 2027 at 15% as a tiebreak, so level-on-2026 plus a
    // much better 2027 nudges the rookie ahead. Only just, though.
    expect(windowVal(rookie, {}, 'winnow')).toBeGreaterThan(windowVal(riser, {}, 'winnow'));
    expect(windowVal(rookie, {}, 'winnow') - windowVal(riser, {}, 'winnow')).toBeLessThan(8);
  });

  it('does not flip the board: a same-ADP rookie still trails a prime vet on win-now', () => {
    const rookie = row('Rook', 'WR', 71, 'rookie');
    const vet = row('Vet', 'WR', 71, 'prime');
    expect(windowVal(rookie, {}, 'winnow')).toBeLessThan(windowVal(vet, {}, 'winnow'));
    expect(windowVal(rookie, {}, 'future')).toBeGreaterThan(windowVal(vet, {}, 'future'));
  });

  it('and ADP still outranks stage — a first-rounder beats a late rookie everywhere', () => {
    const stud = row('Stud', 'WR', 6, 'prime');
    const lateRook = row('Late', 'WR', 150, 'rookie');
    for (const m of ['winnow', 'balanced', 'future']) {
      expect(windowVal(stud, {}, m)).toBeGreaterThan(windowVal(lateRook, {}, m));
    }
  });
});

describe('the rookie year-one discount scales with draft capital', () => {
  it('is a curve, not a constant', () => {
    expect(rookieYearOne(1)).toBeGreaterThan(rookieYearOne(150));
    expect(rookieYearOne(25)).toBeGreaterThan(rookieYearOne(75));
    expect(rookieYearOne(75)).toBeGreaterThan(rookieYearOne(125));
  });

  it('never rises with a worse ADP', () => {
    for (let a = 1; a < 200; a++) expect(rookieYearOne(a)).toBeGreaterThanOrEqual(rookieYearOne(a + 1));
  });

  it('hits its anchors and clamps outside them', () => {
    expect(rookieYearOne(ROOKIE_Y1[0][0])).toBeCloseTo(ROOKIE_Y1[0][1], 6);
    expect(rookieYearOne(ROOKIE_Y1[1][0])).toBeCloseTo(ROOKIE_Y1[1][1], 6);
    expect(rookieYearOne(0)).toBeCloseTo(ROOKIE_Y1[0][1], 6);
    expect(rookieYearOne(999)).toBeCloseTo(ROOKIE_Y1[1][1], 6);
    expect(rookieYearOne(undefined)).toBeCloseTo(ROOKIE_Y1[1][1], 6);
  });

  it('discounts every rookie, even the first one off the board', () => {
    for (const a of [1, 25, 75, 150, 250]) {
      expect(rookieYearOne(a)).toBeGreaterThan(0);
      expect(rookieYearOne(a)).toBeLessThan(1);
    }
  });

  it('only the rookie row bends with ADP — 2026 is a flat table for everyone else', () => {
    for (const s of ['yr2', 'asc', 'prime', 'aging', 'fading', '']) {
      expect(stageMult(row('X', 'WR', 5, s))[0]).toBe(STAGE[s][0]);
      expect(stageMult(row('X', 'WR', 180, s))[0]).toBe(STAGE[s][0]);
    }
    expect(stageMult(row('X', 'WR', 5, 'rookie'))[0])
      .toBeGreaterThan(stageMult(row('X', 'WR', 180, 'rookie'))[0]);
    // 2027 is untouched by ADP — it bends with POSITION, not draft slot.
    expect(stageMult(row('X', 'WR', 5, 'rookie'))[1])
      .toBe(stageMult(row('X', 'WR', 180, 'rookie'))[1]);
  });

  it('a top-25 rookie is no longer buried by a mid-round second-year player', () => {
    // The Love/Price shape. A flat discount could exceed the ADP gap it was
    // applied over, so a rookie 30 picks better finished BEHIND on win-now.
    const earlyRookie = row('Early', 'RB', 25, 'rookie');
    const midRiser = row('Mid', 'RB', 58, 'yr2');
    expect(r26(earlyRookie)).toBeGreaterThan(r26(midRiser));
    for (const m of ['winnow', 'balanced', 'future']) {
      expect(windowVal(earlyRookie, {}, m)).toBeGreaterThan(windowVal(midRiser, {}, m));
    }
  });

  it('but a late rookie is still behind that same player, in every mode', () => {
    const lateRookie = row('Late', 'RB', 140, 'rookie');
    const midRiser = row('Mid', 'RB', 58, 'yr2');
    for (const m of ['winnow', 'balanced', 'future']) {
      expect(windowVal(lateRookie, {}, m)).toBeLessThan(windowVal(midRiser, {}, m));
    }
  });

  it('keeps rookies out of the win-now top of the board', () => {
    // A rookie should never out-score a same-position vet drafted meaningfully
    // earlier on a win-now board, however good the class is.
    const rookie = row('Rook', 'RB', 25, 'rookie');
    const stud = row('Stud', 'RB', 8, 'prime');
    expect(windowVal(rookie, {}, 'winnow')).toBeLessThan(windowVal(stud, {}, 'winnow'));
  });
});

describe('positional age curves', () => {
  const DECLINING = ['prime', 'aging', 'fading'];
  const GROWING = ['rookie', 'yr2', 'asc'];

  it('nobody is flat across a year any more — prime included', () => {
    // The defect this fixes: "prime" meant x1.00, so 89% of the board (and 53
    // of 61 RBs) carried its full value across the two-year keeper window.
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      for (const s of DECLINING) expect(stageYear2(s, pos)).toBeLessThan(1);
    }
  });

  it('a back declines fastest and a quarterback slowest, at every stage', () => {
    for (const s of DECLINING) {
      expect(stageYear2(s, 'RB')).toBeLessThan(stageYear2(s, 'WR'));
      expect(stageYear2(s, 'WR')).toBeLessThan(stageYear2(s, 'TE'));
      expect(stageYear2(s, 'TE')).toBeLessThan(stageYear2(s, 'QB'));
    }
  });

  it('and a back has the least growth left, a tight end the most', () => {
    for (const s of GROWING) {
      expect(stageYear2(s, 'RB')).toBeLessThan(stageYear2(s, 'WR'));
      expect(stageYear2(s, 'WR')).toBeLessThan(stageYear2(s, 'TE'));
      expect(stageYear2(s, 'RB')).toBeGreaterThan(1); // still growth, just less
    }
  });

  it('keeps the stages in order within a position', () => {
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      const order = ['rookie', 'yr2', 'asc', 'prime', 'aging', 'fading'];
      for (let i = 1; i < order.length; i++) {
        expect(stageYear2(order[i], pos)).toBeLessThan(stageYear2(order[i - 1], pos));
      }
    }
  });

  it('an aging back sheds far more than an aging quarterback', () => {
    expect(1 - stageYear2('aging', 'RB')).toBeGreaterThan(2 * (1 - stageYear2('aging', 'QB')));
  });

  it('falls back to the flat table for an unknown position', () => {
    for (const s of [...DECLINING, ...GROWING]) {
      expect(stageYear2(s, 'K')).toBeCloseTo(STAGE[s][1], 6);
      expect(stageYear2(s, undefined)).toBeCloseTo(STAGE[s][1], 6);
    }
  });

  it('a rookie back is readier in year one than a rookie receiver', () => {
    expect(rookieYearOne(50, 'RB')).toBeGreaterThan(rookieYearOne(50, 'WR'));
    expect(rookieYearOne(50, 'WR')).toBeGreaterThan(rookieYearOne(50, 'TE'));
  });

  it('but no rookie is ever a free bet, however early or however RB', () => {
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      expect(rookieYearOne(1, pos)).toBeLessThan(1);
      expect(rookieYearOne(1, pos)).toBeGreaterThan(0);
    }
  });

  it('the Hubbard/Tate shape: the back wins now, the receiver wins the window', () => {
    // Same ADP, a prime RB against a rookie WR. Each should win the mode that
    // is actually about him — which the old flat model could not express.
    const back = row('Back', 'RB', 72, 'prime');
    const rookieWR = row('Wideout', 'WR', 72, 'rookie');
    expect(windowVal(back, {}, 'winnow')).toBeGreaterThan(windowVal(rookieWR, {}, 'winnow'));
    expect(windowVal(rookieWR, {}, 'balanced')).toBeGreaterThan(windowVal(back, {}, 'balanced'));
    expect(windowVal(rookieWR, {}, 'future')).toBeGreaterThan(windowVal(back, {}, 'future'));
  });

  it('an old back and an old quarterback at the same ADP diverge by 2027', () => {
    const oldRB = row('OldBack', 'RB', 40, 'aging');
    const oldQB = row('OldArm', 'QB', 40, 'aging');
    expect(r26(oldRB)).toBe(r26(oldQB));            // level today
    expect(r27(oldQB, {})).toBeGreaterThan(r27(oldRB, {})); // not in a year
  });
});

