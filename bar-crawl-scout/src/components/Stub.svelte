<script>
  import { location } from 'svelte-spa-router';
  const NAMES = {
    '/': ['FILE 01', 'THE FRONT BAR'],
    '/matchups': ['FILE 07', 'GAMEDAY'],
    '/standings': ['FILE 08', 'THE TABLE'],
    '/history': ['FILE 09', 'THE WALL'],
    '/draft': ['FILE 10', 'THE WAR ROOM'],
    '/settings': ['FILE 11', 'THE BACK OFFICE'],
  };
  $: meta = NAMES[$location] || ['FILE ??', 'CLOSED'];
</script>

<section class="stub">
  <div class="eyebrow">{meta[0]} / {meta[1]}</div>
  <h2>{meta[1]}</h2>
  <p>Pouring… this room opens in a later phase of the build.</p>
</section>

<style>
  .stub { padding: 60px 0; text-align: left; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.22em; color: var(--neon); }
  h2 { font-family: 'Archivo Black', sans-serif; font-size: clamp(34px, 7vw, 68px); text-transform: uppercase; margin: 10px 0 8px; color: var(--chalk); opacity: 0.4; }
  p { font-family: 'IBM Plex Mono', monospace; color: var(--muted); font-size: 13px; }
</style>
