// Parses BeatADP's platform-comparison board (https://www.beatadp.com/platform-adp)
// straight out of its server-rendered HTML.
//
// Deliberately avoids matching on BeatADP's CSS module class names (e.g.
// "AdpBoard-module__T-4u9G__row") beyond the stable "__row"/"__team"/etc.
// suffixes — the hash prefix changes on every BeatADP deploy. The one
// genuinely stable signal is each ADP cell's `title` attribute, which spells
// out the platform name in plain text ("ESPN — ADP 1.0, ..." or
// "Sleeper doesn't rank Jordan Whittington"), so parsing keys off that
// instead of column position or class names.
//
// As of 2026-09, BeatADP's own footnote on the page reads:
//   "Hidden as no longer maintained: Yahoo (last 2026-05-07), Underdog
//   (last 2026-05-06)."
// Yahoo cells are absent from the HTML entirely (not just hidden via CSS),
// so this parser only ever returns sleeper/espn/fantasypros — Yahoo has to
// come from elsewhere (see refresh-adp.js, which keeps the last frozen
// number FF ValueDiff already has on file).

const ROW_RE = /<tr class="[^"]*__row"[^>]*data-position="([A-Z]+)">([\s\S]*?)<\/tr>/g;
const NAME_RE = /title="Open ([\s\S]*?)&#x27;s profile"/;
const TEAM_RE = /__team">([A-Z]+)<\/span>/;
const CONSENSUS_RE = /__consensusValue">([\d.]+)<\/span>/;
const PLATFORM_CELL_RE = /title="([A-Za-z]+) (?:—\s*ADP\s*([\d.]+)|doesn&#x27;t rank)/g;

const PLATFORM_KEY = {
  sleeper: "sleeper",
  espn: "espn",
  fantasypros: "fantasypros",
  yahoo: "yahoo",
  underdog: "underdog",
};

function decodeEntities(str) {
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function slugify(name) {
  return decodeEntities(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(name) {
  return decodeEntities(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Returns players in the board's own order (already sorted by consensus ADP).
function parseBeatAdpHtml(html) {
  const players = [];
  let rowMatch;
  ROW_RE.lastIndex = 0;
  while ((rowMatch = ROW_RE.exec(html))) {
    const [, position, body] = rowMatch;

    const nameMatch = NAME_RE.exec(body);
    if (!nameMatch) continue;
    const name = decodeEntities(nameMatch[1]);

    const teamMatch = TEAM_RE.exec(body);
    const team = teamMatch ? teamMatch[1] : null;

    const consensusMatch = CONSENSUS_RE.exec(body);
    const consensus = consensusMatch ? parseFloat(consensusMatch[1]) : null;

    const adp = {};
    let cellMatch;
    PLATFORM_CELL_RE.lastIndex = 0;
    while ((cellMatch = PLATFORM_CELL_RE.exec(body))) {
      const [, platformLabel, value] = cellMatch;
      const key = PLATFORM_KEY[platformLabel.toLowerCase()];
      if (!key) continue; // unrecognized platform label — skip rather than guess
      adp[key] = value !== undefined ? parseFloat(value) : null;
    }

    players.push({
      id: slugify(name),
      name,
      team,
      position,
      consensus,
      adp,
    });
  }
  return players;
}

const api = { parseBeatAdpHtml, slugify, normalizeName };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else if (typeof self !== "undefined") self.parseBeatAdp = api;
