// THE DRAFT VAULT — known answers for pick fates, hold rates and the board.
import { describe, it, expect } from 'vitest';
import {
  toVaultPicks, ownerNowMap, fatePicks, vaultRows, poachLines,
  vaultGrid, slotOrder, vaultHeadline,
} from '../src/lib/engine/draftvault';
import PICKS_2025 from '../src/lib/api/fixtures/draft-picks-2025.json';
import PICKS_2024 from '../src/lib/api/fixtures/draft-picks-2024.json';
import ROSTERS_2026 from '../src/lib/api/fixtures/rosters-2026.json';

// A 2-team, 2-round snake by hand, so every number below is checkable by eye.
const raw = (over, round, slot, rid, pid, first, last, pos) => ({
  pick_no: over, round, draft_slot: slot, roster_id: rid, player_id: pid,
  metadata: { first_name: first, last_name: last, position: pos, team: 'NYJ' },
});
const RAW = [
  raw(1, 1, 1, 10, 'p1', 'Ada', 'One', 'RB'),
  raw(2, 1, 2, 20, 'p2', 'Bo', 'Two', 'WR'),
  raw(3, 2, 2, 20, 'p3', 'Cy', 'Three', 'QB'),
  raw(4, 2, 1, 10, 'p4', 'Di', 'Four', 'TE'),
];
const HANDLES = { 10: 'ryan', 20: 'josh' };

describe('toVaultPicks', () => {
  it('reads the name and position out of Sleeper pick metadata', () => {
    const picks = toVaultPicks(RAW);
    expect(picks).toHaveLength(4);
    expect(picks[0]).toMatchObject({ name: 'Ada One', pos: 'RB', team: 'NYJ', round: 1, slot: 1, overall: 1, rosterId: 10 });
  });

  it('sorts by overall pick and drops rows with no player attached', () => {
    const picks = toVaultPicks([RAW[3], RAW[0], { round: 9, pick_no: 99 }]);
    expect(picks.map((p) => p.overall)).toEqual([1, 4]);
  });

  it('falls back to the player id when metadata carries no name', () => {
    const picks = toVaultPicks([{ pick_no: 1, round: 1, draft_slot: 1, roster_id: 1, player_id: '4046' }]);
    expect(picks[0].name).toBe('4046');
    expect(picks[0].pos).toBe('');
  });
});

describe('fatePicks', () => {
  // ryan kept p1 and lost p4 to josh; josh kept p2; p3 is off every roster.
  const NOW = ownerNowMap([
    { roster_id: 10, players: ['p1'] },
    { roster_id: 20, players: ['p2', 'p4'] },
  ]);

  it('splits kept, poached and gone', () => {
    const fated = fatePicks(toVaultPicks(RAW), NOW);
    expect(fated.map((p) => p.fate)).toEqual(['kept', 'kept', 'gone', 'poached']);
    expect(fated[3]).toMatchObject({ fate: 'poached', heldBy: 20 });
    expect(fated[2].heldBy).toBeNull();
  });

  it('calls everything gone when no roster holds anyone', () => {
    const fated = fatePicks(toVaultPicks(RAW), {});
    expect(fated.every((p) => p.fate === 'gone')).toBe(true);
  });
});

describe('vaultRows', () => {
  const NOW = ownerNowMap([
    { roster_id: 10, players: ['p1'] },
    { roster_id: 20, players: ['p2', 'p4'] },
  ]);
  const rows = vaultRows(fatePicks(toVaultPicks(RAW), NOW), HANDLES);

  it('counts each manager 2 picks and rates the holder higher', () => {
    // josh kept p2 of his 2 (50%) and lost none; ryan kept p1 of 2 (50%) but
    // was poached once. Equal rate -> equal kept -> alphabetical by handle.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.handle)).toEqual(['josh', 'ryan']);
    expect(rows[1]).toMatchObject({ handle: 'ryan', picks: 2, kept: 1, poached: 1, gone: 0, keepRate: 50 });
    expect(rows[0]).toMatchObject({ handle: 'josh', picks: 2, kept: 1, poached: 0, gone: 1, keepRate: 50 });
  });

  it('picks the earliest still-held pick as the one worth bragging about', () => {
    expect(rows.find((r) => r.handle === 'ryan').best.name).toBe('Ada One');
  });

  it('orders by hold rate first', () => {
    // Give ryan both of his, josh neither.
    const now = ownerNowMap([{ roster_id: 10, players: ['p1', 'p4'] }]);
    const r = vaultRows(fatePicks(toVaultPicks(RAW), now), HANDLES);
    expect(r[0]).toMatchObject({ handle: 'ryan', keepRate: 100 });
    expect(r[1]).toMatchObject({ handle: 'josh', keepRate: 0, best: null });
  });
});

describe('poachLines', () => {
  it('names who took whom off whom, earliest pick first', () => {
    const NOW = ownerNowMap([{ roster_id: 20, players: ['p1', 'p4'] }]);
    const lines = poachLines(fatePicks(toVaultPicks(RAW), NOW), HANDLES);
    expect(lines.map((l) => [l.pick.name, l.from, l.to])).toEqual([
      ['Ada One', 'ryan', 'josh'],
      ['Di Four', 'ryan', 'josh'],
    ]);
  });

  it('honours the limit', () => {
    const NOW = ownerNowMap([{ roster_id: 20, players: ['p1', 'p4'] }]);
    expect(poachLines(fatePicks(toVaultPicks(RAW), NOW), HANDLES, HANDLES, 1)).toHaveLength(1);
  });

  it('names the holder from the second map when ids were renumbered', () => {
    const NOW = ownerNowMap([{ roster_id: 20, players: ['p1'] }]);
    const lines = poachLines(fatePicks(toVaultPicks(RAW), NOW), { 10: 'ryan' }, { 20: 'josh-2026' });
    expect(lines[0]).toMatchObject({ from: 'ryan', to: 'josh-2026' });
  });
});

describe('vaultGrid', () => {
  it('lays the picks out round by round, slot by slot', () => {
    const grid = vaultGrid(toVaultPicks(RAW), 2);
    expect(grid).toHaveLength(2);
    expect(grid[0].map((c) => c && c.name)).toEqual(['Ada One', 'Bo Two']);
    // Round 2 snakes back, but the SLOT is what places a cell, so ryan (slot 1)
    // stays in column 1 even though he picked 4th overall.
    expect(grid[1].map((c) => c && c.name)).toEqual(['Di Four', 'Cy Three']);
  });

  it('leaves holes null when a round is part-finished', () => {
    const grid = vaultGrid(toVaultPicks([RAW[0], RAW[1], RAW[2]]), 2);
    expect(grid[1]).toEqual([null, expect.objectContaining({ name: 'Cy Three' })]);
  });

  it('returns nothing for a league with no teams', () => {
    expect(vaultGrid(toVaultPicks(RAW), 0)).toEqual([]);
  });
});

describe('slotOrder', () => {
  it('reads the round-1 order off the picks', () => {
    expect(slotOrder(toVaultPicks(RAW), 2)).toEqual([10, 20]);
  });

  it('pads slots nobody picked in', () => {
    expect(slotOrder(toVaultPicks([RAW[0]]), 3)).toEqual([10, null, null]);
  });
});

describe('vaultHeadline', () => {
  it('states the league-wide hold rate and names the best holder', () => {
    const rows = [
      { handle: 'ryan', picks: 4, kept: 3, poached: 1, gone: 0, keepRate: 75, rosterId: 1, best: null },
      { handle: 'josh', picks: 4, kept: 1, poached: 0, gone: 3, keepRate: 25, rosterId: 2, best: null },
    ];
    const line = vaultHeadline(rows, '2025');
    expect(line).toContain('4 of the 8 players taken in the 2025 draft');
    expect(line).toContain('(50%)');
    expect(line).toContain('ryan has held the most: 3 of 4');
  });

  it('says so when there is no draft yet', () => {
    expect(vaultHeadline([], '2026')).toMatch(/no completed draft/i);
  });
});

// ---- the real thing: three seasons of captured Sleeper drafts ----
describe('the captured drafts', () => {
  const NOW = ownerNowMap(ROSTERS_2026);
  const handles = Object.fromEntries(ROSTERS_2026.map((r) => [r.roster_id, 'r' + r.roster_id]));

  it('reads all 150 picks of the 2025 draft with names attached', () => {
    const picks = toVaultPicks(PICKS_2025);
    expect(picks).toHaveLength(150);
    expect(picks.every((p) => p.name && p.name !== p.playerId)).toBe(true);
    expect(picks[0].overall).toBe(1);
    expect(picks[picks.length - 1].overall).toBe(150);
  });

  it('fills a square 15 x 10 board for both completed drafts', () => {
    for (const raws of [PICKS_2024, PICKS_2025]) {
      const grid = vaultGrid(toVaultPicks(raws), 10);
      expect(grid).toHaveLength(15);
      expect(grid.every((row) => row.length === 10 && row.every(Boolean))).toBe(true);
    }
  });

  it('accounts for every 2025 pick exactly once across the three fates', () => {
    const fated = fatePicks(toVaultPicks(PICKS_2025), NOW);
    const rows = vaultRows(fated, handles);
    expect(rows).toHaveLength(10);
    const total = rows.reduce((n, r) => n + r.picks, 0);
    expect(total).toBe(150);
    expect(rows.reduce((n, r) => n + r.kept + r.poached + r.gone, 0)).toBe(150);
    expect(rows.every((r) => r.keepRate >= 0 && r.keepRate <= 100)).toBe(true);
  });

  it('finds real movement between the 2024 draft and today', () => {
    const fated = fatePicks(toVaultPicks(PICKS_2024), NOW);
    expect(fated.some((p) => p.fate === 'kept')).toBe(true);
    expect(fated.some((p) => p.fate === 'gone')).toBe(true);
    // Two seasons on, somebody has changed hands.
    expect(poachLines(fated, handles).length).toBeGreaterThan(0);
  });

  it('flags the 2025 keepers Sleeper marked as kept', () => {
    const picks = toVaultPicks(PICKS_2025);
    expect(picks.filter((p) => p.isKeeper)).toHaveLength(30);
    expect(toVaultPicks(PICKS_2024).filter((p) => p.isKeeper)).toHaveLength(0);
  });
});
