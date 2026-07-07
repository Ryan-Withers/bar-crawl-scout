// THE BOOK — shared bet store over the Worker. This is what makes the book
// cheat-proof: the Worker's KV is the single source of truth for every bet, so
//   • your login code is checked server-side (it never has to live in the site
//     bundle to be trusted), and
//   • the weekly $150 cap is recomputed from ALL stored bets before a new one is
//     accepted — two phones can't both sneak a bet through, the server serialises.
// When the Worker is unreachable (dev, offline, not yet deployed) we fall back to
// the local `bets` store so the tool still works; `online` tells the UI which.
import { writable } from 'svelte/store';
import { SYNC_URL } from './sleeper.js';
import { bets } from './bet.js';

const BOOK_URL = SYNC_URL; // same Worker, new /book/* routes

// null = unknown/checking, true = talking to the Worker, false = local-only.
export const online = writable(null);

async function jfetch(path, opts) {
  const res = await fetch(BOOK_URL.replace(/\/$/, '') + path, opts);
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(res.status + ' ' + t); }
  return res.json();
}

// Pull the whole shared ledger into the reactive store. Silent no-op if the
// Worker isn't there — the local store keeps whatever it had.
export async function loadBets() {
  if (!BOOK_URL || typeof fetch !== 'function') { online.set(false); return false; }
  try {
    const data = await jfetch('/book/bets');
    if (Array.isArray(data?.bets)) { bets.set(data.bets); online.set(true); return true; }
    online.set(false); return false;
  } catch { online.set(false); return false; }
}

// Verify a login code against the Worker. Returns the handle, or null.
// Resolves to `undefined` when the Worker is unreachable so callers can fall
// back to the local code map instead of hard-failing the login.
export async function verifyCode(code) {
  if (!BOOK_URL) return undefined;
  try {
    const data = await jfetch('/book/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: String(code || '').trim().toUpperCase() }),
    });
    online.set(true);
    return data?.ok ? data.handle : null;
  } catch { online.set(false); return undefined; }
}

// Place a bet through the Worker. The server re-checks the code and the weekly
// cap against everyone's stored bets, then returns the fresh full ledger — so a
// success here already reflects any bet another device slipped in first.
// Returns { ok, bet } or { ok:false, reason }. Throws only on network failure,
// which the caller catches to fall back to a local-only place.
export async function placeBet(code, bet) {
  const data = await jfetch('/book/bets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: String(code || '').trim().toUpperCase(), bet }),
  });
  online.set(true);
  if (Array.isArray(data?.ledger)) bets.set(data.ledger);
  return data;
}
