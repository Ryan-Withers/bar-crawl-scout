// Shared draft-room furniture. Colours are the four position inks the wall
// board has always used (Day Room palette everywhere else — no new systems).
export const POSC = { QB: '#B07818', RB: '#1D8A4E', WR: '#2F7FB8', TE: '#8A4FBF' };
export const posColor = (pos) => POSC[pos] || '#5C6B7A';
export const POS_TABS = ['ALL', 'QB', 'RB', 'WR', 'TE'];

// Two letters for the avatar chip: first letters of the first two words,
// falling back to the first two characters of a single-word name.
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
