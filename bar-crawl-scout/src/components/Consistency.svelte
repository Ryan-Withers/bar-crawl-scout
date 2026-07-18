<script>
  // CONSISTENCY — floor/ceiling/volatility read on a player's played weeks.
  // Paper card, sibling to the Game Log. Empty until >=3 weeks are on file.
  import { profileWeeks } from '../lib/engine/consistency.ts';

  export let weekly = [];     // league-scored points, played weeks only
  export let loading = false;

  $: p = profileWeeks(weekly);
  const VERDICT = {
    STEADY: { tag: 'ROCK STEADY', note: 'set and forget — tight week to week' },
    STREAKY: { tag: 'STREAKY', note: 'swings, but within reason' },
    VOLATILE: { tag: 'BOOM OR BUST', note: 'league-winner or bench-burner, no in-between' },
  };
</script>

<div class="con">
  <div class="hd">Consistency</div>
  {#if p}
    <div class="card">
      <div class="verdict {p.verdict.toLowerCase()}">
        <span class="badge">{VERDICT[p.verdict].tag}</span>
        <span class="note">{VERDICT[p.verdict].note}</span>
      </div>

      <!-- floor — mean — ceiling as a range bar -->
      <div class="range">
        <div class="ends"><span>floor</span><span>ceiling</span></div>
        <div class="bar">
          <div class="fill" style="--lo:{p.ceiling ? (p.mean / p.ceiling) * 100 : 0}%"></div>
          <span class="dot floor" title="worst week">{p.floor}</span>
          <span class="dot mean" title="average">{p.mean}</span>
          <span class="dot ceil" title="best week">{p.ceiling}</span>
        </div>
      </div>

      <div class="grid">
        <div class="cell"><b>{p.mean}</b><span>PPG</span></div>
        <div class="cell"><b>±{p.vol}</b><span>VOLATILITY</span></div>
        <div class="cell"><b>{Math.round(p.cv * 100)}%</b><span>REL. SWING</span></div>
        <div class="cell boom"><b>{p.boomPct}%</b><span>BOOM WKS</span></div>
        <div class="cell bust"><b>{p.bustPct}%</b><span>BUST WKS</span></div>
        <div class="cell"><b>{p.weeks}</b><span>WEEKS</span></div>
      </div>
    </div>
  {:else}
    <div class="empty">{loading ? 'Reading the weekly swings…' : 'Need at least three played weeks — box scores load in your browser.'}</div>
  {/if}
</div>

<style>
  .con { margin-top: 2px; }
  .hd { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin-bottom: 12px; }
  .card { background: var(--paper); color: var(--ink); border-radius: 5px; padding: 14px; box-shadow: inset 0 0 0 1px rgba(28,26,22,.12); }
  .verdict { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .badge { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: .02em; padding: 3px 9px; border-radius: 4px; color: #fff; }
  .verdict.steady .badge { background: #2e7d46; }
  .verdict.streaky .badge { background: #2f7fb8; }
  .verdict.volatile .badge { background: #b5442f; }
  .note { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); }

  .range { margin-bottom: 14px; }
  .ends { display: flex; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 5px; }
  .bar { position: relative; height: 26px; background: rgba(28,26,22,.08); border-radius: 5px; }
  .fill { position: absolute; inset: 0 auto 0 0; width: var(--lo); background: rgba(47,127,184,.18); border-radius: 5px; }
  .dot { position: absolute; top: 50%; transform: translate(-50%, -50%); font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }
  .dot.floor { left: 6%; color: #b5442f; }
  .dot.mean { left: 50%; color: #fff; background: #2f7fb8; }
  .dot.ceil { left: 94%; color: #2e7d46; }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cell { background: rgba(28,26,22,.04); border-radius: 5px; padding: 8px 6px; text-align: center; }
  .cell b { display: block; font-family: 'Archivo Black', sans-serif; font-size: 17px; color: var(--ink); }
  .cell span { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: .08em; color: var(--ink-soft); }
  .cell.boom b { color: #2e7d46; }
  .cell.bust b { color: #b5442f; }

  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); }
  @media (max-width: 420px) { .grid { grid-template-columns: repeat(3, 1fr); gap: 6px; } .cell b { font-size: 15px; } }
</style>
