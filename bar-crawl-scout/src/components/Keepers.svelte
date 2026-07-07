<script>
  import { TEAMS, PROJ, BYUNAME, RYAN } from '../lib/data.js';
  import { yearsLeft } from '../lib/models.js';
  import { keepers } from '../lib/store.js';

  $: ks = $keepers;

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
  const ylabel = (name) => (name ? (yearsLeft(name) === 1 ? 'final yr' : '2 yr') : '');
  const ycolor = (name) => (name ? (yearsLeft(name) === 1 ? '#e0613f' : '#4fb286') : '');
</script>

<section class="tab on">
  <div class="note"><b>Your projections.</b> Three keeper slots plus an <span class="badge b-u">UNLIKELY</span> watch slot per team. Tap the pill to flip <span style="color:#c3aee6">L</span> ↔ <span style="color:#e89178">VL</span>, × to clear. A 2025 keeper kept again is <span style="color:#e0613f">final year</span>; a fresh keep has <span style="color:#4fb286">2 years</span>.</div>
  <div class="kgrid">
    {#each TEAMS as t}
      {#if t[0] === RYAN}
        <div class="ked"><div class="kt">{t[1]} <span>@{t[0]}</span></div><div class="out" style="margin-top:4px">🔒 <b>CLASSIFIED.</b> Nice try. The commissioner's keepers are sealed. Go scout someone you can actually beat.</div></div>
      {:else}
        <div class="ked">
          <div class="kt">{t[1]} <span>@{t[0]}</span></div>
          {#each [0, 1, 2] as i}
            {@const s = (ks[t[0]] || [])[i] || ['', '']}
            <div class="kslot">
              <input list="plist" value={s[0] || ''} placeholder="keeper {i + 1}" on:change={(e) => onInput(t[0], i, e)} />
              <span class="cpill {s[1] || 'L'}" on:click={() => togglePill(t[0], i)} role="button" tabindex="0">{s[1] || 'L'}</span>
              <button class="kclr" on:click={() => clearSlot(t[0], i)}>×</button>
            </div>
            <div class="pmeta" style="margin:-1px 0 6px 2px">{#if s[0]}<span style="color:{ycolor(s[0])}">{ylabel(s[0])}</span>{/if}</div>
          {/each}
          <div class="ksub">Unlikely / watch (stays in pool)</div>
          <div class="kslot unl">
            <input list="plist" value={((ks[t[0]] || [])[3] || ['', ''])[0]} placeholder="could-be-kept" on:change={(e) => onInput(t[0], 3, e)} />
            <span class="cpill U">U</span>
            <button class="kclr" on:click={() => clearSlot(t[0], 3)}>×</button>
          </div>
        </div>
      {/if}
    {/each}
  </div>
  <button class="chip" style="margin-top:10px" on:click={resetAll}>Reset to my projections</button>
</section>
