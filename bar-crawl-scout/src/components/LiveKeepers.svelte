<script>
  // LIVE KEEPERS — renders nothing, decides everything.
  //
  // Twenty-one components read the keeper store, and until now it was seeded
  // from PROJ: a hand-written guess at who each manager would keep. The keepers
  // are locked, so this mounts once at the root, pulls the three men each roster
  // has actually declared, and pushes them into the store's live layer, where
  // they override the guess for every reader at once.
  //
  // It fails silently and completely on purpose. No network, a cold player
  // cache, a roster that has not declared yet — any of those and the store keeps
  // whatever it had, which is the old projection. A wrong keeper is worse than a
  // stale one only if you cannot tell them apart, so `keepersSource` says which
  // you are looking at and the Keepers page prints it.
  import { createQuery } from '@tanstack/svelte-query';
  import { rostersQuery, usersQuery, playersQuery } from '../api/queries';
  import { userHandleMap } from '../api/league';
  import { keeperLedger } from '../lib/engine/keepers';
  import { keepers } from '../lib/store.js';
  import { TEAMS } from '../lib/data.js';

  const rostersQ = createQuery(rostersQuery());
  const usersQ = createQuery(usersQuery());
  const playersQ = createQuery(playersQuery());

  const HANDLES = new Set(TEAMS.map(([h]) => h));

  // The store's legacy shape is [[name, confidence], ...] x4. A locked keeper is
  // not a confidence, so every live slot is 'VL' — isKept only ever cared that it
  // was not 'U'. The fourth "watch" slot is left empty: watching was a thing you
  // did while guessing.
  function toStoreShape(ledger) {
    const out = {};
    for (const [handle, men] of Object.entries(ledger)) {
      if (!HANDLES.has(handle)) continue;
      const rows = men.slice(0, 3).map((m) => [m.name, 'VL']);
      while (rows.length < 4) rows.push(['', '']);
      out[handle] = rows;
    }
    return out;
  }

  $: rosters = $rostersQ.data;
  $: users = $usersQ.data;
  $: players = $playersQ.data;

  $: if (Array.isArray(rosters) && Array.isArray(users) && players) {
    const nameOf = (id) => {
      const p = players[String(id)];
      return p ? { name: p[0], pos: p[1] } : null;
    };
    const ledger = keeperLedger(rosters, userHandleMap(users), nameOf);
    const live = toStoreShape(ledger);
    // Only take the wheel when the league has actually declared. A half-set
    // league would otherwise wipe good projections for the managers who have not
    // locked yet, which is strictly worse than the guess it replaced.
    const declared = Object.values(live).filter((rows) => rows[0][0]).length;
    keepers.setLive(declared === TEAMS.length ? live : null);
  }
</script>
