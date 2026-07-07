// Live sync layer for the Svelte SPA.
// The Cloudflare Worker serves cached league rosters on an hourly cron so the app
// can auto-load them on open, with no manual Sync tap and no ~5MB player download.

export const SYNC_URL = 'https://bar-crawl-scout.ryan-96e.workers.dev';

// Sleeper league IDs for the manual full Sync (FAAB medians + draft history).
export const LG2026 = '1311995695032467456';
export const LG2025 = '1180128113145339904';
export const LG2024 = '1115940789416312832';

// Thin fetch->JSON helper, throwing on non-200 so callers can degrade gracefully.
export async function jget(u) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' -> ' + r.status); return r.json(); }

// Pure adapter: the Worker returns {ts, rosters:{handle:{count,players}}}; the app's
// roster store is {t, byHandle}. Kept separate so it stays trivially unit-testable.
export function liveToStore(data) {
  return { t: (data && data.ts) || '', byHandle: (data && data.rosters) || {} };
}

// Fetch the Worker's cached rosters and return them in roster-store shape.
// Throws on network/HTTP failure so callers can fall back to cached data.
export async function fetchLiveRosters(url = SYNC_URL) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('sync ' + res.status);
  return liveToStore(await res.json());
}
