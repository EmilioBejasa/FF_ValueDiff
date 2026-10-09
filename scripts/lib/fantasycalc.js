// Dynasty trade values from FantasyCalc, trimmed to this app's shape. Shared
// by index.html (loaded with a plain <script> tag, which exposes
// `window.FantasyCalc`, so the dynasty tabs pull fresh values on load) and
// scripts/refresh-dynasty.js (require()'d, which bakes the same rows into
// index.html as the offline fallback).
//
// Endpoint (sends an open CORS header):
// - api.fantasycalc.com/values/current?isDynasty=<true|false>&numQbs=<1|2>&numTeams=<8-14>&ppr=<0|0.5|1>
//   Dynasty: ~420 entries, skill players plus generic rookie picks ("2027 1st
//   (Early)", "2028 2nd"). Redraft: ~200 players and no picks. Values come
//   from real trades on fantasy platforms. numTeams only goes from 8 to 14 (16
//   quietly returns the 12-team values), and there's no TE-premium option.
//   Players carry their Sleeper player_id; picks carry an "FP_<year>_..." id
//   in the same field, so one `id` works as the key for both.
(function (root) {
  const MAX_TEAMS = 14;
  const valuesUrl = ({ dynasty = true, superflex, teams = 12, ppr = 1 }) =>
    `https://api.fantasycalc.com/values/current?isDynasty=${dynasty}&numQbs=${superflex ? 2 : 1}` +
    `&numTeams=${Math.min(teams, MAX_TEAMS)}&ppr=${ppr}`;

  // Sleeper's team codes that differ from this app's (same as sleeper-scores.js).
  const TEAM_ALIASES = { WAS: "WSH" };

  const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

  // One compact row per entry: { id, name, position, team, age, value,
  // redraftValue, overallRank, posRank, trend30, tier }. Picks get
  // position "PICK" and no team/age.
  function trimValues(entries) {
    return entries
      .filter((e) => e && e.player && e.player.sleeperId && e.value > 0)
      .map((e) => {
        const p = e.player;
        const isPick = p.position === "PICK";
        return {
          id: String(p.sleeperId),
          name: p.name,
          position: p.position,
          team: isPick ? null : TEAM_ALIASES[p.maybeTeam] || p.maybeTeam || null,
          age: isPick ? null : round1(p.maybeAge),
          value: e.value,
          redraftValue: isPick ? null : e.redraftValue ?? null,
          overallRank: e.overallRank,
          posRank: e.positionRank,
          trend30: e.trend30Day || 0,
          tier: e.maybeTier ?? null,
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  // Options: { dynasty = true, superflex, teams = 12, ppr = 1 }.
  async function fetchValues(options) {
    const res = await fetch(valuesUrl(options));
    if (!res.ok) throw new Error(`FantasyCalc values fetch failed (${res.status})`);
    return trimValues(await res.json());
  }

  // Parses a pick row's name ("2027 1st (Early)", "2028 2nd") into
  // { year, round, slot } — slot is "early" | "mid" | "late" | null.
  function parsePick(name) {
    const m = /^(\d{4}) (\d)(?:st|nd|rd|th)(?: \((Early|Mid|Late)\))?$/.exec(name || "");
    return m ? { year: Number(m[1]), round: Number(m[2]), slot: m[3] ? m[3].toLowerCase() : null } : null;
  }

  const api = { fetchValues, trimValues, parsePick, valuesUrl, MAX_TEAMS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FantasyCalc = api;
})(typeof window !== "undefined" ? window : globalThis);
