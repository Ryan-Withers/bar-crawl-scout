import { describe, it, expect } from 'vitest';
import { indexPlayers } from '../src/api/players';

describe('indexPlayers', () => {
  it('compacts the raw Sleeper blob to [name, pos, team] keyed by id', () => {
    const raw = {
      '4046': { player_id: '4046', full_name: 'Patrick Mahomes', position: 'QB', team: 'KC', age: 30, years_exp: 8 },
      '7': { first_name: 'CeeDee', last_name: 'Lamb', position: 'WR', team: 'DAL' },
      'x': { last_name: 'OnlyLast', position: 'TE', team: null },
      'nameless': { position: 'RB' },
    };
    const out = indexPlayers(raw);
    expect(out['4046']).toEqual(['Patrick Mahomes', 'QB', 'KC', 30, 8]);
    expect(out['7']).toEqual(['CeeDee Lamb', 'WR', 'DAL', null, null]); // absent, not invented
    expect(out['x']).toEqual(['OnlyLast', 'TE', 'FA', null, null]); // null team -> FA
    expect(out['nameless']).toBeUndefined(); // no name -> skipped
  });

  it('keeps a rookie\'s years_exp of 0 rather than losing it to a falsy check', () => {
    const out = indexPlayers({ r: { full_name: 'Rook', position: 'WR', team: 'NYJ', age: 22, years_exp: 0 } });
    expect(out.r[4]).toBe(0);
  });
});
