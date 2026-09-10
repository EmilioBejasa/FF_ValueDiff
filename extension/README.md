# FF ValueDiff (Chrome extension)

The same tool as `../index.html`, packaged as an unpacked Chrome extension —
click the toolbar icon to open it in a popup instead of opening a file.

This is a from-scratch vanilla-JS rewrite of the web app, not the same file
copied over: Manifest V3 extension pages block remote scripts and `eval`
(both `script-src 'self'` only, no `'unsafe-eval'`), and the web app loads
React, ReactDOM, and Babel Standalone from a CDN and transpiles its JSX live
in the browser — none of which is allowed here. `popup.html` reimplements
the exact same data, math, and rendering (table, sortable columns, the SVG
scatter chart, the deviation-based coloring, the FantasyPros color inversion
and its two footnotes, the 250-pick draft-pool cutoff, position ranks) using
plain DOM APIs and template strings, with a small hand-rolled CSS layer
standing in for the handful of Tailwind utility classes the web app uses. No
React, no Babel, no CDN, no build step.

## Live refresh

Unlike `index.html` (a static file with no server, blocked by BeatADP's lack
of CORS headers — see the main README's "Keeping data fresh"), this
extension refreshes Sleeper/ESPN/FantasyPros ADP itself: `background.js` is
a Manifest V3 background service worker that re-fetches BeatADP every 6
hours (plus once on install/browser startup), using the `host_permissions`
grant in `manifest.json` for beatadp.com to fetch cross-origin without
hitting the CORS wall a normal page would. The popup also has a **Refresh
now** button for on-demand pulls. This is why the extension now declares
`storage` and `alarms` permissions plus that host permission — none of which
it needed before.

Yahoo is the one platform that doesn't refresh: BeatADP stopped maintaining
it on 2026-05-07 and no longer includes it in the page at all, so it's
carried forward frozen at its last known value (`extension/lib/yahoo-seed.js`
is the fallback used only before the first live refresh has ever completed;
after that, storage's own last-known value is what's carried forward).

## Loading it

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click the puzzle-piece icon in Chrome's toolbar and pin **FF ValueDiff**
   so its icon stays visible, then click it to open the popup.

## Keeping it in sync with the web app

There are now two independent copies of this app — `../index.html` (React)
and `popup.html` (vanilla JS) — because of the CSP/eval restriction above.
If you update the scoring/coloring logic in one, apply the same change to
the other; nothing here regenerates automatically from the web app. Player
*data* doesn't need manual syncing the same way — each side refreshes its
own copy live (see "Live refresh" above and the main README).

`extension/lib/parse-beatadp.js` is also a copy, of `scripts/lib/parse-beatadp.js`
— an unpacked extension can only load files inside its own folder, so it
can't reference the shared copy directly. If BeatADP changes its page
structure and that parser needs fixing, fix both copies.
