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

// Build the URL for a FORCED-fresh pull: ?refresh=1 makes the Worker rebuild
// from Sleeper right now, and the timestamp busts the 5-minute CDN cache.
// Pure so it's unit-testable.
export function refreshUrl(base = SYNC_URL, now = 0) {
  return base.replace(/\/$/, '') + '/?refresh=1&t=' + now;
}

// Fetch the Worker's rosters in roster-store shape. `fresh` forces a rebuild —
// use it when a stale starting lineup matters (start/sit suggestions).
// Throws on network/HTTP failure so callers can fall back to cached data.
export async function fetchLiveRosters(url = SYNC_URL, fresh = false) {
  const res = await fetch(fresh ? refreshUrl(url, Date.now()) : url);
  if (!res.ok) throw new Error('sync ' + res.status);
  return liveToStore(await res.json());
}
