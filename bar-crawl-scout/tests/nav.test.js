// NAVIGATION — the single source of truth must stay complete and unambiguous.
import { describe, it, expect } from 'vitest';
import { SECTIONS, ALL_ITEMS, QUICK_NAV, itemFor, sectionFor } from '../src/lib/nav.js';

describe('nav model', () => {
  it('every item has a plain label, a real path and a one-line description', () => {
    expect(ALL_ITEMS.length).toBeGreaterThan(15);
    for (const i of ALL_ITEMS) {
      expect(i.path.startsWith('/'), `${i.label} path`).toBe(true);
      expect(i.label.length, `${i.path} label`).toBeGreaterThan(2);
      expect(i.desc.length, `${i.path} desc`).toBeGreaterThan(20); // a real sentence, not a stub
      expect(i.icon, `${i.path} icon`).toBeTruthy();
    }
  });

  it('paths are unique and sections are non-empty', () => {
    const paths = ALL_ITEMS.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const s of SECTIONS) {
      expect(s.items.length, `${s.id} is empty`).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(5);
    }
  });

  it('resolves the open item and section from a location', () => {
    expect(itemFor('/myteam').label).toBe('Lineup');
    expect(sectionFor('/myteam').id).toBe('team');
    expect(itemFor('/mock').label).toBe('Mock Draft');
    expect(sectionFor('/mock').id).toBe('draft');
    expect(sectionFor('/book').id).toBe('book');
  });

  it('detail routes resolve to their parent section', () => {
    expect(sectionFor('/player/Joe%20Burrow').id).toBe('draft');
    expect(sectionFor('/compare/a/b').id).toBe('draft');
    expect(sectionFor('/managers/joshleota').id).toBe('league');
    // ...and /managers itself is still the league section's own item.
    expect(itemFor('/managers').label).toBe('Managers');
  });

  it('does not confuse sibling prefixes', () => {
    // /players must not match /player, and vice versa.
    expect(itemFor('/players').label).toBe('Free Agents');
    expect(itemFor('/player/X')).toBeNull();
    expect(sectionFor('/player/X').id).toBe('draft');
  });

  it('home resolves to no item, and quick nav points at real destinations', () => {
    expect(itemFor('/')).toBeNull();
    const known = new Set([...ALL_ITEMS.map((i) => i.path), '/']);
    for (const q of QUICK_NAV) expect(known.has(q.path), `${q.path} unknown`).toBe(true);
  });
});
