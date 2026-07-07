// Self-hosted fonts (no CDN dependency; works offline / as a PWA).
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/archivo-black';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/700.css';
import './app.css';
import App from './App.svelte';

const app = new App({ target: document.getElementById('app') });
export default app;
