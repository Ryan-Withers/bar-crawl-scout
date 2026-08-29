// PICK CAPITAL — who actually owns what, this year and next.
//
// data.js hand-counts this. CAPITAL is a per-manager [firsts, seconds, thirds]
// for 2026, FIRSTROUND is a typed-out round one, MYPICKS is Ryan's own list. All
// three were right when somebody last checked and all three are wrong now: Ryan
// is down as holding two first-rounders and holds one — he bought JShrimp341's
// and sold it on to joshleota. Forty-seven 2026 picks and eighteen 2027 picks
// have changed hands. A snapshot cannot keep up with that, and nothing in the
// app noticed it had gone stale.
//
// Sleeper knows. /league/{id}/traded_picks gives (season, round, original roster,
// current owner) for every pick that moved, and everything else is still with the
// man who was born holding it. That is the whole calculation.
//
// FUTURES work the same way and matter as much: joshleota is sitting on FOUR
// 2027 first-rounders, three of them bought. CAPITAL has him at zero firsts.
//
// Pure module: no fetch, no DOM, no stores.

export interface TradedPickLike {
  season: string | number;
  round: number;
  roster_id: number;          // whose pick it ORIGINALLY was
  owner_id: number;           // who holds it NOW
  previous_owner_id?: number | null;
}

export interface OwnedPick {
  season: string;
  round: number;
  /** The roster whose slot this is. */
  fromRoster: number;
  /** The handle it originally belonged to — null when that is the holder himself. */
  via: string | null;
}

export interface Capital {
  handle: string;
  season: string;
  picks: OwnedPick[];
  /** Count by round, 1-based: byRound[1] is his first-rounders. */
  byRound: Record<number, number>;
  /** firsts, seconds, thirds — the shape the old hand-written CAPITAL used. */
  top3: [number, number, number];
  total: number;
}

/**
 * Every pick every manager holds, for one season.
 *
 * `rounds` is how many rounds that season's draft runs. For a future season with
 * no draft object yet, pass the current draft's round count — the league does not
 * change shape between years, and a pick in a round that turns out not to exist
 * simply never gets traded.
 */
export function capitalFor(
  season: string | number,
  rounds: number,
  traded: TradedPickLike[] | null | undefined,
  rosterHandle: Record<number, string>,
): Record<string, Capital> {
  const s = String(season);
  const moved = new Map<string, number>();
  for (const t of Array.isArray(traded) ? traded : []) {
    if (!t || String(t.season) !== s) continue;
    moved.set(`${t.round}:${t.roster_id}`, t.owner_id);
  }

  const out: Record<string, Capital> = {};
  const ensure = (h: string): Capital => (out[h] = out[h] || {
    handle: h, season: s, picks: [], byRound: {}, top3: [0, 0, 0], total: 0,
  });
  for (const h of Object.values(rosterHandle)) if (h) ensure(h);

  const rosterIds = Object.keys(rosterHandle).map(Number).filter((n) => Number.isFinite(n));
  for (let round = 1; round <= rounds; round++) {
    for (const orig of rosterIds) {
      const ownerId = moved.get(`${round}:${orig}`) ?? orig;
      const holder = rosterHandle[ownerId];
      if (!holder) continue;                       // a pick held by nobody we know
      const from = rosterHandle[orig];
      const cap = ensure(holder);
      cap.picks.push({ season: s, round, fromRoster: orig, via: from && from !== holder ? from : null });
      cap.byRound[round] = (cap.byRound[round] || 0) + 1;
      if (round <= 3) cap.top3[round - 1] += 1;
      cap.total += 1;
    }
  }
  for (const cap of Object.values(out)) cap.picks.sort((a, b) => a.round - b.round);
  return out;
}

/**
 * The old warchest weighting — a first is worth three, a second one and a half,
 * a third one — kept so the Intel and Managers pages read the same as they
 * always have, only off real numbers.
 */
export const chestValue = (c: Capital | null | undefined): number =>
  (c ? c.top3[0] * 3 + c.top3[1] * 1.5 + c.top3[2] : 0);

export const chestTagFor = (w: number): string =>
  (w >= 10 ? 'LOADED' : w >= 5 ? 'SOLID' : w >= 2 ? 'LIGHT' : 'STRIPPED');

/**
 * Round one, in draft order, with who holds each slot and where it came from —
 * what FIRSTROUND hard-codes.
 */
export function firstRound(
  cap: Record<string, Capital>,
  slotHandles: string[],
  rosterHandle: Record<number, string>,
  traded: TradedPickLike[] | null | undefined,
  season: string | number,
): Array<{ slot: number; handle: string; via: string | null }> {
  const s = String(season);
  const handleRoster: Record<string, number> = {};
  for (const [id, h] of Object.entries(rosterHandle)) if (h) handleRoster[h] = Number(id);
  const moved = new Map<number, number>();
  for (const t of Array.isArray(traded) ? traded : []) {
    if (t && String(t.season) === s && t.round === 1) moved.set(t.roster_id, t.owner_id);
  }
  return slotHandles.map((base, i) => {
    const origRoster = handleRoster[base];
    const ownerId = moved.get(origRoster);
    const holder = ownerId != null ? rosterHandle[ownerId] : base;
    return { slot: i + 1, handle: holder || base, via: holder && holder !== base ? base : null };
  });
}

/** One manager's picks across several seasons, newest season first. */
export function picksOf(
  byS: Record<string, Record<string, Capital>>,
  handle: string,
): OwnedPick[] {
  const out: OwnedPick[] = [];
  for (const season of Object.keys(byS).sort()) {
    const c = byS[season][handle];
    if (c) out.push(...c.picks);
  }
  return out;
}
