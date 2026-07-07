<script>
  import { get } from 'svelte/store';
  import { runSync } from '../lib/sync.js';
  import { keepers, board } from '../lib/store.js';
  import { TEAMS } from '../lib/data.js';

  let syncOut = '';
  let backOut = '';
  let syncing = false;

  async function doSync() { syncing = true; await runSync((html) => (syncOut = html)); syncing = false; }

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
      {@html syncOut}
    </div>
    <div class="box"><h3>Backup</h3>
      <div class="note" style="margin-bottom:10px">Export your keepers, board order and notes, or import a backup. So you never lose data and can send it to me.</div>
      <div class="toolbar"><button class="add" on:click={exportJSON}>Export JSON</button><button class="add" on:click={importJSON}>Import JSON</button></div>
      <div class="pmeta">{backOut}</div>
    </div>
  </div>
</section>
