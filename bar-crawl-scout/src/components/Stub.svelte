<script>
  // The catch-all. Anything that isn't a real route lands here, so it has to
  // explain where you are and hand you a way back into the app.
  import { link, location } from '../lib/router.js';
  import { SECTIONS } from '../lib/nav.js';

  // A couple of rooms are genuinely not built yet — say so plainly.
  const PLANNED = {
    '/draft': 'The live draft room',
  };
  $: planned = PLANNED[$location] || null;
</script>

<section class="stub">
  {#if planned}
    <p class="lead"><b>{planned}</b> isn't built yet — this room opens in a later phase of the build. In the meantime, the <a href="/mock" use:link>Mock Draft</a> runs a full practice draft, and the <a href="/board" use:link>Big Board</a> holds your rankings.</p>
  {:else}
    <p class="lead">There's nothing at <code>{$location}</code>. Either the link was mistyped, or this room opens in a later phase of the build — nothing is broken, you just took a wrong turn.</p>
  {/if}

  <a class="homebtn" href="/" use:link>← Back to Home</a>

  <p class="sublead">Or jump straight to any room in the app:</p>

  <div class="map">
    {#each SECTIONS as s}
      <div class="scard">
        <div class="shd"><span class="sico" aria-hidden="true">{s.icon}</span> {s.label}</div>
        <p class="sblurb">{s.blurb}</p>
        <ul>
          {#each s.items as i}
            <li><a href={i.path} use:link><b>{i.label}</b><span>{i.desc}</span></a></li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
</section>

<style>
  .stub { padding-top: 4px; }
  .lead {
    font-family: 'IBM Plex Mono', monospace; font-size: 13px; line-height: 1.7; color: var(--muted);
    max-width: 72ch; margin: 0 0 14px;
  }
  .lead b { color: var(--chalk); }
  .lead a { color: var(--neon); }
  .lead code { font-size: 12.5px; color: var(--chalk); background: var(--field-3); border-radius: 4px; padding: 2px 6px; }
  .homebtn {
    display: inline-flex; align-items: center; min-height: 44px; padding: 10px 18px;
    font-family: var(--display); font-weight: 700; text-transform: uppercase; font-size: 13px;
    background: var(--accent); color: var(--on-neon); border-radius: 9px; text-decoration: none;
  }
  .homebtn:hover { filter: brightness(1.08); }
  .sublead { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); margin: 22px 0 10px; }

  .map { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px; align-items: start; }
  .scard { min-width: 0; background: var(--barroom-lift); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px 8px; }
  .shd { font-family: var(--display); font-weight: 800; text-transform: uppercase; font-size: 13px; color: var(--chalk); display: flex; align-items: center; gap: 7px; }
  .sico { font-size: 14px; }
  .sblurb { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); margin: 4px 0 8px; line-height: 1.5; }
  .scard ul { list-style: none; margin: 0; padding: 0; }
  .scard li { border-top: 1px dashed var(--line); }
  .scard li a {
    display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center;
    padding: 8px 2px; text-decoration: none;
  }
  .scard li a b { font-family: var(--body); font-weight: 700; font-size: 13.5px; color: var(--chalk); }
  .scard li a span { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); line-height: 1.45; }
  .scard li a:hover b { color: var(--neon); }
</style>
