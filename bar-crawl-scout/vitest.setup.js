// Hermetic unit-test environment (Fable File 03, Parts 2.3 + 2.4).
import { vi } from 'vitest';

// FROZEN CLOCK — a fixed mid-season Wednesday. Fake ONLY Date (not setTimeout),
// so async/timers behave normally while the clock never drifts. Tests that need a
// game-window instant (Sunday 30s refetch) call vi.setSystemTime themselves.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2025-10-22T18:00:00Z')); // Wed, ~week 8

// NO-NETWORK TRIPWIRE — any live call in a unit test fails loudly. Data modules
// take an injected fetcher; production wires the real one, tests wire fixtures.
globalThis.fetch = (url) => {
  throw new Error(`NETWORK IN UNIT TEST: ${url} — load a fixture instead of fetching.`);
};
