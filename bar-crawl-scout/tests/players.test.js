import { describe, it, expect } from 'vitest';
import { indexPlayers } from '../src/api/players';

describe('indexPlayers', () => {
  it('compacts the raw Sleeper blob to [name, pos, team] keyed by id', () => {
    const raw = {
      '4046': { player_id: '4046', full_name: 'Patrick Mahomes', position: 'QB', team: 'KC' },
      '7': { first_name: 'CeeDee', last_name: 'Lamb', position: 'WR', team: 'DAL' },
      'x': { last_name: 'OnlyLast', position: 'TE', team: null },
      'nameless': { position: 'RB' },
    };
    const out = indexPlayers(raw);
    expect(out['4046']).toEqual(['Patrick Mahomes', 'QB', 'KC']);
    expect(out['7']).toEqual(['CeeDee Lamb', 'WR', 'DAL']);
    expect(out['x']).toEqual(['OnlyLast', 'TE', 'FA']); // null team -> FA
    expect(out['nameless']).toBeUndefined(); // no name -> skipped
  });
});
