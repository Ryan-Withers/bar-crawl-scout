import { describe, it, expect } from 'vitest';
import { similarPlayers } from '../src/lib/engine/similar';

const pool = [
  { name: 'Target RB', pos: 'RB', r26: 100, adp: 10 },
  { name: 'Twin RB', pos: 'RB', r26: 101, adp: 11 },   // nearly identical
  { name: 'Far RB', pos: 'RB', r26: 40, adp: 90 },     // same pos, far away
  { name: 'Close WR', pos: 'WR', r26: 100, adp: 10 },  // identical value, wrong pos
];

describe('similar files', () => {
  it('ranks the closest same-position peer first', () => {
    const peers = similarPlayers(pool[0], pool, 3);
    expect(peers[0].name).toBe('Twin RB');
  });

  it('keeps same-position peers ahead of any off-position peer', () => {
    const peers = similarPlayers(pool[0], pool, 3);
    const wrIdx = peers.findIndex((p) => p.pos === 'WR');
    const farRbIdx = peers.findIndex((p) => p.name === 'Far RB');
    expect(farRbIdx).toBeLessThan(wrIdx); // Far RB (same pos) still beats identical-value WR
  });

  it('excludes the target itself and honours k', () => {
    const peers = similarPlayers(pool[0], pool, 2);
    expect(peers).toHaveLength(2);
    expect(peers.some((p) => p.name === 'Target RB')).toBe(false);
  });
});
