import { describe, it, expect } from 'vitest';
import { normHandle, userHandleMap, managersFromUsers, recordsFromRosters } from '../src/api/league';

describe('league mapping', () => {
  it('normHandle maps the commissioner to Ryan and matches handles case/space-insensitively', () => {
    expect(normHandle('witherssssss')).toBe('Ryan');
    expect(normHandle('Big Withers')).toBe('Ryan');
    expect(normHandle('joshleota')).toBe('joshleota');
    expect(normHandle('WinzTheBrah')).toBe('WinzTheBrah');
    expect(normHandle('Unknown Person')).toBe('Unknown Person');
  });

  it('userHandleMap + recordsFromRosters key by handle with decimal PF', () => {
    const users = [
      { user_id: 'u1', display_name: 'joshleota', avatar: 'a1' },
      { user_id: 'u2', display_name: 'witherssssss', avatar: 'a2' },
    ];
    const uh = userHandleMap(users);
    expect(uh).toEqual({ u1: 'joshleota', u2: 'Ryan' });

    const rosters = [
      { roster_id: 1, owner_id: 'u1', players: [], starters: [], settings: { wins: 11, losses: 4, ties: 0, fpts: 2032, fpts_decimal: 56, waiver_budget_used: 20 } },
      { roster_id: 2, owner_id: 'u2', players: [], starters: [], settings: { wins: 5, losses: 10, ties: 0, fpts: 1811 } },
    ];
    const recs = recordsFromRosters(rosters, uh);
    expect(recs.joshleota.wins).toBe(11);
    expect(recs.joshleota.pf).toBeCloseTo(2032.56, 2);
    expect(recs.Ryan.losses).toBe(10);
  });

  it('managersFromUsers exposes avatar + user_id by handle', () => {
    const m = managersFromUsers([{ user_id: 'u1', display_name: 'joshleota', avatar: 'abc' }]);
    expect(m.joshleota.avatar).toBe('abc');
    expect(m.joshleota.user_id).toBe('u1');
  });
});
