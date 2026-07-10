import { describe, it, expect } from 'vitest';
import { matchRoute } from '../src/lib/router.js';

const A = 'A', B = 'B', Star = 'Star';

describe('real-URL router — route matching', () => {
  const routes = { '/': A, '/book': B, '/player/:id': 'P', '/compare/:a/:b': 'C', '*': Star };

  it('matches exact paths and the root', () => {
    expect(matchRoute(routes, '/').component).toBe(A);
    expect(matchRoute(routes, '/book').component).toBe(B);
  });

  it('extracts :params, leaving them URI-encoded like the old router', () => {
    const m = matchRoute(routes, '/player/Joe%20Burrow');
    expect(m.component).toBe('P');
    expect(m.params.id).toBe('Joe%20Burrow');
    const c = matchRoute(routes, '/compare/A%20B/C%20D');
    expect(c.params).toEqual({ a: 'A%20B', b: 'C%20D' });
  });

  it('falls back to * for unknown paths, and never cross-matches lengths', () => {
    expect(matchRoute(routes, '/nope').component).toBe(Star);
    expect(matchRoute(routes, '/player/x/y').component).toBe(Star); // too deep
    expect(matchRoute(routes, '/players').component).toBe(Star);    // /player/:id must not match /players
  });
});
