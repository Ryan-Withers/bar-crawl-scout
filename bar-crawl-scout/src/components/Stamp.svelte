<script>
  // Rubber stamp. Never sits straight — rotation is seeded so it's stable across renders.
  export let text = 'CLASSIFIED';
  export let tone = 'red'; // red | neon | brass | ink
  export let seed = 0;
  export let big = false;
  $: rot = (((seed * 53 + 17) % 15) - 7); // -7..7deg, deterministic
</script>

<span class="stamp {tone}" class:big style="--rot:{rot}deg">{text}</span>

<style>
  .stamp {
    display: inline-block;
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    font-size: 10px;
    line-height: 1.1;
    padding: 3px 7px;
    border: 2px solid currentColor;
    border-radius: 3px;
    transform: rotate(var(--rot));
    opacity: 0.82;
    white-space: nowrap;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent);
  }
  .stamp.big { font-size: 22px; letter-spacing: 0.14em; padding: 8px 16px; border-width: 3px; }
  .red { color: var(--stamp-red); }
  .neon { color: #2f7fb8; } /* neon reads as a darker ink stamp on paper */
  .brass { color: var(--brass); }
  .ink { color: #4a4636; }
</style>
