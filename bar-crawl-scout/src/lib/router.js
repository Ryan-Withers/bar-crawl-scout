// Real-URL router (history mode) with the same tiny API the app used from
// svelte-spa-router — link / location / push / active — so pages are ACTUAL
// pages: /book, /standings, /player/joe-burrow. Handles the GitHub Pages
// project base (/bar-crawl-scout/) via Vite's BASE_URL, and redirects legacy
// #/ links so old shares keep working.
import { writable } from 'svelte/store';

// '/bar-crawl-scout/' in the production build, '/' in tests. Normalised to
// no-trailing-slash ('' for root) so PREFIX + '/path' is always well-formed.
const RAW = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
export const PREFIX = RAW === '/' || RAW === './' ? '' : RAW.replace(/\/$/, '');

const current = () => {
  let p = window.location.pathname;
  if (PREFIX && p.startsWith(PREFIX)) p = p.slice(PREFIX.length);
  if (!p.startsWith('/')) p = '/' + p;
  return p === '' ? '/' : p;
};

// Legacy hash deep-links (#/book) -> real URLs, once, on boot — BEFORE the
// location store initialises, so the router renders the redirected page.
if (typeof window !== 'undefined' && window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', PREFIX + window.location.hash.slice(1));
}

export const location = writable(typeof window !== 'undefined' ? current() : '/');

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => location.set(current()));
}

export function push(path) {
  if (typeof window === 'undefined') return;
  window.history.pushState(null, '', PREFIX + path);
  location.set(path);
  window.scrollTo(0, 0);
}

// use:link — anchors keep app-relative hrefs in markup (href="/book"); the
// action prefixes the visible href for the browser and routes clicks in-app.
// Plain middle/ctrl/cmd clicks still open new tabs like a real site.
export function link(node) {
  const apply = () => {
    const href = node.getAttribute('href') || '';
    if (href.startsWith('/') && PREFIX && !href.startsWith(PREFIX + '/')) {
      node.setAttribute('href', PREFIX + href);
    }
  };
  apply();
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const href = node.getAttribute('href') || '';
    if (!href.startsWith(PREFIX + '/') && !(PREFIX === '' && href.startsWith('/'))) return;
    e.preventDefault();
    push(PREFIX ? href.slice(PREFIX.length) : href);
  };
  node.addEventListener('click', onClick);
  return {
    update: apply,
    destroy() { node.removeEventListener('click', onClick); },
  };
}

// use:active={{ path, className }} — adds the class while `path` is current.
export function active(node, opts = {}) {
  let path = opts.path || node.getAttribute('href') || '';
  let cls = opts.className || 'active';
  const unsub = location.subscribe((loc) => {
    const raw = path.startsWith(PREFIX + '/') && PREFIX ? path.slice(PREFIX.length) : path;
    node.classList.toggle(cls, loc === raw);
  });
  return {
    update(next = {}) { path = next.path || path; cls = next.className || cls; },
    destroy: unsub,
  };
}

// Route matching for the Router component. Supports exact paths, ':param'
// segments (values left URI-encoded, like svelte-spa-router) and '*'.
export function matchRoute(routes, loc) {
  const locSegs = loc.split('/').filter(Boolean);
  for (const [pattern, component] of Object.entries(routes)) {
    if (pattern === '*') continue;
    const patSegs = pattern.split('/').filter(Boolean);
    if (pattern === '/' && loc === '/') return { component, params: {} };
    if (patSegs.length !== locSegs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < patSegs.length; i++) {
      if (patSegs[i].startsWith(':')) params[patSegs[i].slice(1)] = locSegs[i];
      else if (patSegs[i] !== locSegs[i]) { ok = false; break; }
    }
    if (ok) return { component, params };
  }
  return routes['*'] ? { component: routes['*'], params: {} } : null;
}
