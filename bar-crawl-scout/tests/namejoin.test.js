// THE NAME JOIN — our board's spelling vs Sleeper's.
//
// Sleeper drops the generational suffix ("Kenneth Walker", "Brian Thomas");
// the board keeps it, as the broadcast does. Every join between the two — live
// rosters, keepers, projections, ownership badges — went through a raw
// lowercase compare, so eighteen of the top 200 silently failed to match and
// fell back to a flat positional guess and bye week 0.
//
// These tests reconcile against the CAPTURED player blob, so they fail the day
// Sleeper changes how it spells somebody rather than the day someone edits a
// constant.
import { describe, it, expect } from 'vitest';
import blob from '../src/lib/api/fixtures/players-trimmed.json';
import { PLAYERS, BYUNAME, byName, nameKey } from '../src/lib/data.js';
import { buildRosterOwn, rosterOwner, ownerOf } from '../src/lib/models.js';

const sleeperNames = Object.values(blob).map((p) => p.full_name).filter(Boolean);
const sleeperKeys = new Set(sleeperNames.map(nameKey));

describe('nameKey', () => {
  it('strips the suffix Sleeper does not carry', () => {
    expect(nameKey('Kenneth Walker III')).toBe(nameKey('Kenneth Walker'));
    expect(nameKey('Brian Thomas Jr.')).toBe(nameKey('Brian Thomas'));
    expect(nameKey('Patrick Mahomes II')).toBe(nameKey('Patrick Mahomes'));
    expect(nameKey('Deebo Samuel Sr.')).toBe(nameKey('Deebo Samuel'));
  });

  it('drops apostrophes and full stops, straight or curly', () => {
    expect(nameKey("Ja'Marr Chase")).toBe(nameKey('JaMarr Chase'));
    expect(nameKey('Ja’Marr Chase')).toBe(nameKey("Ja'Marr Chase"));
    expect(nameKey('A.J. Brown')).toBe(nameKey('AJ Brown'));
  });

  it('does NOT eat a real surname that merely looks like a suffix', () => {
    // "V" and "Ivy" are not suffixes in the middle of a name, and a one-word
    // name must survive intact rather than being normalised to nothing.
    expect(nameKey('Vita Vea')).toBe('vita vea');
    expect(nameKey('Ivy')).toBe('ivy');
  });

  it('is safe on rubbish input', () => {
    expect(nameKey(null)).toBe('');
    expect(nameKey(undefined)).toBe('');
    expect(nameKey('   ')).toBe('');
  });
});

describe('the board joins to Sleeper', () => {
  it('every board row but one resolves against the captured blob', () => {
    const missing = PLAYERS.filter((p) => !sleeperKeys.has(nameKey(p[1]))).map((p) => p[1]);
    // Kenneth Gainwell is genuinely outside the captured top-600 and unrostered,
    // so he is absent from the blob rather than misspelled in it.
    expect(missing).toEqual(['Kenneth Gainwell']);
  });

  it('the eighteen suffixed men resolve from SLEEPER\'s spelling', () => {
    const suffixed = PLAYERS.filter((p) => /\s(Jr\.|Sr\.|II|III|IV)$/.test(p[1]));
    expect(suffixed.length).toBeGreaterThanOrEqual(18);
    for (const p of suffixed) {
      const sleeperSpelling = p[1].replace(/\s(Jr\.|Sr\.|II|III|IV)$/, '');
      expect(byName(sleeperSpelling), `${p[1]} via "${sleeperSpelling}"`).not.toBeNull();
      expect(byName(sleeperSpelling)[1]).toBe(p[1]);
    }
  });

  it('still resolves our own spelling exactly', () => {
    for (const p of PLAYERS) expect(byName(p[1])[1]).toBe(p[1]);
  });

  it('returns null for a man who is not on the board at all', () => {
    expect(byName('Some Nobody')).toBeNull();
    expect(byName('')).toBeNull();
    expect(byName(null)).toBeNull();
  });

  it('BYUNAME keeps the exact spelling as well as the normalised one', () => {
    expect(BYUNAME['kenneth walker iii'][1]).toBe('Kenneth Walker III');
    expect(BYUNAME[nameKey('Kenneth Walker')][1]).toBe('Kenneth Walker III');
  });
});

describe('live ownership survives the suffix', () => {
  const store = {
    byHandle: {
      ATorelli4: { players: [{ n: 'Kenneth Walker' }, { n: 'Amon-Ra St. Brown' }] },
      Ryan: { players: [{ n: "Ja'Marr Chase" }] },
    },
  };
  const own = buildRosterOwn(store);

  it('finds the owner whichever way the name is spelled', () => {
    expect(rosterOwner(own, 'Kenneth Walker III')).toBe('ATorelli4');
    expect(rosterOwner(own, 'Kenneth Walker')).toBe('ATorelli4');
    expect(rosterOwner(own, 'Amon-Ra St. Brown')).toBe('ATorelli4');
    expect(rosterOwner(own, "Ja'Marr Chase")).toBe('Ryan');
  });

  it('still says nothing about a man nobody rosters', () => {
    expect(rosterOwner(own, 'Bijan Robinson')).toBeNull();
  });
});

describe('keeper lookup survives the suffix', () => {
  it('matches a keeper typed either way', () => {
    const ks = { ATorelli4: [['Kenneth Walker', 'VL'], ['', ''], ['', ''], ['', '']] };
    expect(ownerOf(ks, 'Kenneth Walker III').owner).toBe('ATorelli4');
    expect(ownerOf(ks, 'Kenneth Walker').owner).toBe('ATorelli4');
  });
});

describe('NFL team codes match Sleeper', () => {
  it('uses no abbreviation Sleeper has never heard of', () => {
    const sleeperTeams = new Set(Object.values(blob).map((p) => p.team).filter(Boolean));
    const ours = new Set(PLAYERS.map((p) => p[3]).filter((t) => t && t !== 'FA'));
    // Jacksonville is JAX to Sleeper. Spelling it JAC keyed the bye-week table
    // under a code no synced player ever carries, so every Jaguar came back with
    // no bye week at all.
    expect([...ours].filter((t) => !sleeperTeams.has(t))).toEqual([]);
  });

  it('gives every Jaguar his real bye week', () => {
    const jax = PLAYERS.filter((p) => p[3] === 'JAX');
    expect(jax.length).toBeGreaterThan(0);
    for (const p of jax) expect(p[4], `${p[1]} has a bye`).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
import users2026 from '../src/lib/api/fixtures/users-2026.json';
import rosters2025 from '../src/lib/api/fixtures/rosters-2025.json';
import users2025 from '../src/lib/api/fixtures/users-2025.json';
import { TEAMS, MGRS } from '../src/lib/data.js';
import { normHandle } from '../src/api/league';

describe('the hand-written league facts still match Sleeper', () => {
  it('every team name is the one the manager actually uses', () => {
    // Ryan renamed his team and the constant kept the old one, so nine managers
    // saw their real name and he saw a name he had stopped using.
    const live = {};
    for (const u of users2026) live[normHandle(u.display_name)] = u.metadata?.team_name;
    for (const [h, name] of TEAMS) {
      expect(live[h], `${h} is a live manager`).toBeTruthy();
      expect(name.replace(' (YOU)', ''), `${h}'s team name`).toBe(live[h]);
    }
  });

  it("last season's records and points match the rosters they came from", () => {
    // Checked rather than assumed: the numbers ARE right, and the rounding is
    // right too — fpts is truncated and fpts_decimal carries the rest, so
    // comparing against fpts alone makes correct figures look drifted.
    const byHandle = {};
    const uh = Object.fromEntries(users2025.map((u) => [u.user_id, normHandle(u.display_name)]));
    for (const r of rosters2025) {
      const s = r.settings || {};
      byHandle[uh[r.owner_id]] = {
        rec: `${s.wins || 0}-${s.losses || 0}`,
        pf: Math.round((s.fpts || 0) + (s.fpts_decimal || 0) / 100),
      };
    }
    for (const m of MGRS) {
      const live = byHandle[m.h];
      expect(live, `${m.h} has a 2025 roster`).toBeTruthy();
      expect(m.rec, `${m.h} record`).toBe(live.rec);
      expect(Number(String(m.pf).replace(/[^0-9]/g, '')), `${m.h} points for`).toBe(live.pf);
    }
  });
});
