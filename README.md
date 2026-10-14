# Fantasy Front Office

*Run your fantasy team like a GM.* (Formerly FF ValueDiff. The repo
folder, the `ff-valuediff:` browser-storage keys and the dormant
`extension/` still use the old name, so saved settings carry over.)

A fantasy football companion. Three tabs cover this season, on one shared player pool:
**Weekly Scores** (real results by week, or a full-season grid),
**Waiver Wire Targets** (live Sleeper trending activity plus a hand-picked
pickup list), and **Injuries** (a live weekly injury report, plus who's out for the season or on IR/PUP,
and the earliest week each player can return). Three more cover dynasty
leagues: **Dynasty Values** (live trade values for every player and rookie
pick), a **Trade Calculator** (plus every team in a Sleeper league ranked by
value), and a **2027 Class** preview of next year's rookies.

There's also a **basketball** side for season-long (redraft) points
leagues, with five rooms: Scoreboard, Waiver Desk, Training Room, Big Board
and Trade Desk. See "Basketball" below. A Football | Basketball switch in
the header moves between the two sports.

## Running it

No build step, no install. Just open `index.html` in a browser (double-click it,
or drag it into a browser window). It loads React and Babel from a CDN and
transforms the JSX in-browser.

The whole basketball side, and the live parts of Waiver Wire Targets (the "Trending on Sleeper" panel), need
the page served over http(s) with network access — they won't work from a
plain double-clicked file, since `fetch` calls from a `file://` page hit
browser restrictions that a real server doesn't. Any static file server
works, e.g. `python -m http.server` from this directory, then open
`http://localhost:8000/index.html`. Everything else in the app (Weekly
Scores, the hand-picked Waiver Wire list, Injured Reserve) works fine from a
plain double-clicked file too.

There's also a Chrome extension version in `extension/` — same idea, no
React/Babel/CDN (a separate vanilla-JS rewrite, since extension pages block
both), packaged so you can pin it in your toolbar instead of opening a file.
See `extension/README.md` to load it. (Note: the extension was built around
this app's original ADP-comparison tool, since removed from `index.html` —
see "History" below.)

## Site layout

The page is laid out like a website, themed as an **executive front office**
(the site shell section at the bottom of `index.html`, styles in `<head>`):

- **Look:** navy and brass. There's a navy header with a brass trim line and
  a brass nameplate logo ("FFO"). Light mode uses warm paper tones and dark
  mode a night-office navy. Page and section titles are set in the Fraunces
  serif, body text in Inter (both from Google Fonts).
- **Every tool is a room in the office** (the `short` name in `PAGES`):
  | Room | Tool |
  |---|---|
  | Scoreboard | Weekly Scores |
  | Waiver Desk | Waiver Wire Targets |
  | Training Room | Injuries |
  | Value Board | Dynasty Values |
  | Trade Desk | Trade Calculator |
  | Scouting Dept. | 2027 Rookie Class |

  The nav, home folder tabs, page labels and browser tab titles use the room
  name. The page heading still says what the tool is.
- **Home page** (the Lobby, `#/`): a "Run your fantasy team like a GM"
  intro and buttons into the Trade Desk and Scoreboard. Each tool is a
  **manila folder** card with its room on the tab. Below them are the
  biggest 30-day risers in dynasty value.
- **Sport switch:** a Football | Basketball control next to the logo
  (`SportSwitch`). Switching keeps you in the same room when the other sport
  has one (Scoreboard → Scoreboard), otherwise it opens that sport's first
  room. On the home page it just changes which sport the nav shows
  (remembered in `ff-valuediff:sport`).
- **Sticky top navigation** with two dropdowns per sport: *Game week* and
  *Dynasty* for football, *Game week* and *Front office* for basketball
  (`NavDropdown`). Each lists its rooms with an icon and a one-line
  description. They open on hover or click and close on outside click,
  Escape or picking a room. A brass **Trade Desk** button sits on the right.
  Below 768px wide it all becomes a hamburger menu. A sun/moon
  button switches light and dark. It follows the OS until used, then
  remembers the choice (`ff-valuediff:theme`). The choice is applied in
  `<head>` before render, so there's no flash.
- **Every page has its own URL**: `#/scores`, `#/waivers`, `#/injuries`,
  `#/values`, `#/trade`, `#/2027`, and for basketball `#/nba/scores`,
  `#/nba/waivers`, `#/nba/injuries`, `#/nba/rankings`, `#/nba/trade`. So the
  back button, bookmarks and reloads all work. A trade link (`#trade=…`, or
  `#nbatrade=…` for basketball) opens that Trade Desk with the trade, and
  leaving and coming back keeps it.
- A **footer** with links to every room and the data sources (Sleeper,
  FantasyCalc, DraftSharks, Yahoo Sports).
- **Color:** each tool keeps its own color and icon (`PAGE_STYLE`), used on
  its folder, its nav underline and the label above its title.
  - Position filters and the `PosBadge` chips in tables use position colors
    (QB blue, RB orange, WR green, TE gold, picks pink, `POS_PILL_COLOR`).
  - League settings are violet. Trade sides are blue (A) and orange (B).
  - Value trends are green up and red down.
- **Favicon:** `favicon.svg`, a navy plaque with a brass "F" monogram.
- **Segmented controls:** each group of filter or setting options (format,
  QB, teams, scoring, TE premium, positions, weeks, views, adds/drops) is one
  rounded track. The highlight slides to the selected option (`PillGroup`,
  `.segmented` / `.seg`). Position options use position colors.
- **Less boxy pages:** the longer "where this data comes from" notes under
  each page title sit behind an **About this data** toggle (`AboutData`).
  The Sleeper league instructions stay visible. Panels have rounder corners,
  lighter edges and a soft shadow, and table headers have a tinted band.
- **Buttons:** standalone toggles (Raw values, Clear trade, +A / +B) use one shared `.pill` style. It
  tints on hover, presses down on click, and when selected fills with its
  color (set through `--pill-accent`) and a soft glow. Main actions are
  polished brass buttons that lift on hover, and table and team rows
  highlight on hover.

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
numbers**, from Sleeper's stats API (`https://api.sleeper.com/stats/nfl/2026/<week>`,
the `pts_ppr` field). They **update automatically**: on every page load the
app asks Sleeper for the current week (`/v1/state/nfl`) and pulls every
week played so far, so new weeks, in-progress games and stat corrections
show up without editing anything. Each week's trimmed result is cached in
`localStorage` (finished weeks for 6 hours, the current week for 5 minutes).
While a week is in progress, the by-week view lists the teams **still to
play**; their players stay blank until their game is in. The by-week
selector only offers weeks with real scores and opens on the latest one. The
season grid still shows all 18 week columns, blank until played.

The fetch-and-match logic lives in `scripts/lib/sleeper-scores.js`, which
the page loads with a plain `<script>` tag. Players are matched to Sleeper by
name and position, plus a short `SLEEPER_ID_OVERRIDES` list for names that
differ (e.g. "Kenny" Gainwell, "Cam" Ward). Sleeper's `WAS` is mapped to this
app's `WSH`. If you add a player whose Sleeper name differs, add them there.

`WEEKLY_SCORES` and `DID_NOT_PLAY` in `index.html` are a **baked-in
snapshot**, shown until live data arrives and used if Sleeper can't be
reached. To refresh the snapshot, run `node scripts/refresh-scores.js` (Node
18+, `--dry-run` to preview). A GitHub Action
(`.github/workflows/refresh-scores.yml`) also runs it daily at 10:00 UTC
and commits `index.html` when scores change; it can be run by hand from
the repo's Actions tab too. As of 2026-10-06 it holds all of Weeks 1-4,
including the Monday night NO@ATL game.

**OUT and IR instead of 0.** `WEEKLY_SCORES` only lists players who
actually played. Players whose team played but who didn't are listed in
`DID_NOT_PLAY` and show **OUT**, both in the grid and at the bottom of the
by-week table. Weeks inside an Injured Reserve stint show **IR** instead,
including future weeks up to the player's earliest possible return (or the
rest of the season for season-ending injuries). OUT and IR weeks don't
count toward GP or AVG.

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
"nothing added yet" state rather than a guess. As of this writing (2026-10-05) it holds
20 Week 5 targets, based on Week 1-4 usage, Sleeper's injury designations
and its most-added list rather than preseason guesses: injury vacancies
(Jadarian Price and A.J. Brown to IR; Chase, Barkley, Bigsby, DeVonta Smith, Goedert
and Breece Hall out), target/snap share winners, and streamers. CAR and KC
are on bye in Week 5, so none of their players are listed.

## Injuries

**This Week's Injury Report** (top of the tab) is **live**: every player in
the pool, plus the waiver targets, whose current Sleeper designation is
Questionable, Doubtful, Out or not active (e.g. Lamar Jackson, questionable
with an ankle injury). Each row shows the injury and how the player's most
recent game went. It comes from the same `/players/nfl` payload as the
trending panel, now cached for 6 hours instead of 24 because designations
change daily. Official injury reports come out Wednesday through Friday, so
early in the week a designation may be carried over from the last game.

Below that, the hand-kept IR lists: every fantasy-relevant player who's out for the season or on injured
reserve or reserve/PUP (`INJURED_RESERVE` in `index.html`). Both lists mean
at least four games out. Each entry has the injury, the week the current
absence started (`sinceWeek`, 1 for players who started the season there)
and, unless it's season-ending, the **earliest return** week: four team
games after `sinceWeek`, skipping the team's bye (`irReturnWeek`). That
date is a minimum, and many players take longer.

As of 2026-09-28 it holds 24 players, from Sleeper's injury designations
(IR/PUP) plus team news. Three are season-ending: Achane (torn ACL), Dart
(knee surgery) and Jayden Higgins (torn ACL). Edit the list by hand as
players are placed on or activated from IR. The same list drives the IR
cells in Weekly Scores.

## Dynasty tabs

All three read the same values: **FantasyCalc's** trade values
(`https://api.fantasycalc.com/values/current?isDynasty=<true|false>&numQbs=<1|2>&numTeams=<8-14>&ppr=<0|0.5|1>`),
built from real trades on fantasy platforms. FantasyCalc sends an open CORS
header, so the page fetches them directly on load, the same way it fetches
Sleeper. Each settings combination's trimmed list (dynasty: about 400
players plus 24 generic rookie picks like "2027 1st (Early)"; redraft: about
200 players, no picks) is cached in `localStorage` for 2 hours, and an open page re-checks
when you return to the tab and every 30 minutes. Players are
keyed by their **Sleeper player_id**, which FantasyCalc includes, so nothing
is matched by name.

**League settings** sit at the top of Dynasty Values and the Trade
Calculator. They're shared between the tabs and remembered in the browser
(`DYNASTY_SETTINGS_KEY`):

| Setting | Options | How it's applied |
|---|---|---|
| Format | Dynasty · Redraft | FantasyCalc's `isDynasty`. Redraft has no picks |
| QB | 1QB · Superflex | `numQbs` |
| Teams | 8 · 10 · 12 · 14 · 16+ | `numTeams` (FantasyCalc stops at 14, so 16+ uses its 14-team values) and the trade calculator's roster-spot credit |
| Scoring | PPR · Half · Std | `ppr` |
| TE premium | None · +0.5 · +1.0 · +1.5 per catch | **An estimate**: FantasyCalc has no TE-premium values, so TE values are boosted by 10% / 20% / 30% for the top TE, scaling down to half that for fringe TEs (`TEP_BOOST`, `applyTePremium`) |

Loading a Sleeper league on the Trade Calculator sets all five from the
league (`settingsFromLeague`). Keeper leagues count as dynasty. The 2027 Class
tab only uses the QB setting and always uses dynasty values.

The fetch-and-trim logic lives in `scripts/lib/fantasycalc.js`, loaded with
a plain `<script>` tag like `sleeper-scores.js`. `DYNASTY_VALUES` in
`index.html` is a **baked-in snapshot** of the 12-team PPR dynasty values in
both QB formats, shown until live data arrives and used if FantasyCalc can't
be reached (for other settings the page says the snapshot is only an
approximation). Each row is stored as
a compact array in `DYNASTY_FIELDS` order to keep the file small. To
refresh it, run `node scripts/refresh-dynasty.js` (`--dry-run` to
preview). A GitHub Action (`.github/workflows/refresh-dynasty.yml`) runs
it every Tuesday at 11:00 UTC and commits on change. It shares a
concurrency group with the scores Action so the two never push over each
other. Both scripts use `scripts/lib/bake.js` to rewrite their block of
`index.html`.

### Dynasty Values

Every player and pick, ranked by value for the selected league settings,
filterable by position (or Picks, in dynasty) and searchable by name or team. Each row shows position rank, age, value (with a
bar relative to #1) and the 30-day trend. It also shows the player's live Sleeper
injury designation, from the same cached `/players/nfl` map as the
Injuries tab. Two tags compare FantasyCalc's redraft value (this season
only) with dynasty value, for players worth at least 1,500:
**Win-now** when redraft value is 15%+ higher (older producers a contender
should buy), **Future** when it's under half and the player is 25 or younger
(young stashes, and anyone out for the season).

### Trade Calculator

Add players or picks to what each team gets. Each side shows its plain value,
any adjustments, and an adjusted total. Trades that aren't one-for-one are
adjusted the way the big calculators do it (`evaluateTrade`, constants in
`TRADE_FORMULA`):

- **Stud adjustment** (like KeepTradeCut and DynastyDaddy): each asset
  counts toward a "trade score" at 20% (filler) to 40% (the best player in
  the league) of its value. The share is higher the closer the asset is to
  the best asset in the trade and in the league. The side with the lower
  score is behind by the value of the one extra player it would need to catch
  up, found by bisection as KTC does.
- **Roster spot credit** (like FantasyCalc): the side getting fewer players
  can fill each open spot from waivers. So it's credited with the value of
  about the (teams × 25)th-best player, a slightly better one for each extra
  spot. That's where **league size** matters: in 8 teams the free agent is
  worth about 900, in 14 teams under 100. Bigger leagues credit less, so
  depth matters more.

The constants were tuned against reference trades. A 2-for-1 of equal value
favors the 1 side by about 15-20% in 12 teams, and four mid players don't
beat a star on volume. That lands between FantasyCalc (credit only) and KTC
(a much steeper stud premium). It's this app's own blend, not any one site's
exact formula. Within 5% (or 250) is "fair", and up to 15% "slightly
favors". **Raw values** turns both adjustments off. A collapsible "How this
is calculated" note on the page shows the current waiver-level player and
value. "To even it out" re-runs the whole formula for every candidate to find
the three closest.

The trade is stored in the URL hash (`#trade=<ids>|<ids>`), so a reload
keeps it and the link can be shared. A link with a trade in it opens
straight on this tab.

**League team values** (below the calculator): enter a Sleeper username
(then pick a league) or a league ID. Every team is ranked by the value of its
roster plus the rookie picks it owns, with a bar split by position, and
"starters": the best lineup it can field for the league's roster slots.
Sleeper only lists picks that have changed hands (`/traded_picks`), so each
team starts with its own picks for the next three drafts (rounds 1-4) and
trades are applied on top. Picks are valued as FantasyCalc's generic
mid-round pick for that year. Loading a league syncs the settings above to
it. Expand a team and use **+A / +B** to drop any player or pick into the
trade.

### 2027 Class

A hand-curated list (`CLASS_2027` in `index.html`, like
`WAIVER_TARGETS`) of the top 2027 rookie prospects, with their 1QB and
Superflex rookie-draft ranks, school, size and a short note. It's sorted by
whichever format is selected. There's no live source for college
prospects, so ranks and notes are copied from published rankings, listed in
`CLASS_2027_SOURCES` and linked at the bottom of the tab. As of 2026-10-07
it holds 31 prospects from DraftSharks' Oct 1, 2026 1QB and Superflex
rankings and Yahoo's Sep 3, 2026 big board. Replace it wholesale as new
rankings come out.

The top of the tab is live: what each 2027 1st and 2nd (early/mid/late) is
worth right now, and the player with the closest value. Each prospect also
shows the pick his rank lines up with in a 12-team league (ranks 1-4 early
1st, 5-8 mid, 9-12 late, and so on) at its current value.

### What other calculators say

Under the trade verdict, the Trade Calculator re-runs the same trade with
KeepTradeCut, DynastyProcess and Dynasty Superflex values (KeepTradeCut's
redraft values in redraft mode), through this app's own formula, so you can
see whether the other markets agree. None of these sites let a web page fetch
their values, so they come from
[Dynasty Daddy](https://dynasty-daddy.com), which collects them:
`dynasty-daddy.com/api/v1/player/all/today?market=<n>` (0 KeepTradeCut, 2
DynastyProcess, 3 Dynasty Superflex, 4 KeepTradeCut redraft), keyed by
Sleeper player_id. `scripts/refresh-market-values.js` writes them to
`data/market-values.js`, and the **Refresh market values** Action runs it
daily at 10:30 UTC. These are 12-team PPR values in 1QB and Superflex only,
with no league size, scoring or TE-premium options; FantasyCalc's generic
"2027 1st" picks use the mid pick.

## Basketball

Season-long (redraft) **points leagues** only. No dynasty, no category
leagues. Everything is live from Sleeper's public NBA API
(`scripts/lib/sleeper-nba.js`, loaded with a plain `<script>` tag as
`window.SleeperNBA`). There's no baked snapshot, so these pages need the
site served over http(s). The data loads the first time a basketball page
opens and is cached in `localStorage` (`ff-valuediff:nba-v1:*`):
- the NBA state (10 minutes)
- this season's totals (1 hour) and last season's (1 day)
- the trimmed player list with injuries (6 hours)
- each fantasy week (1 day, or 10 minutes for the current week)

**Seasons.** Sleeper names a season by the year it starts ("2025" is
2025-26). Until the current season has games (2026-27 tips off Oct 20,
2026), every page shows last season and says so. It switches over on its
own once games are played.

**Scoring** (a setting on each page, remembered in
`ff-valuediff:nba-settings-v1`). Fantasy points are computed from the box
score, not taken from Sleeper's own number:

| Preset | Points |
|---|---|
| Standard (the NBA's official fantasy scoring, Yahoo's default) | PTS 1, REB 1.2, AST 1.5, STL 3, BLK 3, TO −1 |
| ESPN (ESPN's default points league) | PTS 1, 3PM 1, FGM 2, FGA −1, FTM 1, FTA −1, REB 1, AST 2, STL 4, BLK 4, TO −2 |

Presets live in `SCORING` in `sleeper-nba.js`. Sleeper's own NBA default
isn't documented anywhere I could find, so there's no Sleeper preset.

**Rooms:**
- **Scoreboard** (`NbaScoreboard`): one fantasy week (Monday to Sunday), with
  every player's points for each game, games played, points per game and
  the week total. The data comes from Sleeper's per-game feed
  (`/stats/nba/<season>/<week>`). A game counts only if the player logged
  minutes, because sat-out games come through with empty stats. The older
  `/v1/stats/nba/regular/<season>/<week>` feed only returns each player's
  last game of the week, so it isn't used. A finished season has 25 weeks.
- **Waiver Desk** (`NbaWaivers`): Sleeper's live trending adds and drops,
  with each player's points per game. Once the current season has two
  weeks, a **Heating up** list appears. It shows players whose last two
  weeks (2+ games, 20+ points per game) beat their season average by the
  most.
- **Training Room** (`NbaInjuries`): everyone with a current Sleeper
  designation. The order is Out and IR, then suspended, doubtful,
  questionable, game-time decision (GTD) and day-to-day (DTD). You can
  filter to fantasy-relevant players (15+ points per game) or everyone.
- **Big Board** (`NbaRankings`): every player ranked by fantasy points per
  game, with games played, total and per-game PTS / REB / AST / STL / BLK /
  3PM / TO. A player needs 20 games for a finished season, or a third of the
  games played so far mid-season.
- **Trade Desk** (`NbaTrade`): the football Trade Desk's formula
  (`evaluateTrade`, same stud adjustment and roster spot credit) with
  13-man rosters. Values are **projected rest-of-season fantasy points**
  (`nbaTradeRows`):
  - points per game × team games left × availability
  - points per game blends this season with last season's average, which
    counts as (15 − games played) games and fades out after 15 games
  - availability is games played ÷ team games, kept between 50% and 100%
  - rookies have no value until they've played

## Player profiles

Every player has a profile page, football at `#/player/<Sleeper id>` and
basketball at `#/nba/player/<Sleeper id>`. Nothing is written per player: the
page pulls that player's own feeds from Sleeper when it opens (CORS-open, kept
in memory for 10 minutes):

- `api.sleeper.com/stats/nfl/player/<id>?season=<year>&grouping=week` (and
  `grouping=season`, for this season's and last season's totals and position
  ranks), plus `api.sleeper.com/projections/nfl/player/<id>?...&grouping=week`
  for weekly projections.
- `api.sleeper.com/stats/nba/player/<id>?season=<year>&grouping=week`, every
  game of the season.

Football profiles show bio and injury status, dynasty (or redraft) value,
rank, 30-day trend and Draft Board slot in your league settings, fantasy
points by week against Sleeper's projection in your scoring, a game log, the
next three games, last season and players of similar value. Basketball
profiles show trade value, FPG, availability, the last 20 games, the full game
log, season averages and similar players. Headshots come from
`sleepercdn.com`. There's no separate profiles tab: player names in every
tab link to their profile, and the profile's back link returns to the tab you
came from. Football tabs that use this app's short ids (Weekly Scores, Waiver
Wire, Injuries) are matched to Sleeper ids by name and position, the same way
the live scores are. Rookie picks and 2027 prospects have no profile.

## The shared player pool

The three season tabs read from one list, `samplePlayers` in `index.html` (the dynasty tabs use FantasyCalc's own player list instead):
id/name/team/position for the top 200 overall players, plus 8 IR players
added on 2026-09-28 (Conner, Benson, Njoku, Stowers, Tonges, Kirk, Pearsall,
Kalinic) so every Injured Reserve entry also appears in Weekly Scores. To
change what's shown, edit that array directly rather than anything in the
browser (every table in the app is read-only).

**Weekly Scores ranks everyone, not just that list.** Any QB/RB/WR/TE who
has scored fantasy points this season but isn't in `samplePlayers`
(waiver-wire breakouts, backup QBs who started, etc.) is added
automatically from Sleeper's stats, as `sl-<Sleeper id>` (`mergeExtras` in
`scripts/lib/sleeper-scores.js`; baked copy in `EXTRA_PLAYERS`). Players
who've only ever logged zeros (blockers, kneel-down QBs) are left out. These
added players never show OUT: they're blank in weeks they didn't play. As of
2026-10-05 that's 218 extra players. Each week's top 24 QBs/TEs and top 50
RBs/WRs match Sleeper's own numbers exactly.

Each entry also still carries an `adp` field left over from this app's
original ADP-comparison tool (see "History" below); nothing reads it
anymore; it's simply unused.

## History

The app also had a **Props** tab (sportsbook lines turned into implied
fantasy points, compared with Sleeper and ESPN projections, fed by
`scripts/refresh-props.js`). It was removed on 2026-09-28 along with its
script; both are in git history if it's ever wanted back.

### The original ADP Comparison tool

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
