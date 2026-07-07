import { describe, it, expect } from 'vitest';
import { liveToStore, SYNC_URL } from '../src/lib/sleeper.js';

describe('live sync adapter', () => {
  it('maps Worker {ts,rosters} to the roster store {t,byHandle}', () => {
    const out = liveToStore({
      ts: '2026-07-07T00:00:00Z',
      rosters: { joshleota: { count: 1, players: [{ n: 'Chris Olave', p: 'WR', t: 'NO', s: true }] } },
    });
    expect(out.t).toBe('2026-07-07T00:00:00Z');
    expect(out.byHandle.joshleota.players[0].n).toBe('Chris Olave');
  });

  it('handles empty / missing payloads without throwing', () => {
    expect(liveToStore(null)).toEqual({ t: '', byHandle: {} });
    expect(liveToStore({})).toEqual({ t: '', byHandle: {} });
  });

  it('is configured with the deployed Worker URL', () => {
    expect(typeof SYNC_URL).toBe('string');
    expect(SYNC_URL).toContain('workers.dev');
  });
});
