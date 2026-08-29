// Sleeper API shapes. The API returns loose JSON; type it once here.
// Docs: https://docs.sleeper.com/

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string } | null;
}

export interface RosterSettings {
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
  waiver_budget_used?: number;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[] | null;
  starters: string[] | null;
  settings: RosterSettings;
  // The three men this roster has LOCKED for the coming draft. Absent until the
  // manager sets them, which is why every reader treats null as "not yet", never
  // as "none". This is the only keeper source that is right by construction —
  // it is what Sleeper enforces on draft day.
  keepers?: string[] | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  previous_league_id: string | null;
  settings: Record<string, number | string>;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
}

export interface NflState {
  week: number;
  season: string;
  season_type: string;
  display_week?: number;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  starters: string[];
  players: string[];
  players_points?: Record<string, number>;
  starters_points?: number[];
}

export interface SleeperTransaction {
  type: string;
  status: string;
  settings?: { waiver_bid?: number } | null;
  roster_ids: number[];
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  draft_picks?: unknown[];
  created: number;
}

export interface SleeperPlayer {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string | null;
  age?: number | null;
  years_exp?: number | null;
}

export interface TrendingPlayer {
  player_id: string;
  count: number;
}

// Compact player record we actually keep: [name, position, team].
// Age and years of experience ride along at the end: the draft sheet needs
// both, and years_exp is what makes the career-stage tags auditable. Appended
// rather than inserted so every existing [0][1][2] read is untouched.
export type PlayerLite = [name: string, pos: string, team: string, age?: number | null, exp?: number | null];

export interface IndexedPlayers {
  t: number;
  version: string;
  byId: Record<string, PlayerLite>;
}
