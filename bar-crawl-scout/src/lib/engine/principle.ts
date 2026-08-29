// TRADES IN PRINCIPLE — the deals that are done but haven't happened yet.
//
// This league lets you trade a keeper before the draft on the understanding that
// it executes AFTER it. Sleeper has no such concept, so the managers do it in
// two steps: they put the trade through properly, and then the commissioner
// moves the players back, because a man has to be ON your roster for you to
// declare him as one of your three.
//
// The result is a roster that is deliberately, temporarily wrong. Puka Nacua
// shows as joshleota's keeper and is coming to Ryan. CeeDee Lamb and Zay Flowers
// show as jpdonners' and are going to ImyHunter. Nothing in Sleeper says so —
// the only trace is a trade followed by a commissioner move putting the same men
// straight back.
//
// So that is exactly what this looks for: the last trade that moved a player,
// and a later commissioner transaction that returned him to the roster he came
// from. Anything else — an ordinary trade, a waiver, a drop — is not a pending
// move and must not be reported as one.
//
// Pure module: transactions in, agreements out.

export interface TxnLike {
  type?: string;
  status?: string;
  created?: number;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  draft_picks?: Array<{ season?: string; round?: number; roster_id?: number; owner_id?: number }> | null;
}

export interface PendingMove {
  playerId: string;
  /** The roster holding him now, and declaring him as a keeper. */
  fromRoster: number;
  /** The roster he joins once the draft is done. */
  toRoster: number;
  /** When the agreement was struck (epoch ms). */
  agreedAt: number;
  /** When he was moved back (epoch ms). */
  revertedAt: number;
}

interface Move { at: number; type: string; from: number | null; to: number | null }

/**
 * Every player whose trade is agreed but not yet executed.
 *
 * `transactions` may be one week's worth or every week's, in any order — they
 * are sorted here. Only completed transactions count.
 */
export function pendingMoves(transactions: TxnLike[] | null | undefined): PendingMove[] {
  const txns = (Array.isArray(transactions) ? transactions : [])
    .filter((t) => t && (!t.status || t.status === 'complete'))
    .slice()
    .sort((a, b) => (a.created || 0) - (b.created || 0));

  // player -> the moves he has made, in order.
  const byPlayer = new Map<string, Move[]>();
  for (const t of txns) {
    const ids = new Set([...Object.keys(t.adds || {}), ...Object.keys(t.drops || {})]);
    for (const id of ids) {
      const move: Move = {
        at: t.created || 0,
        type: String(t.type || ''),
        from: (t.drops || {})[id] ?? null,
        to: (t.adds || {})[id] ?? null,
      };
      // A pure drop or a pure add is not a transfer between two rosters.
      if (move.from == null || move.to == null) continue;
      const list = byPlayer.get(id) || [];
      list.push(move);
      byPlayer.set(id, list);
    }
  }

  const out: PendingMove[] = [];
  for (const [playerId, moves] of byPlayer) {
    // The last TRADE is the agreement. Anything before it has been superseded.
    let lastTrade = -1;
    for (let i = moves.length - 1; i >= 0; i--) if (moves[i].type === 'trade') { lastTrade = i; break; }
    if (lastTrade < 0) continue;
    const trade = moves[lastTrade];

    // Did a COMMISSIONER move after it put him back where he started? That is
    // the league's way of saying "agreed, but not yet".
    let reverted: Move | null = null;
    for (let i = lastTrade + 1; i < moves.length; i++) {
      const m = moves[i];
      if (m.type === 'commissioner' && m.from === trade.to && m.to === trade.from) { reverted = m; break; }
      // Any other move after the trade means the situation has moved on.
      if (m.type !== 'commissioner') { reverted = null; break; }
    }
    if (!reverted) continue;

    out.push({
      playerId,
      fromRoster: trade.from as number,
      toRoster: trade.to as number,
      agreedAt: trade.at,
      revertedAt: reverted.at,
    });
  }
  return out.sort((a, b) => a.agreedAt - b.agreedAt || a.playerId.localeCompare(b.playerId));
}

/** playerId -> the roster he joins after the draft. */
export const pendingByPlayer = (moves: PendingMove[]): Record<string, number> =>
  Object.fromEntries((moves || []).map((m) => [m.playerId, m.toRoster]));

/** roster -> the men it is about to LOSE once the draft is done. */
export function outgoingByRoster(moves: PendingMove[]): Record<number, PendingMove[]> {
  const out: Record<number, PendingMove[]> = {};
  for (const m of moves || []) (out[m.fromRoster] = out[m.fromRoster] || []).push(m);
  return out;
}

/** roster -> the men it is about to GAIN. */
export function incomingByRoster(moves: PendingMove[]): Record<number, PendingMove[]> {
  const out: Record<number, PendingMove[]> = {};
  for (const m of moves || []) (out[m.toRoster] = out[m.toRoster] || []).push(m);
  return out;
}

/**
 * A manager's roster once every agreed deal has gone through: what he keeps,
 * minus what he owes, plus what he is owed. This is the squad he will actually
 * have, which is the one worth drafting around.
 */
export function settledKeepers<T extends { playerId: string }>(
  keepers: T[],
  rosterId: number,
  moves: PendingMove[],
  lookup: (playerId: string) => T | null,
): { stays: T[]; leaving: T[]; arriving: T[] } {
  const out = outgoingByRoster(moves)[rosterId] || [];
  const inc = incomingByRoster(moves)[rosterId] || [];
  const owed = new Set(out.map((m) => m.playerId));
  return {
    stays: (keepers || []).filter((k) => !owed.has(k.playerId)),
    leaving: (keepers || []).filter((k) => owed.has(k.playerId)),
    arriving: inc.map((m) => lookup(m.playerId)).filter(Boolean) as T[],
  };
}
