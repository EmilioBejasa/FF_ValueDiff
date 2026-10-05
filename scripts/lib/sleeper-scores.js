// Turns Sleeper's weekly stats feed into this app's WEEKLY_SCORES /
// DID_NOT_PLAY shape. Shared by index.html (loaded with a plain <script> tag,
// which exposes `window.SleeperScores`, so the page refreshes scores live on
// every load) and scripts/refresh-scores.js (require()'d, which bakes the
// same result into index.html as the offline fallback).
//
// Endpoints (both send an open CORS header):
// - api.sleeper.app/v1/state/nfl — the current season and week.
// - api.sleeper.com/stats/nfl/<season>/<week> — one row per player per game,
//   with `stats.gp` set only if they actually played and `stats.pts_ppr`
//   their PPR points (absent when it's 0).
(function (root) {
  const STATE_URL = "https://api.sleeper.app/v1/state/nfl";
  const statsUrl = (season, week) =>
    `https://api.sleeper.com/stats/nfl/${season}/${week}?season_type=regular`;

  // Players whose Sleeper name doesn't match ours, by Sleeper player_id.
  const SLEEPER_ID_OVERRIDES = {
    "gainwell": "7567",       // "Kenny Gainwell"
    "hunter-travis": "12530", // listed as a DB first
    "ward-cameron": "12522",  // "Cam Ward"
  };

  // Sleeper's team codes that differ from this app's.
  const TEAM_ALIASES = { WAS: "WSH" };
  const normalizeTeam = (t) => TEAM_ALIASES[t] || t;

  const normalizeName = (s) =>
    String(s || "").toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "").replace(/[^a-z]/g, "");

  // rows: the raw stats array for one week. players: samplePlayers.
  // Returns { scores: {id: pts}, dnp: [id], teamsPlayed: [team] } — scores for
  // anyone who took a snap, DNP for anyone whose team has played but who
  // didn't. Players whose team hasn't played yet (bye, or a game later in the
  // week) are in neither, so they stay blank instead of being guessed at.
  function summarizeWeek(rows, players) {
    const byId = new Map();
    const byName = new Map();
    const teamsPlayed = new Set();
    for (const r of rows) {
      if (!r || !r.player) continue;
      byId.set(r.player_id, r);
      if (r.stats && r.stats.gp > 0) teamsPlayed.add(normalizeTeam(r.team));
      const positions = r.player.fantasy_positions || [r.player.position];
      const key = normalizeName(`${r.player.first_name} ${r.player.last_name}`);
      for (const pos of positions) byName.set(`${key}|${pos}`, r);
    }

    const scores = {};
    const dnp = [];
    for (const p of players) {
      const override = SLEEPER_ID_OVERRIDES[p.id];
      const row = override ? byId.get(override) : byName.get(`${normalizeName(p.name)}|${p.position}`);
      if (row && row.stats && row.stats.gp > 0) {
        scores[p.id] = Math.round((row.stats.pts_ppr || 0) * 10) / 10;
      } else if (teamsPlayed.has(row ? normalizeTeam(row.team) : p.team) || (p.team === "FA" && teamsPlayed.size > 0)) {
        dnp.push(p.id); // free agents count as not playing once the week has started
      }
    }
    return { scores, dnp: dnp.sort(), teamsPlayed: [...teamsPlayed].sort() };
  }

  // sleeperPlayers: {sleeperId: {name, position}} (e.g. the trimmed
  // /players/nfl map). Returns {ourId: sleeperId} for every player in `pool`
  // that could be matched.
  function matchSleeperIds(pool, sleeperPlayers) {
    const byName = new Map();
    for (const id in sleeperPlayers) {
      const p = sleeperPlayers[id];
      byName.set(`${normalizeName(p.name)}|${p.position}`, id);
    }
    const out = {};
    for (const p of pool) {
      const id = SLEEPER_ID_OVERRIDES[p.id] || byName.get(`${normalizeName(p.name)}|${p.position}`);
      if (id && sleeperPlayers[id]) out[p.id] = id;
    }
    return out;
  }

  async function fetchState() {
    const res = await fetch(STATE_URL);
    if (!res.ok) throw new Error(`Sleeper state fetch failed (${res.status})`);
    return res.json();
  }

  async function fetchWeek(season, week, players) {
    const res = await fetch(statsUrl(season, week));
    if (!res.ok) throw new Error(`Sleeper Week ${week} stats fetch failed (${res.status})`);
    return summarizeWeek(await res.json(), players);
  }

  // Weeks 1 through Sleeper's current week, during the regular season.
  function weeksToFetch(state) {
    if (state.season_type !== "regular") return state.season_type === "post" ? range(18) : [];
    return range(Math.min(state.week, 18));
  }
  const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

  const api = { summarizeWeek, matchSleeperIds, fetchState, fetchWeek, weeksToFetch, SLEEPER_ID_OVERRIDES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SleeperScores = api;
})(typeof window !== "undefined" ? window : globalThis);
