# FF ValueDiff

A fantasy football companion covering three tabs on one shared 200-player
pool: **Weekly Scores** (real results by week, or a full-season grid),
**Waiver Wire Targets** (live Sleeper trending activity plus a hand-picked
pickup list), and **Props** (fantasy points implied by sportsbook lines,
compared against fantasy sites' projections).

## Running it

No build step, no install. Just open `index.html` in a browser (double-click it,
or drag it into a browser window). It loads React and Babel from a CDN and
transforms the JSX in-browser.

The live parts of Waiver Wire Targets (the "Trending on Sleeper" panel) need
the page served over http(s) with network access — they won't work from a
plain double-clicked file, since `fetch` calls from a `file://` page hit
browser restrictions that a real server doesn't. Any static file server
works, e.g. `python -m http.server` from this directory, then open
`http://localhost:8000/index.html`. Everything else in the app (Weekly
Scores, the hand-picked Waiver Wire list, Props) works fine from a plain
double-clicked file too.

There's also a Chrome extension version in `extension/` — same idea, no
React/Babel/CDN (a separate vanilla-JS rewrite, since extension pages block
both), packaged so you can pin it in your toolbar instead of opening a file.
See `extension/README.md` to load it. (Note: the extension was built around
this app's original ADP-comparison tool, since removed from `index.html` —
see "History" below.)

## Weekly Scores

Every player in the database for a given week, ranked highest to lowest by
that week's actual PPR fantasy points, or as a full Week 1-18 season grid
with a running total/average. The position filter defaults to **RB**, and
its buttons are ordered RB, WR, QB, TE, ALL — skill positions people are
actually checking waivers/streamers for first, the unfiltered view last.
Each week's by-week view also shows that week's real bye teams (the full
2026 schedule, Weeks 5-14, hard-coded in `BYE_WEEKS` in `index.html`) —
that part is known for the whole season in advance, so it's shown
regardless of whether the week's games have happened.

Scores themselves are **real results, not projections or fabricated
numbers** — pulled from FantasyPros' Week 1/2 2026 stats tables and stored in
`WEEKLY_SCORES` in `index.html`. Only weeks that have actually been played
get an entry there; the by-week selector only offers a tab for weeks that
actually have an entry (`PLAYED_WEEKS` in `index.html`, derived from
`WEEKLY_SCORES`'s own keys), same pattern as Waiver Wire Targets below — so
there's nothing to click into that would just show an empty state. The
season grid still shows all 18 week columns regardless, blank until played,
since that view is meant to show the whole season's shape at a glance. As of
this writing, Weeks 1-2 are filled in — add each following week's key to
`WEEKLY_SCORES` once it's actually been played, and its tab appears
automatically.

## Waiver Wire Targets

Two parts, one live and one hand-curated:

**Trending on Sleeper** (top of the page) is a **live** panel — Sleeper's
API sends an open CORS header, so a browser tab can call it directly with no
refresh script or extension needed. It shows the top players being added
(or, via the toggle, dropped) across real Sleeper leagues in the last 24
hours, straight from Sleeper's own trending-add/drop endpoint, refetched on
every page load. This is raw community activity — add/drop counts only, no
reasoning — which is what distinguishes it from the curated list below.

Turning player IDs into names requires Sleeper's `/players/nfl` endpoint,
which its own docs describe as a large (~5MB+) payload meant to be fetched
at most once a day, not per-request — so the app trims that response down to
skill positions (QB/RB/WR/TE) before caching it in `localStorage` for 24
hours (`SLEEPER_PLAYERS_CACHE_KEY` in `index.html`), and only the small
trending-list request re-fires when you toggle Adds/Drops.

Below that is the **hand-picked** list, each entry tagged with a priority
(Must Add / Speculative / Streamer / Deep League) and a one-line reason.
It's a single **always-current** list (`WAIVER_TARGETS` in `index.html`, a
flat array) meant to reflect this week's best targets, replaced wholesale as
the season moves on rather than accumulating a new dated list every week —
sorted by priority (Must Add first, Deep League last) regardless of the
order entries were added in. There's no live ownership/snap-share source to
pull this part from (that's what the Sleeper panel above is for), so it's
edited by hand — update `WAIVER_TARGETS` as real in-season news (injuries,
depth-chart moves, snap counts) comes in.

If `WAIVER_TARGETS` is ever emptied out, the page shows an explicit
"nothing added yet" state rather than a guess. As of this writing (2026-09-23) it holds
18 targets, based on actual results and the Week 3 injury report rather
than preseason guesses: injury vacancies (Collins, Moore, Barkley, Goedert),
QB changes (Daniels, Dart) and snap-share winners.

## Props

Sportsbook player-prop lines for the current week (`WEEK_PROPS` in
`index.html`) converted into the PPR fantasy points they imply, next to
what **Sleeper** and **ESPN** project for the same player. **Diff** is
props-implied minus the average of the two sites, so a positive number means
the betting market expects more than the fantasy sites do. There's a position
filter, and each player's recent points per game (computed live from
`WEEKLY_SCORES`) sits alongside.

**Where the numbers come from**

- **Lines:** `node scripts/refresh-props.js` pulls every posted line from
  [RotoWire's props board](https://www.rotowire.com/betting/nfl/player-props.php),
  which aggregates BetMGM, DraftKings, FanDuel, Caesars and others. RotoWire
  embeds the whole board as JSON in its page but sends no CORS header, so the
  browser can't fetch it; the script matches players to `samplePlayers` by
  name and rewrites `WEEK_PROPS`, `PROPS_WEEK` and `PROPS_UPDATED_ON` in
  place. For each market it takes the median line across books, priced at
  BetMGM, DraftKings or FanDuel where available, and the median anytime-TD
  price. Books post lines game by game from Tuesday to Saturday, so rerun the
  script closer to kickoff to fill in the games that weren't up yet. Players
  who only have an anytime-TD price so far are left out of the table, and
  the page says how many.
- **Projections:** fetched live on page load from Sleeper's projections API
  and ESPN's default PPR league endpoint. Both allow cross-origin requests,
  so no script is needed. They need the page served over http(s) like the
  Sleeper trending panel; if either fails, the page says so and averages
  whichever one loaded.

**How the implied points are built** (`propsImpliedPoints` in `index.html`)

- Scoring: 1 per catch, 0.1 per rushing/receiving yard, 0.04 per passing
  yard, 4 per passing TD, -2 per INT, 6 per other TD. Fumbles have no line.
- Each yardage/receptions over/under is de-vigged, then shifted off its line
  by how far the over's no-vig probability sits from 50/50 (normal
  approximation, rough per-stat standard deviation). A 6.5-catch line priced
  -154/+116 comes out near 7 expected catches.
- Passing-TD and INT lines become the Poisson mean that matches the over's
  price.
- Anytime-TD odds are one-sided, so they're scaled down by a flat hold
  estimate (`ATTD_HOLD`) and turned into expected TDs. For QBs that stands
  in for rushing TDs.
- RB receiving yards come from the rush+rec yards combo minus the rushing
  line when there's no separate receiving line.

Rows missing a line their position needs (`PROP_NEEDS`: for example a QB
with no rushing-yards line, or an RB with no receptions line) list what's
missing, get an asterisk, and have their Diff greyed out and sorted after the
complete rows, because the missing stat pushes the implied total low.

## The shared player pool

All three tabs read from one 200-player list, `samplePlayers` in
`index.html` — id/name/team/position for the top 200 overall players. To
change what's shown, edit that array directly rather than anything in the
browser (every table in the app is read-only).

Each entry also still carries an `adp` field left over from this app's
original ADP-comparison tool (see "History" below); nothing reads it
anymore; it's simply unused.

## History: the original ADP Comparison tool

This app started as a pure ADP-comparison tool — a table and scatter chart
comparing each player's Average Draft Position across Yahoo, ESPN, Sleeper,
and FantasyPros' consensus, refreshed live from BeatADP via
`scripts/refresh-adp.js` (or the extension's background worker). That tool
has since been **removed** from `index.html` in favor of the three
results/target-driven tabs described above.

`scripts/refresh-adp.js`, `scripts/lib/parse-beatadp.js`, and the `extension/`
folder still exist and still work exactly as before (see their own inline
docs/`extension/README.md`) — they just no longer have anything reading
their output inside `index.html`, since the tab that displayed platform ADP
is gone. They're left in place rather than deleted, in case ADP comparison
is ever brought back or reused elsewhere; treat them as available-but-dormant
tooling, not part of the active app.
