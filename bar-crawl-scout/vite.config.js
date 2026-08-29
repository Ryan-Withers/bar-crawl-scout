import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// EVERY BUILD SIGNS ITSELF.
//
// GitHub Pages serves index.html with its own cache, so a browser that already
// has the page can keep serving the old one for several minutes after a deploy
// — which looks exactly like "the change didn't ship". The app cannot change
// those headers, but it can notice: this stamps the build id into the bundle
// AND writes it to a tiny version.json, and the running page re-reads that file
// with cache: 'no-store' and says when it has fallen behind.
const BUILD_ID = process.env.GITHUB_SHA?.slice(0, 7) || String(Date.now());

const stampVersion = () => ({
  name: 'stamp-version',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ id: BUILD_ID, built: new Date().toISOString() }),
    });
  },
});

// base matches the GitHub Pages project path so real URLs (/bar-crawl-scout/book)
// resolve assets on deep page loads (404.html fallback serves the app).
export default defineConfig({
  base: '/bar-crawl-scout/',
  plugins: [svelte(), stampVersion()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
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
