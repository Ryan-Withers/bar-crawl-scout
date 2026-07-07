import { describe, it, expect } from 'vitest';
import { PLAYERS, PROJ, TEAMS, REPLACEMENT } from '../src/lib/data.js';
import {
  ownerOf, isKept, isAvailable, r26, r27, windowVal, yearsLeft, needScores,
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
