<script>
  // Shimmer placeholders for loading states — feels alive vs a line of grey text.
  export let rows = 3;
  export let height = 46;
  export let gap = 8;
</script>

<div class="skel" style="gap:{gap}px" aria-hidden="true">
  {#each Array(rows) as _, i}<div class="bar" style="height:{height}px; opacity:{1 - i * 0.12}"></div>{/each}
</div>

<style>
  .skel { display: flex; flex-direction: column; }
  .bar {
    border-radius: 8px; border: 1px solid var(--line);
    background: linear-gradient(90deg, var(--barroom-lift) 25%, rgba(130,201,252,.08) 50%, var(--barroom-lift) 75%);
    background-size: 200% 100%; animation: shimmer 1.3s linear infinite;
  }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
</style>
