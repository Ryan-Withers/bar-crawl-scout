// Live sync layer for the Svelte SPA.
// The Cloudflare Worker serves cached league rosters on an hourly cron so the app
// can auto-load them on open, with no manual Sync tap and no ~5MB player download.

export const SYNC_URL = 'https://bar-crawl-scout.ryan-96e.workers.dev';

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
