import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base matches the GitHub Pages project path so real URLs (/bar-crawl-scout/book)
// resolve assets on deep page loads (404.html fallback serves the app).
export default defineConfig({
  base: '/bar-crawl-scout/',
  plugins: [svelte()],
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./vitest.setup.js'], // frozen clock + no-network tripwire
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      reporter: ['text-summary', 'html'],
      // Floor set just under current (74% lines / 80% branches) so coverage can
      // only go up. Raise these as suites are added; never lower them.
      thresholds: { statements: 72, branches: 78, functions: 74, lines: 72 },
    },
  },
});
