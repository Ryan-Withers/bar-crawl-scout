<script>
  import { TEAMS, PROJ, BYUNAME, PLAYERS, RYAN } from '../lib/data.js';
  import { yearsLeft, windowVal, isAvailable } from '../lib/models.js';
  import { keepers, mode, unlocked } from '../lib/store.js';
  import Stamp from './Stamp.svelte';
  import SeasonNote from './SeasonNote.svelte';

  $: ks = $keepers;
  $: md = $mode;

  // Best available (draftable) WIN per position — the "replacement" you'd draft instead.
  $: repl = (() => {
    const m = {};
    for (const p of PLAYERS) {
      if (isAvailable(ks, p[1])) { const w = windowVal(p, ks, md); if (w > (m[p[2]] || 0)) m[p[2]] = w; }
    }
    return m;
  })();
  function deltaOf(name) {
    const p = BYUNAME[name.toLowerCase()];
    if (!p) return null;
    return windowVal(p, ks, md) - (repl[p[2]] || 0);
  }

  function setSlot(team, slot, name) {
    keepers.update((k) => {
      if (!k[team]) k[team] = [['', ''], ['', ''], ['', ''], ['', '']];
      const conf = slot === 3 ? 'U' : ((k[team][slot] && k[team][slot][1] && k[team][slot][1] !== 'U') ? k[team][slot][1] : 'L');
      k[team][slot] = [name, conf];
      return k;
    });
  }
  function onInput(team, slot, e) {
    let v = e.target.value.trim();
    const m = BYUNAME[v.toLowerCase()];
    if (m) v = m[1];
    e.target.value = v;
    setSlot(team, slot, v);
  }
  function togglePill(team, slot) {
    keepers.update((k) => {
      if (!k[team] || !k[team][slot] || !k[team][slot][0]) return k;
      k[team][slot][1] = k[team][slot][1] === 'L' ? 'VL' : 'L';
      return k;
    });
  }
  const clearSlot = (team, slot) => setSlot(team, slot, '');
  function resetAll() {
    if (confirm('Reset all keepers to the audited projections?')) {
      const k = JSON.parse(JSON.stringify(PROJ));
      for (const t of TEAMS) { while (k[t[0]].length < 4) k[t[0]].push(['', '']); }
      keepers.set(k);
    }
  }
  const teamName = (h) => (TEAMS.find((t) => t[0] === h) || [h, h])[1];
</script>

<section class="ledger">
  <div class="lednote">
    <span class="eyebrow">File 02 / The Ledger</span>
    <SeasonNote page="keepers" />
  </div>

  <div class="grid">
    {#each TEAMS as t, ti}
      <div class="sheet">
        <div class="stitle">{teamName(t[0])} <span>@{t[0]}</span></div>
        {#if t[0] === RYAN && !$unlocked}
          <div class="sealed">🔒 <b>CLASSIFIED.</b> The commissioner's ledger is sealed. Go beat someone you can read.</div>
        {:else}
          {#each [0, 1, 2] as i}
            {@const s = (ks[t[0]] || [])[i] || ['', '']}
            {@const d = s[0] ? deltaOf(s[0]) : null}
            <div class="row">
              <input list="plist" value={s[0] || ''} placeholder="keeper {i + 1}" on:change={(e) => onInput(t[0], i, e)} />
              <button type="button" class="cpill {s[1] || 'L'}" on:click={() => togglePill(t[0], i)}>{s[1] || 'L'}</button>
              {#if s[0]}
                <span class="clock">
                  {#each Array(yearsLeft(s[0])) as _, y}<i>{26 + y}</i>{/each}
                  {#if yearsLeft(s[0]) === 1}<Stamp text="Last Call" tone="red" seed={ti * 4 + i} />{/if}
                </span>
                {#if d != null}<span class="delta" class:pos={d >= 0} class:neg={d < 0}>{d >= 0 ? '+' : ''}{d}</span>{/if}
              {/if}
              <button class="clr" on:click={() => clearSlot(t[0], i)} title="Clear">×</button>
            </div>
          {/each}
          {@const u = (ks[t[0]] || [])[3] || ['', '']}
          <div class="row watch">
            <input list="plist" value={u[0] || ''} placeholder="watch — stays in pool" on:change={(e) => onInput(t[0], 3, e)} />
            <span class="cpill U">U</span>
            <button class="clr" on:click={() => clearSlot(t[0], 3)} title="Clear">×</button>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <button class="reset" on:click={resetAll}>Reset to my projections</button>
</section>

<style>
  .ledger { padding-top: 6px; }
  .lednote { margin-bottom: 16px; }
  .lednote .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--neon); }
  .lednote :global(.note) { margin-top: 6px; margin-bottom: 0; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px; }
  .sheet {
    background: var(--paper); color: var(--ink); border-radius: 4px; padding: 16px 18px 18px;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(28, 26, 22, 0.1);
    background-image: repeating-linear-gradient(rgba(28, 26, 22, 0.055) 0 1px, transparent 1px 40px);
    background-position: 0 44px;
  }
  .stitle { font-family: 'Archivo Black', sans-serif; font-size: 15px; text-transform: uppercase; padding-bottom: 10px; border-bottom: 2px solid rgba(28, 26, 22, 0.3); margin-bottom: 6px; }
  .stitle span { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); font-weight: 400; text-transform: none; }
  .sealed { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #3a352a; padding: 14px 4px; line-height: 1.6; }

  .row { display: flex; align-items: center; gap: 9px; padding: 7px 0; min-height: 40px; border-bottom: 1px dashed rgba(28, 26, 22, 0.16); }
  .row.watch { border-bottom: none; opacity: 0.82; }
  .row input {
    flex: 1 1 auto; min-width: 90px; background: transparent; border: none; border-bottom: 1px solid rgba(28, 26, 22, 0.28);
    color: var(--ink); font-family: 'IBM Plex Mono', monospace; font-size: 13.5px; padding: 4px 2px; border-radius: 0;
  }
  .row input:focus { outline: none; border-bottom-color: #2f7fb8; }
  .cpill { font-family: 'IBM Plex Mono', monospace; font-size: 11px; line-height: 1; font-weight: 700; padding: 4px 8px; border-radius: 4px; cursor: pointer; border: 1.5px solid; background: transparent; flex: none; }
  .cpill.VL { color: #b5442f; border-color: #b5442f; }
  .cpill.L { color: #6a4fa0; border-color: #6a4fa0; }
  .cpill.U { color: var(--ink-soft); border-color: var(--ink-soft); cursor: default; }
  .clock { display: inline-flex; align-items: center; gap: 4px; flex: none; }
  .clock i { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid rgba(28, 26, 22, 0.5); font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; font-style: normal; color: #3a352a; }
  .delta { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; flex: none; min-width: 34px; text-align: right; }
  .delta.pos { color: #2f7fb8; }
  .delta.neg { color: var(--stamp-red); }
  .clr { flex: none; background: none; border: none; color: var(--ink-soft); font-size: 17px; cursor: pointer; line-height: 1; padding: 0 2px; }
  .clr:hover { color: var(--stamp-red); }

  .reset { margin-top: 16px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: var(--barroom-lift); color: var(--muted); border: 1px solid var(--line); border-radius: 8px; padding: 9px 16px; cursor: pointer; }
  .reset:hover { color: var(--chalk); border-color: rgba(130, 201, 252, 0.4); }
</style>
