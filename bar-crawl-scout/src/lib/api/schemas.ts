// SCHEMA LAYER (Fable File 03, Part 1.2). Zod schemas for the Sleeper endpoints
// the app reads. All .passthrough() — Sleeper adds keys freely and that must
// never break us; the Drift Bot flags new keys against live data separately.
//
// Two consumers: contract tests (assert fixtures parse) and — optionally —
// runtime guarded parsing (parse failure => the degradation path).
import { z } from 'zod';

const num = z.number();
const nstr = z.string().nullable().optional();

export const ScoringSettingsSchema = z.record(z.string(), num);

export const SleeperUserSchema = z.object({
  user_id: z.string(),
  display_name: z.string().nullable().optional(),
  avatar: nstr,
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).passthrough();

export const SleeperRosterSchema = z.object({
  roster_id: num,
  owner_id: z.string().nullable().optional(),
  players: z.array(z.string()).nullable().optional(),
  starters: z.array(z.string()).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  // The locked keepers. Declared so drift-check NOTICES if Sleeper ever renames
  // or drops it — the schema passes through unknown keys, so an undeclared field
  // vanishing is silent, and this one vanishing would drop the whole app back to
  // the hand-written guesses without a word.
  keepers: z.array(z.string()).nullable().optional(),
}).passthrough();

// A draft pick, including the flag that marks a keeper. Same reasoning: is_keeper
// is what puts the thirty men on the bottom of the board.
export const SleeperDraftPickSchema = z.object({
  round: num.nullable().optional(),
  pick_no: num.nullable().optional(),
  draft_slot: num.nullable().optional(),
  roster_id: num.nullable().optional(),
  player_id: z.string().nullable().optional(),
  is_keeper: z.boolean().nullable().optional(),
}).passthrough();

export const SleeperLeagueSchema = z.object({
  league_id: z.string(),
  name: z.string().nullable().optional(),
  season: z.string(),
  status: nstr,
  scoring_settings: ScoringSettingsSchema,
  previous_league_id: z.string().nullable().optional(),
  roster_positions: z.array(z.string()).nullable().optional(),
}).passthrough();

export const NflStateSchema = z.object({
  week: num,
  season: z.string(),
  season_type: z.string().nullable().optional(),
  leg: num.nullable().optional(),
}).passthrough();

export const SleeperMatchupSchema = z.object({
  roster_id: num,
  matchup_id: num.nullable().optional(),
  points: num.nullable().optional(),
  players: z.array(z.string()).nullable().optional(),
  starters: z.array(z.string()).nullable().optional(),
  players_points: z.record(z.string(), num).nullable().optional(),
}).passthrough();

export const TrendingPlayerSchema = z.object({
  player_id: z.string(),
  count: num,
}).passthrough();

// endpoint-name -> schema for the array/collection responses, used by contract tests.
export const SCHEMAS = {
  league: SleeperLeagueSchema,
  'league-scoring': ScoringSettingsSchema,
  users: z.array(SleeperUserSchema),
  rosters: z.array(SleeperRosterSchema),
  state: NflStateSchema,
  matchups: z.array(SleeperMatchupSchema),
  'trending-add': z.array(TrendingPlayerSchema),
  'trending-drop': z.array(TrendingPlayerSchema),
};

// Guarded parse: returns the parsed value, or the fallback on any schema failure
// (this is the degradation seam — a bad shape limps instead of throwing).
export function parseOr<T>(schema: z.ZodType<T>, data: unknown, fallback: T): T {
  const r = schema.safeParse(data);
  return r.success ? r.data : fallback;
}
