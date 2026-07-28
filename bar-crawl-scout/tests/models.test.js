import { describe, it, expect } from 'vitest';
import { PLAYERS, PROJ, TEAMS, REPLACEMENT, STAGE, GROWTH } from '../src/lib/data.js';
import {
  ownerOf, isKept, isAvailable, r26, r27, windowVal, yearsLeft, needScores,
  tierFromADP, ADP_ANCHORS,
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

  it('a better-ADP rookie lands level on win-now and clear on future', () => {
    // The Tate/Pearsall shape, as a property: a rookie taken ~40 picks earlier
    // than an ascending vet should NOT trail him on a future board.
    const rookie = row('Rook', 'WR', 71, 'rookie');
    const riser = row('Riser', 'WR', 110, 'asc');
    expect(windowVal(rookie, {}, 'winnow')).toBeLessThanOrEqual(windowVal(riser, {}, 'winnow') + 1);
    expect(windowVal(rookie, {}, 'future')).toBeGreaterThan(windowVal(riser, {}, 'future'));
    expect(windowVal(rookie, {}, 'balanced')).toBeGreaterThan(windowVal(riser, {}, 'balanced'));
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

