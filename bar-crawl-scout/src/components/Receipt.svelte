<script>
  export let heading = 'RECEIPT';
  export let subhead = '';
</script>

<div class="receipt">
  <div class="rh">{heading}</div>
  {#if subhead}<div class="rs">{subhead}</div>{/if}
  <div class="rrule"></div>
  <div class="rbody"><slot /></div>
  <div class="rrule"></div>
  <div class="rfoot"><slot name="foot">* * * THANK YOU FOR TRADING * * *</slot></div>
</div>

<style>
  .receipt {
    position: relative;
    background: #f5f1e6;
    color: #1c1a16;
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 12px;
    line-height: 1.65;
    padding: 18px 20px 20px;
    max-width: 460px;
    margin: 16px 0 22px;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(28, 26, 22, 0.08);
    background-image: repeating-linear-gradient(rgba(28, 26, 22, 0.035) 0 1px, transparent 1px 24px);
  }
  /* zigzag torn bottom edge */
  .receipt::after {
    content: '';
    position: absolute; left: 0; right: 0; bottom: -10px; height: 11px;
    background:
      linear-gradient(135deg, #f5f1e6 33%, transparent 0) 0 0 / 16px 11px repeat-x,
      linear-gradient(-135deg, #f5f1e6 33%, transparent 0) 0 0 / 16px 11px repeat-x;
    filter: drop-shadow(0 6px 6px rgba(0, 0, 0, 0.25));
  }
  .rh { font-family: 'Archivo Black', sans-serif; font-size: 16px; text-align: center; text-transform: uppercase; letter-spacing: 0.04em; }
  .rs { text-align: center; font-size: 10px; color: #5a5238; text-transform: uppercase; letter-spacing: 0.16em; margin-top: 3px; }
  .rrule { border-top: 1.5px dashed rgba(28, 26, 22, 0.35); margin: 12px 0; }
  .rfoot { text-align: center; font-size: 10px; letter-spacing: 0.12em; color: #5a5238; margin-top: 14px; }
  .receipt :global(.line) { display: flex; justify-content: space-between; gap: 12px; }
  .receipt :global(.line b) { font-weight: 700; }
  .receipt :global(.tot) { display: flex; justify-content: space-between; font-weight: 700; border-top: 1px solid rgba(28,26,22,.25); margin-top: 6px; padding-top: 6px; }
  .receipt :global(.why) { font-size: 11px; color: #3a352a; margin: 4px 0; }
  .receipt :global(.up) { color: #2f7fb8; font-weight: 700; }
  .receipt :global(.down) { color: var(--stamp-red); font-weight: 700; }
</style>
