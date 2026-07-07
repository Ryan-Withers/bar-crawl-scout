<script>
  import { link } from 'svelte-spa-router';
  import { createQuery } from '@tanstack/svelte-query';
  import { rosterShape } from '../lib/engine/league-config.ts';
  import { leagueQuery } from '../api/queries';
  import Skeleton from './Skeleton.svelte';

  const leagueQ = createQuery(leagueQuery());
  $: league = $leagueQ.data;
  $: shape = league ? rosterShape(league.roster_positions || []) : null;
  $: scoring = league ? Object.entries(league.scoring_settings || {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])) : [];
  $: settings = (league && league.settings) || {};

  const LABEL = {
    pass_yd: 'Passing yd', pass_td: 'Passing TD', pass_int: 'Interception', pass_2pt: 'Pass 2-pt',
    rush_yd: 'Rushing yd', rush_td: 'Rushing TD', rush_2pt: 'Rush 2-pt',
    rec: 'Reception', rec_yd: 'Receiving yd', rec_td: 'Receiving TD', rec_2pt: 'Rec 2-pt',
    bonus_rec_te: 'TE reception bonus', fum_lost: 'Fumble lost', fum_rec_td: 'Fumble rec TD',
    xpm: 'Extra point', fgm: 'Field goal', fgmiss: 'FG miss',
    def_td: 'DEF TD', sack: 'Sack', int: 'DEF interception', ff: 'Forced fumble', pts_allow_0: 'Shutout',
  };
  const label = (k) => LABEL[k] || k.replace(/_/g, ' ');
  const WT = { std: 'Standard', ppr: 'PPR', half_ppr: 'Half-PPR' };
  const waiverType = (s) => (s.waiver_type === 2 ? 'FAAB' : s.waiver_type === 1 ? 'Rolling' : s.waiver_type === 0 ? 'Reverse standings' : '—');
</script>

<section class="office">
  <div class="eyebrow">File 11 / The Back Office</div>
  <p class="blurb">The exact league config from Sleeper — the same scoring that drives every WIN, R26 and points number on this site. No hardcoding, no half-PPR guesses.</p>

  {#if league}
    <div class="grid">
      <div class="card">
        <h3>The League</h3>
        <div class="kv"><span>Name</span><b>{league.name}</b></div>
        <div class="kv"><span>Season</span><b>{league.season}</b></div>
        <div class="kv"><span>Status</span><b>{league.status}</b></div>
        {#if settings.num_teams}<div class="kv"><span>Teams</span><b>{settings.num_teams}</b></div>{/if}
        <div class="kv"><span>Waivers</span><b>{waiverType(settings)}</b></div>
        {#if settings.waiver_budget}<div class="kv"><span>FAAB budget</span><b>${settings.waiver_budget}</b></div>{/if}
        {#if settings.playoff_teams}<div class="kv"><span>Playoff teams</span><b>{settings.playoff_teams}</b></div>{/if}
      </div>

      {#if shape}
        <div class="card">
          <h3>The Lineup <span class="hint">{shape.startCount} start · {shape.bench} bench</span></h3>
          <div class="slots">
            {#each shape.starters as s}<span class="slot">{s.n}× {s.pos}</span>{/each}
            {#if shape.bench}<span class="slot bn">{shape.bench}× BN</span>{/if}
          </div>
        </div>
      {/if}
    </div>

    <div class="card wide">
      <h3>The Scoring <span class="hint">points = Σ (stat × weight)</span></h3>
      <div class="scoring">
        {#each scoring as [k, v]}
          <div class="srow"><span class="sk">{label(k)}</span><span class="sv" class:neg={v < 0}>{v > 0 ? '+' : ''}{v}</span></div>
        {/each}
      </div>
    </div>
  {:else if $leagueQ.isLoading}
    <div class="grid"><Skeleton rows={5} height={30} /><Skeleton rows={3} height={30} /></div>
    <div style="margin-top:12px"><Skeleton rows={4} height={26} /></div>
  {:else}
    <div class="empty">League config loads from Sleeper in your browser. Open the site in a real tab; the in-app preview blocks the network.</div>
  {/if}
</section>

<style>
  .office { max-width: 820px; padding-top: 6px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--neon); }
  .blurb { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 8px 0 16px; line-height: 1.6; max-width: 70ch; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .card { background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
  .card.wide { grid-column: 1 / -1; }
  h3 { font-family: 'Archivo Black', sans-serif; font-size: 13px; text-transform: uppercase; color: var(--chalk); margin: 0 0 10px; display: flex; align-items: baseline; gap: 8px; }
  .hint { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--muted); }
  .kv { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px dashed var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .kv:last-child { border-bottom: none; }
  .kv span { color: var(--muted); }
  .kv b { color: var(--chalk); }
  .slots { display: flex; flex-wrap: wrap; gap: 7px; }
  .slot { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; color: var(--neon); background: rgba(130,201,252,.1); border: 1px solid rgba(130,201,252,.25); border-radius: 6px; padding: 5px 9px; }
  .slot.bn { color: var(--muted); background: rgba(255,255,255,.04); border-color: var(--line); }
  .scoring { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px 16px; }
  .srow { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px dashed var(--line); font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
  .sk { color: var(--muted); text-transform: capitalize; }
  .sv { font-weight: 700; color: var(--neon); }
  .sv.neg { color: var(--stamp-red); }
  .empty { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); line-height: 1.7; max-width: 60ch; }
  @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
</style>
