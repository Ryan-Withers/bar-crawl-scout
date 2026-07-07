// THE BOOK — betting state: who's logged in, everyone's $100/week bankroll, their
// bet slips and the season tally. Persisted locally (per device). A shared,
// cheat-proof pool needs the Worker as a store — this is written so the same
// bet objects can POST/GET there later; today it lives in localStorage.
import { writable, derived } from 'svelte/store';
import { TEAMS } from './data.js';

const readJSON = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } };
function persisted(key, initial) { const s = writable(initial); s.subscribe((v) => writeJSON(key, v)); return s; }

export const WEEKLY_CREDIT = 100;      // $100 dropped into your account each week (rolls over)
export const WEEKLY_SPEND_CAP = 150;   // but you can only stake $150 in any one week
export const MULTI_CAP = 20;           // max stake on a multi
export const MULTIS_PER_WEEK = 1;      // one multi per week

// Per-manager unlock codes. Simple by design — the commissioner hands these out
// so nobody drops a bet in your name. (Cheat-proof enforcement needs the server.)
export const MANAGER_CODES = {
  RYAN0: 'Ryan', BUCKLE: 'joshleota', JET2: 'WinzTheBrah', SHOUGH: 'JohnnyDuff',
  RICE9: 'jduddy9', LAMAR: 'jpdonners', GRID4: 'ATorelli4', SHAKIR: 'JShrimp341',
  BOURNE: 'ShaydenB', EGG10: 'ImyHunter',
};
export const codeFor = (handle) => Object.keys(MANAGER_CODES).find((c) => MANAGER_CODES[c] === handle) || null;

// Who is logged in (a manager handle), or null.
export const bettor = persisted('bcs_bettor', readJSON('bcs_bettor') || null);
export function login(code) {
  const h = MANAGER_CODES[String(code || '').trim().toUpperCase()];
  if (h) { bettor.set(h); return h; }
  return null;
}
export function logout() { bettor.set(null); }

// All bets, every manager, all weeks. Each: {id, handle, week, kind, legs:[{market,sel,line,odds,label}],
// stake, odds, status:'open'|'won'|'lost'|'void', placed}
export const bets = persisted('bcs_bets', readJSON('bcs_bets') || []);

let _seq = 0;
export function betId(week) { _seq += 1; return `${week}-${_seq}-${Math.round(performance.now())}`; }

const r2 = (n) => Math.round(n * 100) / 100;

// This manager's bets for a given week.
export function betsFor(all, handle, week) {
  return (all || []).filter((b) => b.handle === handle && b.week === week);
}
// Staked in a single week — capped by WEEKLY_SPEND_CAP.
export function weeklySpent(all, handle, week) {
  return betsFor(all, handle, week).reduce((s, b) => s + b.stake, 0);
}
export function weeklyRemaining(all, handle, week) {
  return Math.max(0, WEEKLY_SPEND_CAP - weeklySpent(all, handle, week));
}
// Rolling account: $100 credited every week to date, minus all stakes, plus
// settled returns (won payouts + voided refunds). Open bets stay deducted.
export function totalStaked(all, handle) {
  return (all || []).filter((b) => b.handle === handle).reduce((s, b) => s + b.stake, 0);
}
export function totalReturned(all, handle) {
  return (all || []).filter((b) => b.handle === handle)
    .reduce((s, b) => s + (b.status === 'won' ? b.stake * b.odds : b.status === 'void' ? b.stake : 0), 0);
}
export function balance(all, handle, week) {
  return r2(WEEKLY_CREDIT * Math.max(1, week || 1) - totalStaked(all, handle) + totalReturned(all, handle));
}
// What you can actually stake right now: the smaller of your balance and the
// week's remaining spend cap.
export function available(all, handle, week) {
  return Math.max(0, r2(Math.min(balance(all, handle, week), weeklyRemaining(all, handle, week))));
}
export function multisThisWeek(all, handle, week) {
  return betsFor(all, handle, week).filter((b) => b.kind === 'multi').length;
}

// Season tally: staked, returned, P/L, record — per manager.
export function tally(all) {
  const t = {};
  for (const b of all || []) {
    const r = t[b.handle] || (t[b.handle] = { handle: b.handle, staked: 0, returned: 0, won: 0, lost: 0, open: 0, bets: 0 });
    r.bets += 1; r.staked += b.stake;
    if (b.status === 'won') { r.won += 1; r.returned += Math.round(b.stake * b.odds * 100) / 100; }
    else if (b.status === 'lost') { r.lost += 1; }
    else if (b.status === 'void') { r.returned += b.stake; }
    else { r.open += 1; }
  }
  return Object.values(t)
    .map((r) => ({ ...r, pl: Math.round((r.returned - r.staked) * 100) / 100 }))
    .sort((a, b) => b.pl - a.pl);
}

// A ready leaderboard for every manager (zeros for those who haven't bet).
export const leaderboard = derived(bets, ($bets) => {
  const t = Object.fromEntries(tally($bets).map((r) => [r.handle, r]));
  return TEAMS.map(([h]) => t[h] || { handle: h, staked: 0, returned: 0, won: 0, lost: 0, open: 0, bets: 0, pl: 0 })
    .sort((a, b) => b.pl - a.pl || b.won - a.won);
});
