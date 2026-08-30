// GRADING THE REAL DRAFT.
//
// The mock room already grades a draft, and it grades it on the right number:
// overall pick minus the man's rank on the board. Take the best available and
// you score nothing; let one fall to you and you score positive; reach and you
// score negative. Averaged over your picks it does not care how many you had,
// which matters in a league where 47 picks changed hands and one manager holds
// nineteen selections against another's six.
//
// This applies the same number to the picks that actually happened. Nothing
// here is a new opinion — the ranking comes off The Sheet, which is Sleeper's
// own projection scored under the league's own rules, and the surplus is
// arithmetic on top of it.
//
// THE BOARD IT GRADES AGAINST is the board as it stood BEFORE the draft: the
// keepers taken out, because they were never draftable, and everybody else left
// in, because they were. Grading against the board as it stands afterwards
// would rank each man against a pool he has already been removed from.
//
// Pure module: picks in, grades out.

import { gradeFor } from './mockdraft';

export interface RealPick {
  pick_no?: number;
  round?: number;
  draft_slot?: number;
  player_id?: string;
  roster_id?: number;
  picked_by?: string;
  is_keeper?: boolean | null;
}

export interface GradedPick {
  playerId: string;
  name: string;
  pos: string;
  handle: string;
  overall: number;
  round: number;
  slot: number;
  /** His rank on the pre-draft board. */
  boardRank: number;
  /**
   * Where this pick sat among the DRAFTABLE selections — pick_no with the
   * keeper cells before it taken out, so it lines up with a board that has no
   * keepers on it.
   */
  seq: number;
  /** boardRank, floored at the draftable depth — what the delta is measured on. */
  effRank: number;
  /** seq - effRank. Positive means he fell to you, before the field is taken off. */
  delta: number;
}

export interface ManagerGrade {
  handle: string;
  picks: GradedPick[];
  /** His men's total surplus, with the field's average already taken off. */
  surplus: number;
  /** surplus / picks, raw — how far his men fell, on average. */
  rawPerPick: number;
  /** rawPerPick with the field's average taken off — the number the grade is cut on. */
  perPick: number;
  grade: string;
  /** The man he got furthest below his rank, and the one he reached furthest for. */
  best: GradedPick | null;
  worst: GradedPick | null;
  posCounts: Record<string, number>;
}

export interface DraftGrades {
  rows: ManagerGrade[];
  steals: GradedPick[];
  reaches: GradedPick[];
  /** Picks we could not rank, so the page can say how much it is not counting. */
  unranked: number;
  graded: number;
  /** The room's own average surplus per pick — the line the grades are cut around. */
  field: number;
  /** The depth the board was floored at. */
  depth: number;
}

export interface GradeOptions {
  /**
   * How deep the board is worth ranking. Past this everyone is replacement
   * level and the ordering between them is noise, so they are all treated as
   * sitting at exactly this rank.
   */
  depth?: number;
}

export interface GradeLookup {
  /** playerId -> his rank on the pre-draft board, and who he is. */
  rank: (playerId: string) => { rank: number; name: string; pos: string } | null;
  /** roster_id -> handle. */
  handleOf: Record<number, string>;
  /** user_id -> handle, for feeds that name the picker rather than the roster. */
  userHandle?: Record<string, string>;
}

/**
 * Grade every manager on the picks he actually made.
 *
 * KEEPERS ARE NOT PICKS. Sleeper files them down the same endpoint with
 * is_keeper set, sitting on the last selections each manager owns — counting
 * them would grade a man on a decision he made in July and score him for taking
 * Ja'Marr Chase at 12.07.
 *
 * A pick whose player is not on the board at all is skipped rather than scored
 * as zero: a late flier on somebody outside the top few hundred is not evidence
 * either way, and treating it as par would quietly drag every long draft toward
 * the middle.
 */
export function gradeDraft(
  picks: RealPick[] | null | undefined,
  look: GradeLookup,
  opts: GradeOptions = {},
): DraftGrades {
  // TWO CORRECTIONS, and without them every manager in the league gets a D.
  //
  // 1. THE BOARD IS DEEPER THAN THE DRAFT. It ranks four hundred and seventy
  //    men; a hundred and twenty get taken. Round 14 is spent on people the
  //    board has at 300+, so a raw delta of -180 lands on a pick nobody would
  //    call a reach — and because that happens to everybody, late rounds swamp
  //    the early ones entirely. Past the draftable depth the ordering is noise
  //    (a WR60's value over replacement is nil, and so is a WR75's), so
  //    everybody down there is treated as sitting at the depth itself.
  //
  // 2. THE ROOM IS THE PAR, NOT THE BOARD. Managers do not draft off our value
  //    board; they draft off ADP. So the men taken are systematically not our
  //    top hundred and twenty, and the sum of every delta in the draft is
  //    negative before anyone has done anything wrong. Grading against zero
  //    grades the league against a board it never saw. Taking the field's own
  //    average off makes the grade what it should have been all along: how you
  //    drafted compared with the nine other people in the room.
  const depth = Math.max(1, Math.round(opts.depth || 150));
  const all = Array.isArray(picks) ? picks : [];
  const graded: GradedPick[] = [];
  let unranked = 0;

  // THE RAGGED BOARD. Sleeper files the thirty keepers as picks, and they sit in
  // the last cells each manager owns — so by round 13 the pick NUMBER is running
  // ahead of the number of men actually taken. Grading pick 130 against a board
  // of 120 draftable men would hand everybody a free +10 late and read a normal
  // round 14 as a stack of steals. Count the keeper cells passed and take them
  // off, and the two scales line up again.
  const keeperCells = all
    .filter((p) => p?.is_keeper && Number(p?.pick_no) > 0)
    .map((p) => Number(p.pick_no))
    .sort((a, b) => a - b);
  const seqOf = (overall: number) =>
    overall - keeperCells.filter((k) => k < overall).length;

  for (const p of all) {
    if (p?.is_keeper) continue;
    const playerId = String(p?.player_id || '');
    const overall = Number(p?.pick_no || 0);
    if (!playerId || !overall) continue;

    const handle = look.handleOf[Number(p?.roster_id)]
      || (look.userHandle || {})[String(p?.picked_by || '')]
      || '';
    if (!handle) continue;

    const hit = look.rank(playerId);
    if (!hit) { unranked += 1; continue; }

    const seq = seqOf(overall);
    const effRank = Math.min(hit.rank, depth);
    graded.push({
      playerId,
      name: hit.name,
      pos: hit.pos,
      handle,
      overall,
      round: Number(p?.round || 0),
      slot: Number(p?.draft_slot || 0),
      boardRank: hit.rank,
      seq,
      effRank,
      delta: seq - effRank,
    });
  }

  // The line every grade is measured from.
  const field = graded.length
    ? graded.reduce((a, g) => a + g.delta, 0) / graded.length
    : 0;

  const byHandle: Record<string, GradedPick[]> = {};
  for (const g of graded) (byHandle[g.handle] = byHandle[g.handle] || []).push(g);

  const rows: ManagerGrade[] = Object.entries(byHandle).map(([handle, mine]) => {
    const surplus = mine.reduce((a, g) => a + g.delta, 0);
    const rawPerPick = mine.length ? surplus / mine.length : 0;
    const perPick = rawPerPick - field;
    const posCounts: Record<string, number> = {};
    for (const g of mine) posCounts[g.pos] = (posCounts[g.pos] || 0) + 1;
    const sorted = mine.slice().sort((a, b) => b.delta - a.delta);
    return {
      handle,
      picks: mine.slice().sort((a, b) => a.overall - b.overall),
      surplus: Math.round(surplus - field * mine.length),
      rawPerPick: Math.round(rawPerPick * 10) / 10,
      perPick: Math.round(perPick * 10) / 10,
      grade: gradeFor(perPick),
      best: sorted[0] || null,
      worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
      posCounts,
    };
  }).sort((a, b) => b.perPick - a.perPick || b.surplus - a.surplus);

  // Steals and reaches are measured from the same line as the grades, so the
  // two halves of the page cannot contradict each other.
  const byDelta = graded.slice().sort((a, b) => b.delta - a.delta);
  const rel = (g: GradedPick) => g.delta - field;
  return {
    rows,
    steals: byDelta.filter((g) => rel(g) >= 8).slice(0, 10),
    reaches: byDelta.filter((g) => rel(g) <= -8).reverse().slice(0, 10),
    unranked,
    graded: graded.length,
    field: Math.round(field * 10) / 10,
    depth,
  };
}

/**
 * Is the draft finished enough to grade?
 *
 * Not "are there any picks" — there are thirty before a ball is thrown, because
 * the keepers live in that feed. A draft is done when its own status says so.
 */
export function draftIsDone(draft: { status?: string | null } | null | undefined): boolean {
  return String(draft?.status || '').toLowerCase() === 'complete';
}
