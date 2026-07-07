import { describe, it, expect } from 'vitest';
import { buildGameLog, keyLine, logTotals, bestWeek } from '../src/lib/engine/gamelog';
import scoring from '../src/lib/api/fixtures/league-scoring.json';

const wrWeeks = [
  { week: 1, opp: 'CIN', stats: { rec: 8, rec_yd: 112, rec_td: 1, gms_active: 1 } }, // 21.2
  { week: 2, opp: 'BAL', stats: { rec: 4, rec_yd: 40, gms_active: 1 } }, // 6
  { week: 3, opp: 'PIT', stats: null }, // DNP
  { week: 4, opp: 'CLE', stats: { rec: 10, rec_yd: 150, rec_td: 2, gms_active: 1 } }, // 32
];

describe('game log', () => {
  it('scores each week through the engine and marks DNP', () => {
    const log = buildGameLog(wrWeeks, scoring, 'WR');
    expect(log[0]).toMatchObject({ week: 1, opp: 'CIN', pts: 21.2, dnp: false });
    expect(log[0].line).toBe('8 rec, 112 yd, 1 TD');
    expect(log[1].pts).toBe(6);
    expect(log[2].dnp).toBe(true);
    expect(log[3].pts).toBe(32);
  });

  it('picks a position-appropriate key line', () => {
    expect(keyLine({ pass_yd: 305, pass_td: 3, pass_int: 1 }, 'QB')).toBe('305 pass yd, 3 TD, 1 INT');
    expect(keyLine({ rush_att: 18, rush_yd: 96, rush_td: 1 }, 'RB')).toBe('18 att, 96 yd, 1 TD');
    expect(keyLine({ rec: 8, rec_yd: 112, rec_td: 1 }, 'WR')).toBe('8 rec, 112 yd, 1 TD');
  });

  it('season totals + best week', () => {
    const log = buildGameLog(wrWeeks, scoring, 'WR');
    const t = logTotals(log);
    expect(t.games).toBe(3);
    expect(t.points).toBe(59.2);
    expect(t.ppg).toBe(19.7);
    expect(bestWeek(log)).toBe(4);
  });
});
