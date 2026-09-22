# FF ValueDiff

A fantasy football companion covering three tabs on one shared 200-player
pool: **Weekly Scores** (real results by week, or a full-season grid),
**Waiver Wire Targets** (live Sleeper trending activity plus a hand-picked
pickup list), and **Props** (sportsbook yardage/touchdown lines next to each
player's recent scoring rank).

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
"nothing added yet" state rather than a guess. As of this writing it holds
12 targets, driven by actual results rather than preseason guesses — the
real Week 3 pickups that Week 1-2's results actually point to (injury
vacancies, snap-share winners).

## Props

Sportsbook yardage and anytime-touchdown prop lines for the next unplayed
week (`WEEK_PROPS` in `index.html`, currently Week 3), next to each player's
own recent scoring rank and points-per-game — computed live from the real
results already in `WEEKLY_SCORES`, the same math as Weekly Scores' Season
Grid AVG column, so it stays in sync automatically as more weeks get added.
The idea is a quick read on whether the market's expectation for a player
this week (a short anytime-TD price, a big yardage number) lines up with how
they've actually been producing, or is out ahead of / behind what the box
scores say.

Player-prop odds are commercial sportsbook data gated behind paid odds
providers — there's no free, CORS-friendly live endpoint for it the way
Sleeper's trending-add data is — so, same pattern as Waiver Wire Targets'
hand-picked list, this is a hand-curated snapshot pulled from public
sportsbook/prop-analysis write-ups (BettorsInsider, Mile High Sports,
BetMGM's blog, Sharp Football Analysis), not a live feed. Replace
`WEEK_PROPS` wholesale once the season moves past the week it currently
covers. Every entry uses a player ID that already exists in `samplePlayers`,
so no separate ID-mapping layer is needed the way Sleeper's numeric IDs
required.

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
