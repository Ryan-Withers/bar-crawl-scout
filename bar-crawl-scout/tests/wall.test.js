import { describe, it, expect } from 'vitest';
import { championFromBracket } from '../src/lib/engine/wall';

describe('the wall — champion from bracket', () => {
  it('reads the winner/loser of the 1st-place game', () => {
    const bracket = [
      { r: 1, m: 1, w: 3, l: 6 },
      { r: 2, m: 2, w: 3, l: 1 },
      { r: 3, m: 3, w: 3, l: 5, p: 1 }, // title game
      { r: 3, m: 4, w: 1, l: 8, p: 3 }, // 3rd place game, same round
    ];
    expect(championFromBracket(bracket)).toEqual({ champion: 3, runnerUp: 5 });
  });

  it('falls back to the highest round when no placement flags', () => {
    const bracket = [
      { r: 1, m: 1, w: 2, l: 7 },
      { r: 2, m: 2, w: 2, l: 4 },
    ];
    expect(championFromBracket(bracket)).toEqual({ champion: 2, runnerUp: 4 });
  });

  it('returns nulls for an empty/unplayed bracket', () => {
    expect(championFromBracket([])).toEqual({ champion: null, runnerUp: null });
  });
});
