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
  import { rostersQuery, usersQuery, playersQuery, realDraftQuery, seasonTransactionsQuery } from '../api/queries';
  import { userHandleMap } from '../api/league';
  import { keeperLedger } from '../lib/engine/keepers';
  import { pendingMoves, settleLedger, cameFrom } from '../lib/engine/principle';
  import { capitalFor } from '../lib/engine/picks';
  import { keepers, capital, keeperFrom } from '../lib/store.js';
  import { TEAMS } from '../lib/data.js';

  const rostersQ = createQuery(rostersQuery());
  const usersQ = createQuery(usersQuery());
  const playersQ = createQuery(playersQuery());
  const realQ = createQuery(realDraftQuery());
  const txnQ = createQuery(seasonTransactionsQuery());

  const HANDLES = new Set(TEAMS.map(([h]) => h));

  // The store's legacy shape is [[name, confidence], ...] x4. A locked keeper is
  // not a confidence, so every live slot is 'VL' — isKept only ever cared that it
  // was not 'U'. The fourth "watch" slot is left empty: watching was a thing you
  // did while guessing.
  //
  // The list is NOT truncated to three. Once the trades in principle are settled
  // a squad can be four or five men, or one, and cutting it back to three would
  // drop exactly the men this whole thing is about. Readers take the rows that
  // are not marked 'U' (models.keptRows) rather than a fixed slice.
  function toStoreShape(ledger) {
    const out = {};
    for (const [handle, men] of Object.entries(ledger)) {
      if (!HANDLES.has(handle)) continue;
      const rows = men.map((m) => [m.name, 'VL']);
      while (rows.length < 4) rows.push(['', '']);
      out[handle] = rows;
    }
    return out;
  }

  // The keeper store is keyed by player NAME, so provenance has to be too.
  function nameFrom(moves, handleOf, nameOf) {
    const byId = cameFrom(moves, handleOf);
    const out = {};
    for (const [id, handle] of Object.entries(byId)) {
      const hit = nameOf(id);
      if (hit) out[hit.name] = handle;
    }
    return out;
  }

  $: rosters = $rostersQ.data;
  $: users = $usersQ.data;
  $: players = $playersQ.data;

  $: pending = pendingMoves(($txnQ.data || []).flat());

  $: if (Array.isArray(rosters) && Array.isArray(users) && players) {
    const uh = userHandleMap(users);
    const nameOf = (id) => {
      const p = players[String(id)];
      return p ? { name: p[0], pos: p[1] } : null;
    };
    const declaredLedger = keeperLedger(rosters, uh, nameOf);
    const handleOf = Object.fromEntries(rosters.map((r) => [r.roster_id, uh[r.owner_id]]));

    // SETTLE THE DEALS THAT ARE ALREADY DONE.
    //
    // A keeper traded in principle is declared by the manager who still holds
    // him, because Sleeper will not accept a declaration otherwise, but the deal
    // is not conditional and cannot be backed out of. So every surface that
    // reasons about a SQUAD — the mock draft, roster need, who owns whom — is
    // given the roster each manager will actually have: Nacua under Ryan, Lamb
    // and Flowers under ImyHunter.
    //
    // The draft BOARD is deliberately not settled and reads the declarations
    // directly (see DraftRoom): joshleota declared Nacua, so the keeper sits on
    // joshleota's own pick at 14.03 and costs him that round. Ownership of the
    // man and ownership of the pick are different things here.
    const ledger = settleLedger(declaredLedger, pending, handleOf);

    // MERGE, don't switch. An all-or-nothing swap meant one manager who hadn't
    // declared dropped the whole league back to guesses — so nine known answers
    // were thrown away to avoid admitting one unknown. Take the truth wherever
    // it exists and leave the projection standing only where it doesn't; the
    // Keepers page names anyone still short.
    //
    // "Declared" is judged on what the manager himself put up, before settling:
    // jpdonners declared three and sold two, and he is answered for even though
    // one man is left.
    const shaped = toStoreShape(ledger);
    const live = {};
    for (const h of Object.keys(shaped)) {
      if ((declaredLedger[h] || []).length) live[h] = shaped[h];
    }
    keepers.setLive(Object.keys(live).length ? live : null);
    keeperFrom.set(nameFrom(pending, handleOf, nameOf));
  }

  // PICK CAPITAL, this season and next. The futures column matters as much as
  // this year's: one manager is sitting on four 2027 first-rounders and the
  // hand-written constant has him at zero.
  $: if (Array.isArray(rosters) && Array.isArray(users) && $realQ.data?.traded) {
    const rosterHandle = Object.fromEntries(rosters.map((r) => [r.roster_id, userHandleMap(users)[r.owner_id]]));
    const rounds = $realQ.data?.draft?.settings?.rounds || 15;
    const season = Number($realQ.data?.draft?.season || new Date().getFullYear());
    capital.set({
      [String(season)]: capitalFor(season, rounds, $realQ.data.traded, rosterHandle),
      [String(season + 1)]: capitalFor(season + 1, rounds, $realQ.data.traded, rosterHandle),
    });
  }
</script>
