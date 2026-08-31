// THE LEAGUES THIS APP KNOWS ABOUT.
//
// It was built for one, and one league id was hard-wired in two places. A second
// league does not want a second copy of the app — it wants the same engines
// pointed somewhere else, because everything that matters is already derived from
// the league's own settings: the ADP family comes off the roster positions, the
// replacement level off the pool, the draft depth off teams and rounds.
//
// So this holds only what CANNOT be derived:
//   id       — which league to ask Sleeper about
//   ns       — a namespace for anything saved locally, because two boards on one
//              device must not share a star, a tag or a custom ranking
//   dynasty  — whether the dynasty price is worth a column, which is a judgement
//              about the format rather than a fact in the data
//
// Everything else — keeper or redraft, ten teams or twelve, IDP or not — is read
// at runtime. Nothing here says "12 teams", on purpose: if Ryan adds a manager,
// the board should follow him without a code change.
export const LEAGUES = {
  // The keeper league the app was built for. `ns: ''` keeps its existing
  // localStorage keys EXACTLY as they are — anyone with a saved board, a set of
  // favourites or their own ranking keeps them, which a rename would silently
  // throw away.
  bar: {
    key: 'bar',
    id: '1311995695032467456',
    name: 'Bar Crawl',
    blurb: "your draft room's own numbers, against the scoring the market prices them on",
    ns: '',
    dynasty: true,
  },
  // The redraft league. Its own namespace, and no dynasty column: nobody is
  // keeping anyone, so what the market pays for a player's future is not a
  // question this room ever has to answer.
  kings: {
    key: 'kings',
    id: '1397440173184172032',
    name: 'Re-Draft Kings',
    blurb: 'redraft — twelve teams, fourteen rounds, everyone starts empty',
    ns: 'kings',
    dynasty: false,
  },
};

export const leagueByKey = (key) => LEAGUES[key] || LEAGUES.bar;

/**
 * A localStorage key for a league. The default league keeps the bare key it has
 * always used; every other league is suffixed. This is what stops a star put on
 * a man for one draft appearing on the other board — and the two drafts are two
 * hours apart on the same afternoon, so that is not a hypothetical.
 */
export const nsKey = (league, key) => (league && league.ns ? `${key}__${league.ns}` : key);
