// HTML-escape helper, matching the pre-SPA app. Used where views build markup
// strings (dossiers, trade/FAAB output) that are injected with {@html}.
export const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
