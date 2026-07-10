<script>
  import { get } from 'svelte/store';
  import { runSync } from '../lib/sync.js';
  import { keepers, board, playerNotes, managerNotes, profileName } from '../lib/store.js';
  import { TEAMS } from '../lib/data.js';

  let status = null; // { kind: 'progress'|'done'|'error', ... }
  let backOut = '';
  let syncing = false;

  async function doSync() { syncing = true; status = null; await runSync((s) => (status = s)); syncing = false; }

  // ---- Cross-device: a shareable code (no server). Copy on one device, paste on another. ----
  let myCode = '';
  let pasteCode = '';
  let codeMsg = '';

  const padKeepers = (ks) => { for (const t of TEAMS) { if (!ks[t[0]]) ks[t[0]] = []; while (ks[t[0]].length < 4) ks[t[0]].push(['', '']); } return ks; };
  // UTF-8-safe base64 so names/notes with any character survive.
  const enc = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  const dec = (code) => JSON.parse(decodeURIComponent(escape(atob(code.trim()))));

  function snapshot() {
    return { v: 1, name: get(profileName) || '', ts: new Date().toISOString(),
      keepers: get(keepers), board: get(board), playerNotes: get(playerNotes), managerNotes: get(managerNotes) };
  }
  async function makeCode() {
    myCode = 'BCS1:' + enc(snapshot());
    codeMsg = '';
    try { await navigator.clipboard.writeText(myCode); codeMsg = 'Copied to clipboard — paste it on your other device.'; }
    catch { codeMsg = 'Select the code below and copy it.'; }
  }
  function restoreCode() {
    codeMsg = '';
    try {
      const raw = pasteCode.trim().replace(/^BCS1:/, '');
      const d = dec(raw);
      if (d.keepers) keepers.set(padKeepers(d.keepers));
      if (d.board) board.set(d.board);
      if (d.playerNotes) playerNotes.set(d.playerNotes);
      if (d.managerNotes) managerNotes.set(d.managerNotes);
      if (d.name) profileName.set(d.name);
      codeMsg = `Restored${d.name ? ' ' + d.name + "'s" : ''} data${d.ts ? ' from ' + new Date(d.ts).toLocaleString() : ''}.`;
      pasteCode = '';
    } catch (e) { codeMsg = 'That code did not read — check you copied all of it.'; }
  }

  function exportJSON() {
    const data = { keepers: get(keepers), board: get(board), exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'bar-crawl-hq-backup.json'; a.click();
    backOut = 'Exported.';
  }
  function importJSON() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(rd.result);
          if (d.keepers) { const ks = d.keepers; for (const t of TEAMS) { if (!ks[t[0]]) ks[t[0]] = []; while (ks[t[0]].length < 4) ks[t[0]].push(['', '']); } keepers.set(ks); }
          if (d.board) board.set(d.board);
          backOut = 'Imported.';
        } catch (e) { backOut = 'Import failed: ' + e.message; }
      };
      rd.readAsText(f);
    };
    inp.click();
  }
</script>

<section class="tab on">
  <div class="grid2">
    <div class="box"><h3>Sync Sleeper</h3>
      <div class="note" style="margin-bottom:10px">Live rosters load automatically when you open the site (from the sync Worker, refreshed hourly). Tapping Sync here also refreshes FAAB medians and 2024/2025 draft history. Runs in a real browser tab; inside an in-app preview the network is blocked.</div>
      <button class="go" on:click={doSync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync now'}</button>

      {#if status}
        {#if status.kind === 'progress'}
          <div class="out">{status.msg}</div>
        {:else if status.kind === 'error'}
          <div class="out"><span class="bd">Could not reach Sleeper.</span><br>{status.msg}<br><br>If you are in the in-app preview the network is blocked. Open this site in Chrome or Safari and tap Sync. Everything else works offline.</div>
        {:else}
          <div class="out">
            <div class="big">Synced</div>
            League: {status.league}<br>
            Users {status.users} · Rosters {status.rosters} · Traded picks {status.tradedPicks}<br>
            FAAB: <span class="wk">{status.faabWeeks} weeks, {status.nbids} bids</span>

            {#if status.roster}
              {#if status.roster.error}
                <div class="pmeta">Roster pull failed (rest still synced): {status.roster.error}</div>
              {:else}
                <div class="sline">Live rosters: <span class="wk">{status.roster.matched}/{status.roster.total} teams matched, {status.roster.totalPlayers} rostered players</span>{#if status.roster.unmatched.length} <span class="bd">— could not match: {status.roster.unmatched.join(', ')} (tell Ryan these Sleeper names)</span>{:else} — all teams matched.{/if}</div>
                <div class="maprows">TEAM MAPPING (verify each Sleeper name maps to the right manager):
                  {#each status.roster.mapRows as m}
                    <div class="mrow">roster {m.roster_id}: Sleeper "{m.sleeper}" → {#if m.matched}<b>{m.handle}</b>{:else}<span class="bd">UNMATCHED ({m.handle})</span>{/if} · {m.count} players</div>
                  {/each}
                </div>
              {/if}
            {/if}

            {#if status.draft}
              {#if status.draft.error}
                <div class="pmeta">Draft history pull failed (FAAB still synced): {status.draft.error}</div>
              {:else}
                <div class="sline">Drafts: <span class="wk">{status.draft.n24} picks 2024, {status.draft.n25} picks 2025, {status.draft.reps} repeat-pick affinities</span> — dossiers now show real history.</div>
              {/if}
            {/if}

            <div class="sline">Last synced: <span class="wk">{status.ts}</span></div>
            <div class="spenders"><b>Top FAAB spenders (real medians now live in the FAAB tab):</b>
              {#if status.topSpenders.length}
                {#each status.topSpenders as x}
                  <div class="mrow">{x.short}: median ${x.median}, max ${x.max}, spent ${x.spent} over {x.count} bids</div>
                {/each}
              {:else}<div class="mrow">no waiver bids found</div>{/if}
            </div>
          </div>
        {/if}
      {/if}
    </div>
    <div class="box"><h3>Backup file</h3>
      <div class="note" style="margin-bottom:10px">Export your keepers, board order and notes to a file, or import one back. Belt and braces so you never lose your work.</div>
      <div class="toolbar"><button class="add" on:click={exportJSON}>Export JSON</button><button class="add" on:click={importJSON}>Import JSON</button></div>
      <div class="pmeta">{backOut}</div>
    </div>
  </div>

  <!-- Cross-device: a copy-paste code carries your whole profile, no account needed. -->
  <div class="box wide"><h3>Move to another device</h3>
    <div class="note" style="margin-bottom:12px">No account, no server — your saved data (keepers, draft boards, notes) rides in one code. Name your profile, copy the code here, then paste it on your phone/other browser to bring everything across.</div>

    <div class="prow">
      <input class="pname" placeholder="Profile name (e.g. Ryan)" bind:value={$profileName} spellcheck="false" />
      <button class="add" on:click={makeCode}>Copy my code</button>
    </div>
    {#if myCode}<textarea class="code" readonly rows="3" on:focus={(e) => e.target.select()}>{myCode}</textarea>{/if}

    <div class="paste">
      <div class="ksub">Bring data in from another device</div>
      <textarea class="code" rows="3" placeholder="Paste a code that starts with BCS1:…" bind:value={pasteCode}></textarea>
      <button class="add" on:click={restoreCode} disabled={!pasteCode.trim()}>Restore from code</button>
    </div>
    {#if codeMsg}<div class="pmeta codemsg">{codeMsg}</div>{/if}
  </div>
</section>

<style>
  .box.wide { margin-top: 4px; }
  .prow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
  .pname { flex: 0 1 240px; }
  .code { width: 100%; font-family: 'IBM Plex Mono', monospace; font-size: 11px; background: #FFFFFF; border: 1px solid var(--line); color: var(--chalk); border-radius: 8px; padding: 9px 11px; resize: vertical; word-break: break-all; }
  .paste { margin-top: 12px; }
  .paste .add { margin-top: 8px; }
  .codemsg { color: #7fcfa6; margin-top: 8px; }
  .grid2 { align-items: stretch; }
  .box { display: flex; flex-direction: column; }
  .box .toolbar { margin-top: auto; }
  .box .toolbar .add { flex: 1; padding: 12px; font-size: 13px; }
  .sline { margin-top: 8px; }
  .maprows, .spenders { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 8px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; line-height: 1.7; color: var(--muted); }
  .mrow { margin-top: 2px; }
  .maprows b, .spenders b { color: var(--chalk); }
  .maprows .bd { color: var(--stamp-red); }
</style>
