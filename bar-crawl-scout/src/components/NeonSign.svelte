<script>
  // The signature element (blueprint 1.4). A neon sign that flickers on, with one
  // letter that buzzes on a slow loop. prefers-reduced-motion kills all of it.
  export let sub = 'THE OFFICIAL BAR CRAWL ORDER · 10 SEATS · HALF-PPR · KEEPER';
</script>

<div class="neonwrap">
  <div class="neonsign" aria-label="Bar Crawl Scout">
    <span class="l1">BAR C<span class="buzz">R</span>AWL</span>
    <span class="l2">SCOUT</span>
  </div>
  <p class="est">{sub}</p>
</div>

<style>
  .neonwrap { padding: 6px 0 2px; }
  .neonsign {
    display: inline-block;
    font-family: 'Archivo Black', 'Archivo', sans-serif;
    text-transform: uppercase;
    color: var(--blue, #2F7FB8);
    line-height: 0.82;
    letter-spacing: 0.005em;
    animation: flickerOn 1.7s ease-out both;
  }
  .neonsign .l1 { display: block; font-size: clamp(30px, 6.5vw, 60px); margin-left: 0.12em; color: var(--blue-deep, #1C4E74); }
  .neonsign .l2 { display: block; font-size: clamp(56px, 13.5vw, 128px); }
  /* Daylight sign: deep-blue lettering with a soft sky halo — glows, not harsh. */
  .neonsign,
  .neonsign .buzz {
    text-shadow:
      0 1px 0 #FFFFFF,
      0 0 12px rgba(130, 201, 252, 0.55),
      0 0 30px rgba(130, 201, 252, 0.30);
  }
  .neonsign .buzz { animation: buzz 11s linear infinite 3.2s; }
  .est {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: clamp(9px, 1.1vw, 11px);
    letter-spacing: 0.22em;
    color: var(--muted, #5C6B7A);
    margin: 14px 0 0 0.3em;
    text-transform: uppercase;
  }

  @keyframes flickerOn {
    0% { opacity: 0; }
    4% { opacity: 0.75; }
    7% { opacity: 0.18; }
    10% { opacity: 0.9; }
    13% { opacity: 0.3; }
    16%, 100% { opacity: 1; }
  }
  /* brief buzz/dim of the R, once per loop */
  @keyframes buzz {
    0%, 96%, 100% { opacity: 1; }
    96.6% { opacity: 0.25; text-shadow: 0 0 3px #82C9FC; }
    97.2% { opacity: 1; }
    97.9% { opacity: 0.5; }
    98.5% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .neonsign, .neonsign .buzz { animation: none; opacity: 1; }
  }
</style>
