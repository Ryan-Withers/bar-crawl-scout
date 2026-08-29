// CONTRACT TESTS (Fable File 03, Part 1.2). Two layers:
//  1. Representative inline samples parse (schemas are correct today).
//  2. Every CAPTURED fixture parses against its schema (auto-discovered; skips
//     cleanly until the capture bot has run). When Sleeper renames a field, this
//     goes red alongside the Drift Bot.
import { describe, it, expect } from 'vitest';
import {
  SleeperLeagueSchema, SleeperUserSchema, SleeperRosterSchema, NflStateSchema,
  SleeperMatchupSchema, TrendingPlayerSchema, ScoringSettingsSchema, SCHEMAS, parseOr,
} from '../src/lib/api/schemas';
import scoring from '../src/lib/api/fixtures/league-scoring.json';

describe('schemas — representative samples', () => {
  it('league', () => expect(SleeperLeagueSchema.parse({ league_id: '1', season: '2026', scoring_settings: { rec: 0.5 }, extra_new_key: true }).league_id).toBe('1'));
  it('user', () => expect(SleeperUserSchema.parse({ user_id: 'u1', display_name: 'joshleota' }).user_id).toBe('u1'));
  it('roster (nullable owner/players)', () => expect(SleeperRosterSchema.parse({ roster_id: 3, owner_id: null, players: null }).roster_id).toBe(3));
  it('state', () => expect(NflStateSchema.parse({ week: 8, season: '2026', season_type: 'regular' }).week).toBe(8));
  it('matchup with players_points', () => expect(SleeperMatchupSchema.parse({ roster_id: 1, players_points: { '4046': 21.2 } }).players_points['4046']).toBe(21.2));
  it('trending player', () => expect(TrendingPlayerSchema.parse({ player_id: '4046', count: 900 }).count).toBe(900));
  it('the real league-scoring fixture parses', () => expect(ScoringSettingsSchema.parse(scoring).rec).toBe(0.5));
});

describe('parseOr — the degradation seam', () => {
  it('returns parsed data on a good shape', () => {
    expect(parseOr(NflStateSchema, { week: 5, season: '2026' }, { week: 0, season: '' }).week).toBe(5);
  });
  it('returns the fallback on a bad shape instead of throwing', () => {
    expect(parseOr(NflStateSchema, { nope: true }, { week: 0, season: '' }).week).toBe(0);
  });
});

// Contract test over captured fixtures (skips until the capture bot has run).
const files = import.meta.glob('../src/lib/api/fixtures/*.json', { eager: true, import: 'default' });
const named = Object.entries(files)
  .map(([p, data]) => [p.match(/([a-z-]+)(?:-\d.*)?\.json$/)?.[1], data])
  .filter(([base]) => base && SCHEMAS[base]);

describe.skipIf(named.filter(([b]) => b !== 'league-scoring').length === 0)('captured fixtures parse against their schema', () => {
  for (const [base, data] of named) {
    it(`${base} fixture matches schema`, () => {
      const r = SCHEMAS[base].safeParse(data);
      if (!r.success) throw new Error(`${base}: ${r.error.issues.slice(0, 3).map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
      expect(r.success).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// The two fields the whole keeper rework stands on. Declared in the schema so
// drift-check notices if Sleeper renames or drops either — the schemas pass
// unknown keys through, so an undeclared field disappearing is silent, and this
// one disappearing drops the app back to hand-written guesses without a word.
import rosters2026 from '../src/lib/api/fixtures/rosters-2026.json';
import picks2026 from '../src/lib/api/fixtures/draft-picks-2026.json';
import { SleeperRosterSchema, SleeperDraftPickSchema } from '../src/lib/api/schemas';

describe('the keeper fields are real, and the schema knows about them', () => {
  it('every 2026 roster parses and carries its three keepers', () => {
    for (const r of rosters2026) {
      const parsed = SleeperRosterSchema.parse(r);
      expect(Array.isArray(parsed.keepers), `roster ${r.roster_id} has a keepers array`).toBe(true);
      expect(parsed.keepers).toHaveLength(3);
    }
  });

  it('every keeper pick parses and is flagged is_keeper', () => {
    expect(picks2026.length).toBe(30);
    for (const p of picks2026) {
      const parsed = SleeperDraftPickSchema.parse(p);
      expect(parsed.is_keeper).toBe(true);
      expect(typeof parsed.pick_no).toBe('number');
      expect(typeof parsed.player_id).toBe('string');
    }
  });

  it('tolerates a roster that has not declared yet', () => {
    expect(() => SleeperRosterSchema.parse({ roster_id: 1, keepers: null })).not.toThrow();
    expect(() => SleeperRosterSchema.parse({ roster_id: 1 })).not.toThrow();
  });
});
