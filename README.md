# FF ValueDiff

Compares each player's **Average Draft Position (ADP)** across Yahoo, ESPN,
Sleeper, and FantasyPros' consensus, so you can catch cases where platforms
disagree on when a player actually gets drafted — a player Yahoo drafters
take in round 4 but ESPN drafters let fall to round 8, say.

## Running it

No build step, no install. Just open `index.html` in a browser (double-click it,
or drag it into a browser window). It loads React and Babel from a CDN and
transforms the JSX in-browser.

There's also a Chrome extension version in `extension/` — same tool, no
React/Babel/CDN (a separate vanilla-JS rewrite, since extension pages block
both), packaged so you can pin it in your toolbar instead of opening a file.
See `extension/README.md` to load it.

## How it works

Each player has an ADP value from up to four platforms. From those:

- **Consensus** — the mean of whatever platform values are available for
  that player. It's the leftmost data column and the table's default sort,
  since it's the single best read on where a player actually goes.
- Per-platform cells are colored relative to that player's Consensus, not
  just whichever platform happens to be the literal min/max: **blue** = that
  platform's ADP is *significantly higher* than consensus — you can get him
  later (cheaper) there than the market expects, i.e. the best value.
  **Red** = *significantly lower* than consensus (priciest). "Significant"
  scales with the pick — at least 3 spots, or 15% of the consensus ADP,
  whichever is larger, since top-of-draft picks sit within tenths of a spot
  of each other and a fixed threshold would flag noise. Platforms within
  that band of consensus are left uncolored.
- **FantasyPros' column (marked †) runs the opposite direction.** Yahoo,
  ESPN, and Sleeper are real drafting markets, so sitting well above
  consensus there means real drafters are letting a player slide — a buy
  signal. FantasyPros isn't a draft room, it's an aggregated expert-consensus
  ranking, so the same "above consensus" reading means the experts rate that
  player *worse* than the actual market does — the market's overpaying
  relative to expert opinion, which is a fade signal, not a buy signal. Same
  math (deviation from Consensus, same threshold), opposite color mapping.
- **Values past pick 250 are shown muted and excluded from the math.** A
  12-team, 20-round draft runs 240 picks — call it 250 to round up. Beyond
  that, a platform's number usually isn't a real read on when a player goes,
  it's that platform's filler/default value for someone who wouldn't
  realistically get drafted in a normal league (ESPN in particular falls
  back to values like 999+ for these). The raw number is still shown —
  nothing is hidden — but it's greyed out and left out of that player's
  Consensus average and deviation coloring, so one platform's filler number
  can't drag the whole row's math around.

**The chart** plots any two platforms against each other (pick both from the
"Compare ... vs." dropdowns, default Yahoo vs. ESPN) — each dot is a player,
x/y are that player's ADP on each platform. The diagonal line is "the two
platforms agree"; points off the line show which platform drafts that player
earlier. This generalizes the same blue/red logic to any pair you pick, since
four platforms can't all fit on one 2D scatter at once. When FantasyPros is
one of the two platforms picked, its color meaning flips the same way it
does in the table (a footnote appears under the chart to call it out):
FantasyPros earlier than the other platform is a buy signal (blue),
FantasyPros later is a fade signal (red) — regardless of which dropdown you
put it in.

Every cell in the table is **read-only** — it's a display of what was
actually looked up, not an editable spreadsheet. To change what's shown,
update the source data in `index.html` (the `samplePlayers` array) rather
than editing in the browser.

**Each player's position rank** (RB1, WR1, TE1, QB1, ...) is shown under
their name next to their team. It isn't scraped from anywhere — it's derived
from that player's own Consensus average, so it stays in sync automatically
whenever Consensus does, including after a refresh (see "Keeping data fresh"
below).

## Other pages

The app has three tabs, all sharing the same player pool: **ADP Comparison**
(above), **Waiver Wire Targets**, and **Trade Calculator**.

### Waiver Wire Targets

A weekly pickup list — pick a week (1-18) to see that week's hand-picked
targets, each tagged with a priority (Must Add / Speculative / Streamer /
Deep League) and a one-line reason.

Unlike ADP, there's **no live source** for this: ownership %, trending-add
rate, and snap-share data aren't things BeatADP (or any CORS-friendly source)
publishes, so nothing here is scraped. It's edited by hand, the same way
`samplePlayers` was before `refresh-adp.js` existed for it — update the
`WAIVER_TARGETS` object in `index.html` as real in-season news (injuries,
depth-chart moves, snap counts) comes in.

A week with no entry in `WAIVER_TARGETS` shows an explicit "nothing added
yet" state rather than a guess — only weeks that have actually been filled
in by hand show a list, so nothing on the page is presented as current when
it isn't. As of this writing, only Week 1 is seeded, with a small example
set of preseason committee/handcuff situations.

### Trade Calculator

Add players to "Side A" and "Side B" (search by name) and it totals a trade
value for each side and calls whether the trade is roughly even or lopsided.

Values aren't a separate chart — they're **derived from each player's own
Consensus ADP** (the same number shown in the ADP Comparison table), run
through an exponential decay curve (`tradeValue()` in `index.html`: early
picks are worth much more than late ones, tapering toward near-zero by the
back of a draft). That means trade values update automatically whenever
Consensus does, including after running `refresh-adp.js` — there's nothing
separate to keep in sync.

**Uneven player counts (2-for-1, 3-for-2, ...) get a roster-crunch
deduction.** Whichever side ends up with more players than it gave up has to
cut someone from its existing roster to make room, since roster spots are
fixed — raw value alone would overstate what a consolidation trade is worth,
since it ignores that cost. Each side pays a flat deduction per "extra"
player received, priced at a replacement-level ADP (`REPLACEMENT_LEVEL_ADP`,
currently 180 → `ROSTER_CRUNCH_COST` in `index.html`) rather than a made-up
constant, so it's a fringe/waiver-caliber player's worth, not zero and not a
real player's actual value (there's no way to know who specifically gets
cut). Each side's box shows both the adjusted total (what's compared in the
verdict) and, when a deduction applies, the raw total it was adjusted from.

This is **redraft-only**. It says nothing about age, contract/rookie-deal
situations, or future draft picks, which a real dynasty or keeper trade
chart would need to account for — those would require a different value
model entirely, not just a different curve on the same ADP input.

## Keeping data fresh

ADP drifts as more people draft, so the numbers above go stale. How each
version of this tool handles that differs, because of one hard constraint:
BeatADP (the data source) sends no CORS header, so a browser tab can't fetch
it directly — only a script running outside the browser, or a browser
extension's background worker with explicit host permission, can.

- **`index.html`** has no server and no build step, so it can't refresh
  itself. Run `node scripts/refresh-adp.js` whenever you want current
  numbers — it re-scrapes BeatADP and rewrites `samplePlayers` in place, then
  just reload the file. Node 18+ required (uses the built-in `fetch`). Pass
  `--dry-run` to preview the summary without writing.
- **The extension** refreshes itself: its background service worker
  (`extension/background.js`) re-fetches BeatADP every 6 hours automatically,
  plus once on install/browser startup, and the popup has a **Refresh now**
  button for on-demand pulls. This only works there because
  `extension/manifest.json` declares `host_permissions` for beatadp.com,
  which lets the background worker bypass the CORS wall that blocks
  `index.html`.

**Yahoo is the exception, on both versions:** BeatADP's own footnote on the
board reads *"Hidden as no longer maintained: Yahoo (last 2026-05-07)"* —
Yahoo cells are gone from BeatADP's HTML entirely, not just visually hidden,
so there's no live Yahoo number left to pull from this source. Yahoo is
carried forward at its last known value instead (frozen, not refreshed),
marked with a **⏸** in the table header and "(frozen)" in the platform
dropdowns. If Yahoo's ADP ever needs to come from somewhere else, that's a
separate data source to wire up — nothing here does it today.

Both the script and the extension parse BeatADP's page via
`scripts/lib/parse-beatadp.js` (the extension keeps its own copy at
`extension/lib/parse-beatadp.js`, since an unpacked extension can't reach
files outside its own folder — see `extension/README.md`). It matches on
each ADP cell's `title` attribute (e.g. `title="ESPN — ADP 1.0, ..."`) rather
than BeatADP's CSS class names, which include a build hash that changes on
every BeatADP deploy — so if BeatADP ever restructures the page enough to
break this, that's the file to fix.

## Data — what's real, and the limits of it

**All four platforms are real** for the top 200 overall players by consensus
ADP, pulled live on 2026-08-25 from BeatADP's platform-comparison board (see
**Data sources** below), which itself sources directly from each platform.

**Scoring format isn't uniform across all four columns**, and that's a
deliberate choice rather than an oversight: ESPN's ADP is shown in that
platform's native **full-PPR** format, while Yahoo, Sleeper, and FantasyPros
are each shown in their own native **half-PPR** format — because Yahoo and
Sleeper simply don't publish a full-PPR ADP line to pull from. Each column is
that platform's own default scoring, which is also what a real drafter on
that platform actually sees. It does mean a half-PPR-vs-full-PPR gap
contributes a little to the ESPN-vs-everyone-else difference on top of
genuine platform disagreement — pass-catching-heavy players in particular
will show more of a gap against ESPN than pure "platforms disagree" would
suggest.

**Coverage**: top 200 overall by consensus ADP — deep enough to cover a full
16-round, 12-team draft. Data quality thins out toward the back half: a
number of players past ~pick 150 (deep rookies, free agents like Stefon
Diggs and Deebo Samuel who hadn't signed at pull time, waiver-wire names) are
missing one or more platform values — ESPN in particular hadn't priced some
of them into its board yet. Those cells show as blank rather than a
fabricated value; one player (Ricky Pearsall) was dropped outright because
only one of the four platforms had a number for him at all.

## Data sources

Platform ADP was pulled live from BeatADP's side-by-side platform comparison
board on 2026-08-25:
- [BeatADP — Fantasy Football ADP Comparison](https://www.beatadp.com/platform-adp)

BeatADP aggregates ADP directly from each platform (Sleeper, ESPN, Yahoo,
FantasyPros, and others); ESPN's numbers came from the board's PPR-scoring
view, Yahoo/Sleeper/FantasyPros from its half-PPR-scoring view — see "Data —
what's real" above for why those don't match on scoring format. Real ADP
moves throughout the offseason as more drafts happen, so treat every number
as dated the moment it was pulled, not live.
