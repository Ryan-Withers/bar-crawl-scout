// THE BOUNCER — HoverCard. Two contracts:
//  1. On touch (no hover) it renders NOTHING even when the store is set (the
//     mobile safety net — no stuck card over the file a tap just opened).
//  2. On a hover-capable device it renders the ownership plate for the player.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

describe('HoverCard', () => {
  afterEach(cleanup);
  it('renders nothing on a non-hover device even when the store is set', async () => {
    delete window.matchMedia; // touch: canHover false
    vi.resetModules();
    const { hoverCard } = await import('../src/lib/store.js');
    const { default: HoverCard } = await import('../src/components/HoverCard.svelte');
    hoverCard.set({ name: 'Joe Burrow', x: 10, y: 10 });
    const { container } = render(HoverCard);
    expect(container.querySelector('.hc')).toBeNull();
  });

  it('shows an ownership plate on a hover-capable device', async () => {
    window.matchMedia = (q) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
    vi.resetModules();
    const { hoverCard } = await import('../src/lib/store.js');
    const { default: HoverCard } = await import('../src/components/HoverCard.svelte');
    hoverCard.set({ name: 'Joe Burrow', x: 10, y: 10 });
    const { findByText } = render(HoverCard);
    // One of the four ownership states must render — proves the card populated.
    const plate = await findByText(/FREE AGENT|PROPERTY OF|ON .+ROSTER|CLASSIFIED/);
    expect(plate).toBeTruthy();
  });
});
