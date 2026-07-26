// ROSTER DEPTH — how stacked or thin you are at each position. Counts the bodies
// against the starting slots you must fill and flags THIN / OK / DEEP, with the
// total window value at each spot. Pure + known-answer tested.

export interface DepthPlayer { pos: string; proj?: number }
export interface DepthRow {
  pos: string;
  count: number;      // bodies at this position
  starters: number;   // dedicated starting slots for it
  value: number;      // total window value, 1 dp
  tag: 'THIN' | 'OK' | 'DEEP';
}

const CORE = ['QB', 'RB', 'WR', 'TE'];
const r1 = (n: number) => Math.round(n * 10) / 10;

// slots: the league's starting lineup, e.g. ['QB','RB','RB','WR','WR','TE','FLEX'].
export function rosterDepth(players: DepthPlayer[], slots: string[]): DepthRow[] {
  const slotList = slots || [];
  return CORE.filter((pos) => slotList.includes(pos)).map((pos) => {
    const at = (players || []).filter((p) => p && p.pos === pos);
    const starters = slotList.filter((s) => s === pos).length;
    const value = r1(at.reduce((s, p) => s + (p.proj || 0), 0));
    // At or below your required starters = no real cover -> THIN; two-plus deep = DEEP.
    const tag: DepthRow['tag'] = at.length <= starters ? 'THIN' : at.length >= starters + 2 ? 'DEEP' : 'OK';
    return { pos, count: at.length, starters, value, tag };
  });
}
