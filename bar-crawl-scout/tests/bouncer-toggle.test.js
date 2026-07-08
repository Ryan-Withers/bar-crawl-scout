// THE BOUNCER (Fable File 03, Part 3) — component tests.
// Query by role/text like a user, never by class name.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ToggleSwitch from '../src/components/ToggleSwitch.svelte';
import { mode } from '../src/lib/store.js';

describe('ToggleSwitch — window mode', () => {
  beforeEach(() => mode.set('winnow'));
  afterEach(cleanup);

  it('renders all three window modes as buttons', () => {
    render(ToggleSwitch);
    expect(screen.getByRole('button', { name: /win-now/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /balanced/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /future/i })).toBeTruthy();
  });

  it('clicking a mode updates the shared store (re-sorts the board)', async () => {
    render(ToggleSwitch);
    await fireEvent.click(screen.getByRole('button', { name: /balanced/i }));
    expect(get(mode)).toBe('balanced');
    await fireEvent.click(screen.getByRole('button', { name: /future/i }));
    expect(get(mode)).toBe('future');
  });
});
