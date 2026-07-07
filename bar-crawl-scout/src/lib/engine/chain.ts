// CHAIN OF CUSTODY — a player's entire history in THIS league, reconstructed from
// draft picks + transactions across every season (walk previous_league_id).
// Nobody else has this. Pure + fixture-tested; the raw->normalized resolution
// (roster_id -> handle per season) happens in the data layer.

export interface DraftPick {
  player_id: string;
  round: number;
  pick: number;      // pick number within the round
  roster_id: number;
  is_keeper?: boolean;
}

export interface Transaction {
  week: number;
  created?: number;                       // epoch ms (tiebreak)
  type: string;                           // 'trade' | 'waiver' | 'free_agent'
  settings?: { waiver_bid?: number } | null;
  adds?: Record<string, number> | null;   // player_id -> roster_id
  drops?: Record<string, number> | null;
  roster_ids?: number[];
}

export interface SeasonData {
  season: string;
  rosterHandle: Record<number, string>;   // roster_id -> manager handle
  picks?: DraftPick[];
  txns?: Transaction[];
}

export type ChainKind = 'draft' | 'keep' | 'faab' | 'add' | 'drop' | 'trade';

export interface ChainEvent {
  season: string;
  week: number;   // 0 = draft/keep (pre-season)
  created: number;
  kind: ChainKind;
  handle: string;
  detail: string;
}

const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

export function chainOfCustody(playerId: string, seasons: SeasonData[]): ChainEvent[] {
  const events: ChainEvent[] = [];

  for (const sd of seasons) {
    for (const pk of sd.picks || []) {
      if (pk.player_id !== playerId) continue;
      const handle = sd.rosterHandle[pk.roster_id] || '?';
      events.push({
        season: sd.season, week: 0, created: 0,
        kind: pk.is_keeper ? 'keep' : 'draft', handle,
        detail: `${pk.is_keeper ? 'Kept' : 'Drafted'} · R${pk.round}.${pad(pk.pick)}`,
      });
    }

    for (const t of sd.txns || []) {
      const addRoster = t.adds ? t.adds[playerId] : undefined;
      const dropRoster = t.drops ? t.drops[playerId] : undefined;
      if (addRoster === undefined && dropRoster === undefined) continue;
      const created = t.created || 0;

      if (t.type === 'trade') {
        const to = addRoster !== undefined ? sd.rosterHandle[addRoster] : null;
        const from = dropRoster !== undefined ? sd.rosterHandle[dropRoster] : null;
        events.push({
          season: sd.season, week: t.week, created, kind: 'trade',
          handle: to || from || '?',
          detail: `Traded${from ? ` from ${from}` : ''}${to ? ` to ${to}` : ''}`,
        });
      } else if (addRoster !== undefined) {
        const handle = sd.rosterHandle[addRoster] || '?';
        const bid = t.settings && typeof t.settings.waiver_bid === 'number' ? t.settings.waiver_bid : null;
        events.push({
          season: sd.season, week: t.week, created,
          kind: bid != null ? 'faab' : 'add', handle,
          detail: bid != null ? `FAAB claim · $${bid}` : 'Added off the wire',
        });
      } else if (dropRoster !== undefined) {
        events.push({
          season: sd.season, week: t.week, created, kind: 'drop',
          handle: sd.rosterHandle[dropRoster] || '?', detail: 'Dropped',
        });
      }
    }
  }

  events.sort((a, b) =>
    (Number(a.season) - Number(b.season)) || (a.week - b.week) || (a.created - b.created));
  return events;
}
