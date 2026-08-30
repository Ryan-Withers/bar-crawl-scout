<script>
  // HOME — the front door. A newcomer should be able to read this page once and
  // know everything the app does, then click straight into it.
  import { link } from '../lib/router.js';
  import { createQuery } from '@tanstack/svelte-query';
  import { SECTIONS } from '../lib/nav.js';
  import { rosters } from '../lib/store.js';
  import { foundingQuery } from '../api/queries';
  import NeonSign from './NeonSign.svelte';
  import { usePhase } from '../lib/usePhase.js';

  const founding = createQuery(foundingQuery());
  $: year = $founding.data;
  $: sub = (year ? `EST. ${year} · ` : '') + '10 SEATS · HALF-PPR · KEEPER LEAGUE';
  $: synced = $rosters && $rosters.byHandle && Object.keys($rosters.byHandle).length > 0;

  // THE FRONT DOOR CHANGES JOB WHEN THE LEAGUE DOES.
  //
  // Six days before the draft, "run a mock" is the most useful thing on this
  // page. Six minutes after it, it is the least — and the thing everybody wants
  // is the verdict on the night. Nobody should have to go and find it, and
  // nobody should have to deploy a change to make it appear.
  const phaseStore = usePhase();
  $: planning = $phaseStore.planning;
  $: drafting = $phaseStore.drafting;
  $: countdown = $phaseStore.countdown;

  const PREP_STEP = { n: 3, t: 'Prep for the draft', d: 'Run a full mock draft against ten computer GMs you can tune.', to: '/mock', cta: 'Run a mock draft' };
  const LIVE_STEP = { n: 3, t: 'The draft is on', d: 'The live board, with every man struck off as he goes.', to: '/draftboard', cta: 'Open the draft board' };
  const DONE_STEP = { n: 3, t: 'See how the draft went', d: "Every manager graded on the picks they actually made, against the value board.", to: '/grades', cta: 'Read the grades' };
  $: STEPS = [
    { n: 1, t: 'Check your team', d: 'Your lineup, your matchup and the points you might be leaving on the bench.', to: '/myteam', cta: 'Open my lineup' },
    { n: 2, t: 'Scout the league', d: 'Standings, power rankings and a dossier on every rival manager.', to: '/standings', cta: 'See the standings' },
    planning ? DONE_STEP : drafting ? LIVE_STEP : PREP_STEP,
  ];
</script>

<section class="home">
  <div class="hero">
    <NeonSign {sub} />
    <p class="tag">Your league's headquarters — lineups, scouting, the draft room and the side bets, all in one place.</p>
    {#if drafting}
      <p class="phase live" data-testid="phase-note">● The draft is under way.</p>
    {:else if planning}
      <p class="phase" data-testid="phase-note">The draft's done — <a href="/grades" use:link>see how everyone graded</a>.</p>
    {:else if countdown}
      <p class="phase" data-testid="phase-note">Draft <b>{countdown}</b>.</p>
    {/if}
    <div class="ctas">
      <a class="cta primary" href="/myteam" use:link>🏈 Set my lineup</a>
      {#if planning}
        <a class="cta" href="/grades" use:link>🎓 Draft grades</a>
      {:else}
        <a class="cta" href="/mock" use:link>🏟️ Run a mock draft</a>
      {/if}
      <a class="cta ghost" href="/standings" use:link>📊 League standings</a>
    </div>
    {#if !synced}
      <div class="hint" data-testid="sync-hint">
        <b>First time here?</b> Nothing to set up — live rosters load automatically when you open the app in a browser.
        Everything below works right now.
        <a href="/sync" use:link>Check sync status →</a>
      </div>
    {/if}
  </div>

  <div class="steps" data-testid="steps">
    {#each STEPS as s}
      <a class="step" href={s.to} use:link>
        <span class="num">{s.n}</span>
        <b>{s.t}</b>
        <i>{s.d}</i>
        <span class="go">{s.cta} →</span>
      </a>
    {/each}
  </div>

  <h2 class="everything">Everything in here</h2>
  <p class="everysub">Six areas, {SECTIONS.reduce((n, s) => n + s.items.length, 0)} tools. Tap any card to open it.</p>

  {#each SECTIONS as s (s.id)}
    <div class="group" data-testid="group-{s.id}">
      <div class="ghd"><span class="gico">{s.icon}</span><h3>{s.label}</h3><em>{s.blurb}</em></div>
      <div class="cards">
        {#each s.items as i (i.path)}
          <a class="card" href={i.path} use:link data-testid="card-{i.path.slice(1)}">
            <span class="cico">{i.icon}</span>
            <b class="clbl">{i.label}{#if i.badge}<span class="cbadge">{i.badge}</span>{/if}</b>
            <i class="cdesc">{i.desc}</i>
            {#if i.flavour && i.flavour !== i.label}<span class="cflav">aka “{i.flavour}”</span>{/if}
          </a>
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  .phase { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--muted); margin: -4px 0 10px; }
  .phase.live { color: #4fb286; font-weight: 700; }
  .phase a { color: var(--neon); }
  .home { padding-top: 4px; }

  .hero { margin-bottom: 22px; }
  .tag { font-family: var(--mono); font-size: 13px; line-height: 1.65; color: var(--muted); margin: 14px 0 0; max-width: 68ch; }
  .ctas { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  .cta {
    display: inline-flex; align-items: center; gap: 7px; min-height: 46px; padding: 11px 18px;
    border-radius: 11px; text-decoration: none; font-family: var(--display); font-weight: 800;
    font-size: 14px; border: 1px solid var(--line); background: #fff; color: var(--chalk);
  }
  .cta.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
  .cta.primary:hover { background: var(--blue-deep); }
  .cta:hover { border-color: var(--blue); }
  .cta.ghost { color: var(--muted); }
  .hint {
    margin-top: 16px; padding: 13px 15px; border-radius: 11px; background: var(--blue-wash);
    border: 1px solid rgba(47,127,184,.25); font-family: var(--mono); font-size: 12px;
    line-height: 1.65; color: var(--chalk); max-width: 80ch;
  }
  .hint a { color: var(--blue); font-weight: 700; text-decoration: none; margin-left: 4px; }

  .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 0 0 30px; }
  .step {
    position: relative; display: flex; flex-direction: column; gap: 5px; padding: 16px 16px 14px;
    background: #fff; border: 1px solid var(--line); border-radius: 13px; text-decoration: none;
    box-shadow: 0 6px 18px -14px rgba(28,46,64,.5);
  }
  .step:hover { border-color: var(--blue); }
  .step .num {
    width: 24px; height: 24px; border-radius: 999px; background: var(--blue-wash); color: var(--blue-deep);
    display: grid; place-items: center; font-family: var(--display); font-weight: 800; font-size: 12px;
  }
  .step b { font-family: var(--display); font-size: 16px; color: var(--chalk); }
  .step i { font-style: normal; font-family: var(--mono); font-size: 11.5px; line-height: 1.6; color: var(--muted); }
  .step .go { margin-top: 4px; font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--blue); }

  .everything { font-family: var(--display); font-weight: 800; font-size: 20px; color: var(--chalk); margin: 0 0 4px; }
  .everysub { font-family: var(--mono); font-size: 11.5px; color: var(--muted); margin: 0 0 16px; }

  .group { margin-bottom: 24px; }
  .ghd { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
  .ghd .gico { font-size: 15px; }
  .ghd h3 { margin: 0; font-family: var(--display); font-weight: 800; font-size: 15px; text-transform: uppercase; letter-spacing: .03em; color: var(--blue-deep); }
  .ghd em { font-style: normal; font-family: var(--mono); font-size: 11px; color: var(--muted); }

  /* Wide screens show more, not wider — the whole point of the overhaul. */
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(262px, 1fr)); gap: 12px; }
  .card {
    display: flex; flex-direction: column; gap: 4px; padding: 14px 15px;
    background: #fff; border: 1px solid var(--line); border-radius: 12px; text-decoration: none;
    transition: border-color .12s ease, transform .12s ease;
  }
  .card:hover { border-color: var(--blue); transform: translateY(-1px); }
  .cico { font-size: 18px; }
  .clbl { display: flex; align-items: center; gap: 7px; font-family: var(--display); font-size: 15px; color: var(--chalk); }
  .cbadge { font-family: var(--mono); font-size: 8px; letter-spacing: .06em; color: #fff; background: var(--blue); border-radius: 999px; padding: 2px 7px; }
  .cdesc { font-style: normal; font-family: var(--mono); font-size: 11.5px; line-height: 1.6; color: var(--muted); }
  .cflav { font-family: var(--mono); font-size: 10px; color: var(--blue); opacity: .85; margin-top: 2px; }

  @media (max-width: 620px) {
    .cards { grid-template-columns: 1fr; }
    .cta { flex: 1 1 100%; justify-content: center; }
  }
</style>
