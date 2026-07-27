<script>
  // THE SIDEBAR — every destination visible at once, grouped in plain English.
  // Desktop: hovering (or keyboard-focusing) an item flies out a card telling you
  // exactly what's under it before you click. Touch has no hover, so the mobile
  // drawer shows those same descriptions inline.
  import { link, location } from '../lib/router.js';
  import { SECTIONS, itemFor } from '../lib/nav.js';

  export let drawer = false;        // rendered inside the mobile drawer?
  export let onNavigate = () => {}; // drawer closes itself after a tap

  $: openItem = itemFor($location);
  $: isHome = $location === '/';
</script>

<nav class="sidenav" class:drawer aria-label="Main">
  <a
    class="navitem home"
    class:on={isHome}
    href="/"
    use:link
    on:click={onNavigate}
    data-testid="nav-home"
  >
    <span class="ico">🏠</span>
    <span class="lbl">Home</span>
    {#if drawer}<span class="desc">Everything this app can do, in one place.</span>{/if}
    {#if !drawer}
      <span class="flyout" role="presentation">
        <b>Home</b>
        <i>Everything this app can do, in one place.</i>
      </span>
    {/if}
  </a>

  {#each SECTIONS as s (s.id)}
    <div class="sect">
      <div class="secthd"><span class="sico">{s.icon}</span><span class="stxt">{s.label}</span><em>{s.blurb}</em></div>
      {#each s.items as i (i.path)}
        <a
          class="navitem"
          class:on={openItem && openItem.path === i.path}
          href={i.path}
          use:link
          on:click={onNavigate}
          data-testid="nav-{i.path.slice(1)}"
        >
          <span class="ico">{i.icon}</span>
          <span class="lbl">{i.label}</span>
          {#if i.badge}<span class="badge">{i.badge}</span>{/if}
          {#if drawer}<span class="desc">{i.desc}</span>{/if}
          {#if !drawer}
            <span class="flyout" role="presentation">
              <b>{i.label}{#if i.flavour && i.flavour !== i.label}<span class="fl"> · {i.flavour}</span>{/if}</b>
              <i>{i.desc}</i>
            </span>
          {/if}
        </a>
      {/each}
    </div>
  {/each}
</nav>

<style>
  .sidenav { display: flex; flex-direction: column; gap: 2px; padding: 10px 10px 30px; }

  .sect { margin-top: 14px; }
  .secthd {
    display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
    font-family: var(--mono); font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--muted); padding: 0 10px 6px;
  }
  .secthd .sico { font-size: 11px; }
  /* The rail stays dense so all six sections fit without scrolling; the section
     blurbs live on Home and in the roomier drawer. */
  .secthd em { display: none; font-style: normal; letter-spacing: 0; text-transform: none; font-size: 10px; opacity: .75; }
  .sidenav.drawer .secthd em { display: inline; }

  .navitem {
    position: relative; display: flex; align-items: center; gap: 9px;
    padding: 8px 10px; border-radius: 9px; text-decoration: none;
    color: var(--chalk); font-family: var(--body); font-size: 14px; font-weight: 600;
    border: 1px solid transparent;
  }
  .navitem .ico { font-size: 14px; width: 18px; text-align: center; flex: none; }
  .navitem .lbl { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .navitem:hover, .navitem:focus-visible { background: var(--blue-wash); outline: none; }
  .navitem.on { background: var(--blue-wash); border-color: rgba(47,127,184,.35); color: var(--blue-deep); }
  .navitem.on .lbl { font-weight: 800; }
  .navitem.home { margin-bottom: 2px; }
  .badge {
    margin-left: auto; font-family: var(--mono); font-size: 8px; letter-spacing: .06em;
    color: #fff; background: var(--blue); border-radius: 999px; padding: 2px 7px; flex: none;
  }

  /* Hover reveal: what's under this heading, before you commit to a click. */
  .flyout {
    position: absolute; left: calc(100% + 8px); top: 50%; transform: translateY(-50%) scale(.97);
    width: 236px; background: #fff; border: 1px solid var(--line); border-radius: 10px;
    box-shadow: 0 14px 34px -12px rgba(28,46,64,.4); padding: 10px 12px; z-index: 60;
    opacity: 0; pointer-events: none; transition: opacity .12s ease, transform .12s ease;
  }
  .flyout b { display: block; font-family: var(--display); font-size: 13px; color: var(--blue-deep); margin-bottom: 3px; }
  .flyout .fl { font-weight: 400; color: var(--muted); font-size: 11px; }
  .flyout i { font-style: normal; font-family: var(--mono); font-size: 11px; line-height: 1.55; color: var(--muted); }
  .navitem:hover .flyout, .navitem:focus-visible .flyout { opacity: 1; transform: translateY(-50%) scale(1); }

  /* Drawer (touch): no hover, so the description is simply always there. */
  .sidenav.drawer .navitem { align-items: flex-start; flex-wrap: wrap; padding: 11px 12px; min-height: 44px; }
  .sidenav.drawer .navitem .lbl { white-space: normal; }
  .sidenav.drawer .desc {
    flex-basis: 100%; padding-left: 27px; margin-top: 2px;
    font-family: var(--mono); font-size: 11px; font-weight: 400; line-height: 1.5; color: var(--muted);
  }
  .sidenav.drawer .sect { margin-top: 18px; }
</style>
