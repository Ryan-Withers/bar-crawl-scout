// WHAT A PICK IS WORTH — by where it actually lands, not by which round it says.
//
// The old pickValue priced every pick as `(round - 1) * 10 + 4`. Two things
// wrong with that, and they compound:
//
//   1. Slot 4 is hard-coded. It happens to be Ryan's seat, so the Trade page
//      valued BOTH sides of a deal as if they were his picks — swapping his
//      second for ImyHunter's (slot 1) reported them as identical when they are
//      three picks apart.
//   2. It is a LINEAR board. The draft is a snake, so in even rounds slot 4 is
//      the seventh pick of the round, not the fourth, and the error changes sign
//      every round.
//
// And a third thing nothing modelled at all: on a board with the keepers at the
// bottom, selling a fifteenth-round pick does not cost you a fifteenth. Keepers
// fill the deepest picks a manager still owns, so selling one pushes them up and
// the pick he actually loses is his deepest LIVE one. Ryan sold 15.04; his
// keepers moved to 14.07/13.04/12.07 and the pick that really left his board was
// 12.07. See `trueCost`.
//
// Pure module: values come in as a sorted array, nothing is fetched.

import type { KeeperBoard } from './keepers';

/** The overall pick number for a (round, slot) on a snake or linear board. */
export function overallOf(round: number, slot: number, teams: number, type: 'snake' | 'linear' = 'snake'): number {
  if (!(teams > 0)) return 0;
  const idx = type === 'snake' && round % 2 === 0 ? teams - slot : slot - 1;
  return (round - 1) * teams + idx + 1;
}

/**
 * What the pick at `overall` lands, given the board's values sorted best first.
 * Past the end of the board a pick is worth nothing, which is the honest answer
 * for a pick nobody will make.
 */
export function worthAt(sortedDesc: number[], overall: number): number {
  if (!Array.isArray(sortedDesc) || !sortedDesc.length) return 0;
  if (!Number.isFinite(overall) || overall < 1) return 0;
  if (overall > sortedDesc.length) return 0;
  return sortedDesc[overall - 1] || 0;
}

export interface PickRef {
  season: string;
  round: number;
  /** 1-based draft slot. Omit for a future season with no order yet. */
  slot?: number | null;
}

export interface PickPrice {
  /** Board value of the man this pick lands. */
  value: number;
  /** Overall pick number, when the slot is known. */
  overall: number | null;
  /** True when the season is beyond the current draft and has been discounted. */
  future: boolean;
}

/**
 * Price one pick.
 *
 * `slot` is the seat the pick belongs to — it is the whole point, so when it is
 * unknown the price is taken at the MIDDLE of the round rather than at anybody's
 * particular seat. That is a stated average, not a silent assumption that every
 * pick is yours.
 */
export function pricePick(
  ref: PickRef,
  sortedDesc: number[],
  opts: { teams: number; type?: 'snake' | 'linear'; season: string; futureDiscount?: number },
): PickPrice {
  const teams = opts.teams > 0 ? opts.teams : 10;
  const slot = Number.isFinite(ref.slot) ? Number(ref.slot) : null;
  const effective = slot ?? Math.ceil(teams / 2);
  const overall = overallOf(ref.round, effective, teams, opts.type || 'snake');
  const future = Number(ref.season) > Number(opts.season);
  const raw = worthAt(sortedDesc, overall);
  const discount = future ? (opts.futureDiscount ?? 0.6) : 1;
  return { value: Math.round(raw * discount), overall: slot ? overall : null, future };
}

/**
 * THE RIDE-UP. What a manager really gives up by selling one of his picks.
 *
 * Keepers occupy the deepest picks a manager owns. Sell one from below the
 * keeper line and the keepers simply shuffle down onto the next-deepest thing he
 * holds — so the pick that leaves his board is his deepest LIVE one, which can
 * be several rounds earlier and worth a great deal more.
 *
 * Returns the pick he would ACTUALLY lose, and whether the keepers rode.
 */
export function trueCost(
  board: KeeperBoard,
  handle: string,
  pickNo: number,
): { pickNo: number; rode: boolean } {
  const mine = board.cells.filter((c) => c.handle === handle);
  const cell = mine.find((c) => c.pickNo === pickNo);
  if (!cell) return { pickNo, rode: false };
  // Selling a LIVE pick costs exactly that pick.
  if (!cell.keeper) return { pickNo, rode: false };
  // Selling one a keeper sits on: the keeper takes the deepest live pick instead.
  const live = mine.filter((c) => !c.keeper).map((c) => c.pickNo);
  if (!live.length) return { pickNo, rode: false };
  return { pickNo: Math.max(...live), rode: true };
}

/**
 * Every pick a manager could put on the table, cheapest identification first:
 * his live picks, plus the note that his keeper picks are not really his to sell
 * without the ride-up above.
 */
export function tradablePicks(board: KeeperBoard, handle: string): Array<{ pickNo: number; round: number; slot: number; keeper: boolean }> {
  return board.cells
    .filter((c) => c.handle === handle)
    .map((c) => ({ pickNo: c.pickNo, round: c.round, slot: c.slot, keeper: !!c.keeper }))
    .sort((a, b) => a.pickNo - b.pickNo);
}
