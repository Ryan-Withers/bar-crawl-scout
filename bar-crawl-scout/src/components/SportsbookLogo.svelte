<script>
  // Original crown mark for the league's in-house sportsbook (a parody sponsor).
  export let size = 22;
  export let showWord = true;
</script>

<span class="sb" style="--s:{size}px">
  <svg viewBox="0 0 32 26" width={size * 1.23} height={size} aria-hidden="true">
    <path d="M2 8 L8 14 L16 3 L24 14 L30 8 L27 23 L5 23 Z" fill="#111a12" stroke="#12ff6e" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="2" cy="8" r="2.2" fill="#12ff6e"/><circle cx="30" cy="8" r="2.2" fill="#12ff6e"/><circle cx="16" cy="3" r="2.2" fill="#12ff6e"/>
    <rect x="5" y="20" width="22" height="3" rx="1" fill="#12ff6e"/>
  </svg>
  {#if showWord}<b>DINGER<span>KINGS</span></b>{/if}
</span>

<style>
  .sb { display: inline-flex; align-items: center; gap: 7px; }
  .sb b { font-family: 'Archivo Black', sans-serif; font-size: calc(var(--s) * 0.72); letter-spacing: -.01em; color: #eafff1; text-transform: uppercase; line-height: 1; }
  .sb b span { color: #12ff6e; }
</style>
