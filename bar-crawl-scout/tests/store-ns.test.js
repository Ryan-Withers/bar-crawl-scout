// TWO BOARDS, ONE BROWSER.
//
// The board record is keyed by player name and was saved under a single key.
// With two leagues drafting two hours apart on the same afternoon, a star or a
// custom ranking set for one draft appearing in the other is not a cosmetic
// bug — it is being told the wrong thing while you are on the clock.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

describe('boardFor', () => {
  let boardFor; let board; let nsKey; let LEAGUES;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    ({ boardFor, board } = await import('../src/lib/store.js'));
    ({ nsKey, LEAGUES } = await import('../src/lib/leagues.js'));
  });

  it('gives the original league the key it has always had', async () => {
    // Anyone who has already built a board keeps it. Renaming this key would
    // have silently thrown away every saved favourite in existence.
    expect(nsKey(LEAGUES.bar, 'hq_board_v3')).toBe('hq_board_v3');
    expect(boardFor('')).toBe(board);
  });

  it('keeps a second league’s stars off the first league’s board', () => {
    const a = boardFor('');
    const b = boardFor('kings');
    a.update((v) => ({ ...v, favs: ['Bijan Robinson'] }));
    b.update((v) => ({ ...v, favs: ['Puka Nacua'] }));
    expect(get(a).favs).toEqual(['Bijan Robinson']);
    expect(get(b).favs).toEqual(['Puka Nacua']);
  });

  it('keeps a second league’s ranking and drafted list separate too', () => {
    const a = boardFor('');
    const b = boardFor('kings');
    a.update((v) => ({ ...v, myOrder: ['A', 'B'], drafted: ['A'] }));
    expect(get(b).myOrder).toEqual([]);
    expect(get(b).drafted).toEqual([]);
  });

  it('writes them to different localStorage keys', () => {
    boardFor('kings').update((v) => ({ ...v, favs: ['Puka Nacua'] }));
    expect(localStorage.getItem('hq_board_v3__kings')).toContain('Puka Nacua');
    expect(localStorage.getItem('hq_board_v3') || '').not.toContain('Puka Nacua');
  });

  it('hands back the same store for the same league, not a fresh one', () => {
    // Two stores over one key would race each other into localStorage and one
    // would overwrite the other's writes.
    expect(boardFor('kings')).toBe(boardFor('kings'));
    expect(boardFor('kings')).not.toBe(boardFor(''));
  });

  it('namespaces any other saved key the same way', () => {
    expect(nsKey(LEAGUES.kings, 'bcs_sheet_notes_v1')).toBe('bcs_sheet_notes_v1__kings');
    expect(nsKey(LEAGUES.bar, 'bcs_sheet_notes_v1')).toBe('bcs_sheet_notes_v1');
  });
});
