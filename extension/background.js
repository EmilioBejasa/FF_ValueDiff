// Keeps Sleeper/ESPN/FantasyPros ADP current by re-fetching BeatADP's
// platform-comparison board on a timer. Runs here (not in popup.html)
// because a MV3 background service worker can fetch cross-origin without
// hitting the page-level CORS wall that blocks index.html (see README
// "Keeping data fresh") — this only works because manifest.json declares
// host_permissions for beatadp.com.
//
// Yahoo can't be refreshed this way: BeatADP's own footnote says it stopped
// maintaining Yahoo ADP on 2026-05-07, and Yahoo cells are simply absent
// from the HTML now. So Yahoo is carried forward from whatever's already in
// storage (or the bundled sample data on first run) rather than refreshed.

importScripts("lib/parse-beatadp.js", "lib/yahoo-seed.js");

const BEATADP_URL = "https://www.beatadp.com/platform-adp";
const MAX_PLAYERS = 200;
const ALARM_NAME = "refresh-adp";
const REFRESH_PERIOD_MINUTES = 360; // 6 hours

const STORAGE_KEYS = {
  players: "ff-valuediff:live-players",
  refreshedAt: "ff-valuediff:refreshed-at",
  refreshError: "ff-valuediff:refresh-error",
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_PERIOD_MINUTES });
  refreshAdp();
});
chrome.runtime.onStartup.addListener(() => {
  refreshAdp();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refreshAdp();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "refresh-now") {
    refreshAdp().then(sendResponse);
    return true; // keep the message channel open for the async response
  }
});

async function refreshAdp() {
  try {
    const { [STORAGE_KEYS.players]: existing } = await chrome.storage.local.get(STORAGE_KEYS.players);
    const oldYahooByName = new Map();
    const oldIdByName = new Map();
    if (existing) {
      for (const p of existing) {
        const key = self.parseBeatAdp.normalizeName(p.name);
        oldIdByName.set(key, p.id);
        if (p.adp.yahoo != null) oldYahooByName.set(key, p.adp.yahoo);
      }
    } else {
      // Fresh install, first refresh ever: no prior storage to merge Yahoo
      // out of, so fall back to the static seed captured at build time.
      for (const [name, yahoo] of Object.entries(self.YAHOO_SEED)) {
        oldYahooByName.set(self.parseBeatAdp.normalizeName(name), yahoo);
      }
    }

    const res = await fetch(BEATADP_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`BeatADP responded ${res.status}`);
    const html = await res.text();

    const parsed = self.parseBeatAdp.parseBeatAdpHtml(html);
    if (parsed.length === 0) throw new Error("Parsed 0 players — BeatADP's page structure likely changed");

    const usedIds = new Set();
    const newPlayers = parsed.slice(0, MAX_PLAYERS).map((p) => {
      const key = self.parseBeatAdp.normalizeName(p.name);
      const yahoo = oldYahooByName.has(key) ? oldYahooByName.get(key) : null;
      let id = oldIdByName.get(key) || self.parseBeatAdp.slugify(p.name);
      if (usedIds.has(id)) id = `${id}-${p.team.toLowerCase()}`;
      usedIds.add(id);
      return {
        id,
        name: p.name,
        team: p.team,
        position: p.position,
        adp: { sleeper: p.adp.sleeper ?? null, yahoo, espn: p.adp.espn ?? null, fantasypros: p.adp.fantasypros ?? null },
      };
    });

    await chrome.storage.local.set({
      [STORAGE_KEYS.players]: newPlayers,
      [STORAGE_KEYS.refreshedAt]: Date.now(),
      [STORAGE_KEYS.refreshError]: null,
    });
    return { ok: true, count: newPlayers.length };
  } catch (err) {
    await chrome.storage.local.set({ [STORAGE_KEYS.refreshError]: String(err.message || err) });
    return { ok: false, error: String(err.message || err) };
  }
}
