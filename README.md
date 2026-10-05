# FF ValueDiff

A fantasy football companion covering three tabs on one shared player pool:
**Weekly Scores** (real results by week, or a full-season grid),
**Waiver Wire Targets** (live Sleeper trending activity plus a hand-picked
pickup list), and **Injuries** (a live weekly injury report, plus who's out for the season or on IR/PUP,
and the earliest week each player can return).

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
Scores, the hand-picked Waiver Wire list, Injured Reserve) works fine from a
plain double-clicked file too.

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
18+, `--dry-run` to preview). As of 2026-10-05 it holds Weeks 1-4. Week 4 is
missing the Monday night NO@ATL game, which the live fetch picks up.

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

## The shared player pool

All three tabs read from one list, `samplePlayers` in `index.html`:
id/name/team/position for the top 200 overall players, plus 8 IR players
added on 2026-09-28 (Conner, Benson, Njoku, Stowers, Tonges, Kirk, Pearsall,
Kalinic) so every Injured Reserve entry also appears in Weekly Scores. To
change what's shown, edit that array directly rather than anything in the
browser (every table in the app is read-only).

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
