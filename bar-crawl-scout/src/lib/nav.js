// NAVIGATION — one source of truth for every destination in the app.
// Powers the sidebar, the mobile sheet, the home dashboard cards, the hover
// reveals and the ⌘K palette, so a label written here is a label everywhere.
//
// Each item carries:
//   path   real URL
//   label  PLAIN ENGLISH first — what a newcomer would call it
//   flavour the bar-crawl nickname, kept as personality (never the only label)
//   desc   one line: what you actually do here
//   icon   a glyph for scanning
//   badge  optional short tag shown on the home cards

export const SECTIONS = [
  {
    id: 'team',
    label: 'My Team',
    icon: '🏈',
    blurb: 'Your roster, your week.',
    items: [
      { path: '/myteam', label: 'Lineup', flavour: 'Your Bench', icon: '📋',
        desc: 'Set your best starting side — we flag every point sitting on your bench.' },
      { path: '/matchup', label: 'This Week', flavour: 'The Matchup', icon: '⚔️',
        desc: 'Your projected score vs your opponent, and which positions decide it.' },
      { path: '/byes', label: 'Bye Weeks', flavour: 'Bye Radar', icon: '📅',
        desc: 'See the weeks your starters vanish, so you can plan a trade early.' },
    ],
  },
  {
    id: 'draft',
    label: 'Draft Room',
    icon: '🎯',
    blurb: 'Prep for draft day.',
    items: [
      { path: '/mock', label: 'Mock Draft', flavour: 'The War Room', icon: '🏟️', badge: 'Popular',
        desc: 'Run a full practice draft against ten customisable computer GMs.' },
      { path: '/board', label: 'Big Board', flavour: 'The Board', icon: '🗒️',
        desc: 'Every player ranked by your window — tag, sort and build your own draft list.' },
      { path: '/draftboard', label: 'Draft Board', flavour: 'The Board Room', icon: '📋',
        desc: 'The real 2026 board — every pick, who owns it after the trades, and the keepers sitting at the bottom.' },
      { path: '/keepers', label: 'Keepers', flavour: 'The Ledger', icon: '🔒',
        desc: "The three each manager has locked, straight off Sleeper — so you know exactly who's in the pool." },
      { path: '/trade', label: 'Trade Machine', flavour: 'Trade Desk', icon: '🤝',
        desc: 'Test a trade both ways and see who really wins it.' },
      { path: '/intel', label: 'Scouting Intel', flavour: 'Intel', icon: '🔍',
        desc: 'Reads and tendencies on the other managers before you make an offer.' },
      { path: '/vault', label: 'Past Drafts', flavour: 'The Vault', icon: '🗄️',
        desc: 'Every draft this league has held, and who still owns what they took.' },
    ],
  },
  {
    id: 'league',
    label: 'The League',
    icon: '🏆',
    blurb: 'How everyone is tracking.',
    items: [
      { path: '/standings', label: 'Standings', flavour: 'The Table', icon: '📊',
        desc: "Records, points and who's been lucky — plus the season record book." },
      { path: '/power', label: 'Power Rankings', flavour: 'Power', icon: '⚡',
        desc: 'Beyond the record: form, scoring and roster strength, with schedule difficulty.' },
      { path: '/playoffs', label: 'Playoff Race', flavour: 'The Race', icon: '🎟️',
        desc: "Who's in, who's out, and the magic number to lock a spot." },
      { path: '/matchups', label: 'Scoreboard', flavour: 'Gameday', icon: '📺',
        desc: "This week's games league-wide, with a pregame line on each one." },
      { path: '/managers', label: 'Managers', flavour: 'The Files', icon: '🗂️',
        desc: 'A dossier on all ten rivals: form, streaks, rivalries and habits.' },
      { path: '/history', label: 'History', flavour: 'The Wall', icon: '🏅',
        desc: 'Past champions, playoff brackets and the dynasty record.' },
    ],
  },
  {
    id: 'wire',
    label: 'Waiver Wire',
    icon: '📡',
    blurb: 'Find the next pickup.',
    items: [
      { path: '/players', label: 'Free Agents', flavour: 'The Wire', icon: '🧾',
        desc: "Every available player, who's trending, and the league's latest moves." },
      { path: '/waivers', label: 'FAAB Bids', flavour: 'FAAB Desk', icon: '💵',
        desc: 'What a player should cost you, and who else is likely bidding.' },
    ],
  },
  {
    id: 'book',
    label: 'Side Bets',
    icon: '🎲',
    blurb: 'The house game.',
    items: [
      { path: '/book', label: 'Markets', flavour: 'The Book', icon: '🎯',
        desc: 'Season futures and weekly props to bet with the boys.' },
      { path: '/leaderboard', label: 'Leaderboard', flavour: 'The Ledger', icon: '👑',
        desc: "Who's up, who's down, and every bet settled so far." },
    ],
  },
  {
    id: 'setup',
    label: 'Setup',
    icon: '⚙️',
    blurb: 'League settings and data.',
    items: [
      { path: '/settings', label: 'League Rules', flavour: 'The Rules', icon: '📜',
        desc: 'Scoring, roster slots and keeper rules pulled from Sleeper.' },
      { path: '/sync', label: 'Sync', flavour: 'Sync', icon: '🔄',
        desc: 'Refresh live rosters and check what data is loaded.' },
    ],
  },
];

// Flat list of every navigable item.
export const ALL_ITEMS = SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, group: s.id, groupLabel: s.label })));

// Detail routes that belong to a section but aren't their own nav item.
const DETAIL_PREFIXES = [
  ['/player', 'draft'],
  ['/compare', 'draft'],
  ['/managers/', 'league'],
];

const hit = (loc, path) => loc === path || loc.startsWith(path + '/');

// Which item is currently open (exact route match wins, then detail prefixes).
export function itemFor(loc) {
  const l = loc === '/' ? '/home' : loc;
  return ALL_ITEMS.find((i) => hit(l, i.path)) || null;
}

// Which section is currently open.
export function sectionFor(loc) {
  const l = loc === '/' ? '/home' : loc;
  const exact = ALL_ITEMS.find((i) => hit(l, i.path));
  if (exact) return SECTIONS.find((s) => s.id === exact.group) || null;
  const detail = DETAIL_PREFIXES.find(([p]) => l.startsWith(p));
  return detail ? SECTIONS.find((s) => s.id === detail[1]) || null : null;
}

// The handful of destinations that earn a slot in the mobile bottom bar.
export const QUICK_NAV = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/myteam', label: 'My Team', icon: '🏈' },
  { path: '/matchups', label: 'Scores', icon: '📺' },
  { path: '/mock', label: 'Mock', icon: '🏟️' },
];
