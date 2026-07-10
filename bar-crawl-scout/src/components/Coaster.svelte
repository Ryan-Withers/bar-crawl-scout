<script>
  // Cardboard coaster: a stat badge with a double-ring edge. Used for records,
  // contract clocks, FAAB remaining, headline numbers.
  export let value = '';
  export let label = '';
  export let tone = 'neon'; // neon | brass | red | ink | muted
  export let sm = false;
</script>

<span class="coaster {tone}" class:sm>
  <b>{value}</b>
  {#if label}<small>{label}</small>{/if}
</span>

<style>
  .coaster {
    display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
    width: 58px; height: 58px; border-radius: 50%; flex: none;
    background: var(--barroom-lift);
    border: 2px solid var(--line);
    box-shadow: inset 0 0 0 3px rgba(28,46,64,.08), 0 3px 8px rgba(28,46,64,.14);
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    text-align: center;
  }
  .coaster.sm { width: 40px; height: 40px; box-shadow: inset 0 0 0 2px rgba(28,46,64,.08), 0 2px 5px rgba(28,46,64,.14); }
  .coaster b { font-family: 'Archivo Black', sans-serif; font-size: 17px; line-height: 1; color: var(--chalk); }
  .coaster.sm b { font-size: 12px; }
  .coaster small { font-size: 7.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-top: 3px; }
  .coaster.sm small { display: none; }
  .neon b { color: var(--neon); }
  .brass b { color: var(--brass); }
  .red b { color: var(--stamp-red); }
  .muted b { color: var(--muted); }
</style>
