// THE BOUNCER — PlayerChip. Includes the regression lock for the mobile
// touch/hover fix: on a device that can't hover, a tap must NOT arm the preview
// card (there's no mouseleave to dismiss it), it must just navigate.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PlayerChip from '../src/components/PlayerChip.svelte';
import { hoverCard } from '../src/lib/store.js';

describe('PlayerChip', () => {
  beforeEach(() => hoverCard.set(null));
  afterEach(cleanup);

  it('renders the name and links to the encoded player file', () => {
    const { getByText } = render(PlayerChip, { props: { name: 'Joe Burrow' } });
    const a = getByText('Joe Burrow');
    expect(a.tagName).toBe('A');
    // svelte-spa-router's use:link writes the hash-routed href.
    expect(a.getAttribute('href')).toBe('#/player/Joe%20Burrow');
  });

  it('does NOT open the hover card on a non-hover (touch) device', async () => {
    // jsdom has no window.matchMedia -> canHover is false, so enter() is a no-op.
    const { getByText } = render(PlayerChip, { props: { name: 'Joe Burrow' } });
    await fireEvent.mouseEnter(getByText('Joe Burrow'));
    await new Promise((r) => setTimeout(r, 350)); // past the 300ms hover delay
    expect(get(hoverCard)).toBe(null);
  });
});
