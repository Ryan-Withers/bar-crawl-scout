<script>
  // THE SECOND BOARD — the redraft league, on the same engine.
  //
  // There is nothing in here but a league. Everything that differs between the
  // two rooms — twelve teams instead of ten, fourteen rounds instead of fifteen,
  // the half-PPR price instead of the IDP one, a pool with nobody kept out of it
  // — is read from the league's own settings by the same code that serves the
  // other board. A second copy of that page would have drifted from it inside a
  // week, and the user has said outright that changes are still coming.
  import Sheet from './Sheet.svelte';
  import { LEAGUES } from '../lib/leagues.js';
</script>

<Sheet league={LEAGUES.kings} />
