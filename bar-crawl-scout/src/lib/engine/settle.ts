// THE BOOK — settlement. Turns real outcomes into won/lost/void on each bet.
// Pure + fixture-tested; the same rules run in the Worker so grading is identical
// wherever it's called. Every bet leg carries a structured `pick` (built when the
// bet is placed) so grading never has to parse a human label.

export type Pick =
  | { kind: 'prop'; player: string; side: 'over' | 'under'; line: number }
  | { kind: 'champ'; handle: string }
  | { kind: 'finals'; handle: string };

export type LegStatus = 'won' | 'lost' | 'push' | 'pending';
export type BetStatus = 'open' | 'won' | 'lost' | 'void';

// Everything grading might need to settle a leg.
export interface GradeCtx {
  points?: Record<string, number>;  // player name -> fantasy points (a given week)
  champion?: string | null;         // winning manager handle (season end)
  finalists?: string[];             // handles that reached the finals
}

interface Leg { pick?: Pick; [k: string]: unknown }
interface Bet { kind?: string; legs?: Leg[]; [k: string]: unknown }

// Grade a single leg against the outcomes we have. `pending` = we can't settle it
// yet (no data), which keeps the whole bet open.
export function gradeLeg(pick: Pick | undefined, ctx: GradeCtx): LegStatus {
  if (!pick) return 'pending';
  if (pick.kind === 'prop') {
    const pts = ctx.points?.[pick.player];
    if (pts == null) return 'pending';
    if (Math.abs(pts - pick.line) < 1e-9) return 'push';         // exact line = refund
    const wentOver = pts > pick.line;
    return (pick.side === 'over' ? wentOver : !wentOver) ? 'won' : 'lost';
  }
  if (pick.kind === 'champ') {
    if (ctx.champion === undefined) return 'pending';
    return ctx.champion === pick.handle ? 'won' : 'lost';
  }
  if (pick.kind === 'finals') {
    if (!ctx.finalists) return 'pending';
    return ctx.finalists.includes(pick.handle) ? 'won' : 'lost';
  }
  return 'pending';
}

// Grade a whole bet -> the new status, or null if it can't be settled yet (any
// leg still pending). Singles mirror their one leg. Multis: any lost leg loses
// the bet; all won wins it; a push with no loss voids (refund) — we don't try to
// re-price a partial parlay, we just give the stake back.
export function gradeBet(bet: Bet, ctx: GradeCtx): BetStatus | null {
  const legs = bet.legs || [];
  if (!legs.length) return null;
  const statuses = legs.map((l) => gradeLeg(l.pick, ctx));
  if (statuses.some((s) => s === 'pending')) return null;
  if (bet.kind === 'multi') {
    if (statuses.includes('lost')) return 'lost';
    if (statuses.includes('push')) return 'void';
    return 'won';
  }
  const s = statuses[0];
  return s === 'push' ? 'void' : (s as BetStatus);
}
