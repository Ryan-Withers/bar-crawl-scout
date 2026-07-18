// THE BOUNCER — Consistency card. Proves the engine's verdict + numbers reach
// the DOM, and that too-few weeks fall back to the empty state (not a broken card).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Consistency from '../src/components/Consistency.svelte';

describe('Consistency card', () => {
  afterEach(cleanup);

  it('renders the verdict badge and the key numbers for a boom-or-bust player', () => {
    const { getByText, container } = render(Consistency, { props: { weekly: [2, 30, 4, 28, 3, 23] } });
    expect(getByText('BOOM OR BUST')).toBeTruthy();
    expect(container.querySelector('.verdict.volatile')).toBeTruthy();
    // mean 15 shows in the PPG cell; boom/bust cells are populated.
    const cells = [...container.querySelectorAll('.cell')].map((c) => c.textContent);
    expect(cells.some((t) => t.includes('15') && t.includes('PPG'))).toBe(true);
    expect(container.querySelector('.cell.boom b').textContent).toBe('50%');
    expect(container.querySelector('.cell.bust b').textContent).toBe('50%');
  });

  it('labels a tight scorer ROCK STEADY', () => {
    const { getByText, container } = render(Consistency, { props: { weekly: [14, 15, 16, 15, 14, 16] } });
    expect(getByText('ROCK STEADY')).toBeTruthy();
    expect(container.querySelector('.verdict.steady')).toBeTruthy();
  });

  it('shows the empty state with fewer than three played weeks', () => {
    const { getByText, container } = render(Consistency, { props: { weekly: [12, 18] } });
    expect(container.querySelector('.card')).toBeNull();
    expect(getByText(/at least three played weeks/i)).toBeTruthy();
  });
});
