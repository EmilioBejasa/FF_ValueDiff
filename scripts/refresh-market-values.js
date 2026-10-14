#!/usr/bin/env node
// Writes two files from Dynasty Daddy (see lib/dynasty-daddy.js):
// - data/market-values.js: today's KeepTradeCut, DynastyProcess and Dynasty
//   Superflex trade values, for the trade calculator's "What other
//   calculators say" panel.
// - data/market-history.js: a weekly history of the same dynasty values per
//   player, for the value graph on player profiles (loaded only when a
//   profile opens).
//
// Usage: node scripts/refresh-market-values.js [--dry-run] [--backfill]
//
// A normal run adds today's values to the history: the newest point moves
// forward each day until it's a week past the one before it, then a new
// point starts, so the history stays one point a week with today at the end.
// --backfill rebuilds the history from each player's last ~180 days (one
// request per player, so only run it by hand when starting over).
//
// None of these sites send a CORS header, so the page can't fetch them
// itself; the daily refresh-market-values Action runs this instead. Both
// files are plain scripts (they set window globals) so the page also works
// opened straight from disk.

const fs = require("fs");
const path = require("path");
const { MARKETS, HISTORY_FIELDS, fetchMarketRaw, fetchHistory, trimMarket } = require("./lib/dynasty-daddy");

const VALUES_OUT = path.join(__dirname, "..", "data", "market-values.js");
const HISTORY_OUT = path.join(__dirname, "..", "data", "market-history.js");
const DRY_RUN = process.argv.includes("--dry-run");
const BACKFILL = process.argv.includes("--backfill");

const HISTORY_MARKETS = Object.keys(HISTORY_FIELDS); // ktc, dp, dsf
const FORMATS = ["1qb", "sf"];
const WEEK_DAYS = 7;
const MAX_POINTS = 53; // about a year of weekly points
const DAY_MS = 24 * 60 * 60 * 1000;

const today = new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
const addDays = (d, n) => new Date(Date.parse(d) + n * DAY_MS).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const values = {};
  let ktcRaw;
  for (const m of MARKETS) {
    const raw = await fetchMarketRaw(m.market);
    if (m.key === "ktc") ktcRaw = raw;
    values[m.key] = trimMarket(raw);
    const n = Object.keys(values[m.key]["1qb"]).length;
    console.log(`${m.label}${m.mode === "redraft" ? " (redraft)" : ""}: ${n} values`);
    if (n < 100) throw new Error(`Suspiciously few ${m.label} values — files left as is.`);
  }

  writeIfChanged(VALUES_OUT, "MARKET_VALUES", { updatedOn: today, values }, JSON.stringify(values));

  const history = BACKFILL ? await backfill(ktcRaw) : addToday(readHistory(), values);
  writeIfChanged(HISTORY_OUT, "MARKET_HISTORY", history, JSON.stringify(history));
}

// { dates: [...], players: { <format>: { <sleeper id>: { <market>: [values aligned to dates] } } } }
function readHistory() {
  if (!fs.existsSync(HISTORY_OUT)) return { dates: [], players: { "1qb": {}, sf: {} } };
  const m = /window\.MARKET_HISTORY = (.*);\s*$/s.exec(fs.readFileSync(HISTORY_OUT, "utf8"));
  if (!m) throw new Error(`Couldn't read ${HISTORY_OUT}`);
  return JSON.parse(m[1]);
}

// Today's values onto the end of the history (see the header comment).
function addToday(history, values) {
  const { dates } = history;
  const n = dates.length;
  if (n && dates[n - 1] === today) {
    // Already ran today: overwrite.
  } else if (n >= 2 && daysBetween(dates[n - 2], dates[n - 1]) < WEEK_DAYS) {
    dates[n - 1] = today; // the newest point is still this week's: move it forward
  } else {
    dates.push(today);
    for (const f of FORMATS) for (const p of Object.values(history.players[f])) for (const k in p) p[k].push(null);
  }
  const col = dates.length - 1;

  for (const f of FORMATS) {
    const players = history.players[f];
    for (const k of HISTORY_MARKETS) {
      for (const [id, v] of Object.entries(values[k][f])) {
        if (id.includes("-")) continue; // picks have no profile
        const p = (players[id] ||= {});
        p[k] ||= dates.map(() => null);
        p[k][col] = v;
      }
    }
  }
  return trim(history);
}

// Drops points past MAX_POINTS, and players with no values left.
function trim(history) {
  const cut = Math.max(0, history.dates.length - MAX_POINTS);
  history.dates = history.dates.slice(cut);
  for (const f of FORMATS) {
    for (const [id, p] of Object.entries(history.players[f])) {
      for (const k in p) {
        p[k] = p[k].slice(cut);
        if (p[k].every((v) => v == null)) delete p[k];
      }
      if (!Object.keys(p).length) delete history.players[f][id];
    }
  }
  return history;
}

// Weekly points ending today, from each player's daily history.
async function backfill(ktcRaw) {
  const dates = [];
  for (let d = today; daysBetween(d, today) <= 180 - WEEK_DAYS; d = addDays(d, -WEEK_DAYS)) dates.unshift(d);
  const history = { dates, players: { "1qb": {}, sf: {} } };
  const players = ktcRaw.filter((e) => e.position !== "PI" && e.sleeper_id && e.name_id);
  let done = 0;
  for (const e of players) {
    try {
      const rows = (await fetchHistory(e.name_id)).map((r) => ({ ...r, day: r.date.slice(0, 10) })).sort((a, b) => a.day.localeCompare(b.day));
      for (const f of FORMATS) {
        const p = {};
        for (const k of HISTORY_MARKETS) {
          const field = HISTORY_FIELDS[k][f];
          // The latest value on or before each date.
          const series = dates.map((d) => {
            let v = null;
            for (const r of rows) { if (r.day > d) break; if (r[field] > 0) v = r[field]; }
            return v;
          });
          if (series.some((v) => v != null)) p[k] = series;
        }
        if (Object.keys(p).length) history.players[f][e.sleeper_id] = p;
      }
    } catch (err) {
      console.warn(`${e.full_name}: ${err.message}`);
    }
    if (++done % 50 === 0) console.log(`History: ${done}/${players.length}`);
    await sleep(250); // go easy on Dynasty Daddy
  }
  console.log(`History: ${Object.keys(history.players.sf).length} players, ${dates.length} weeks`);
  return history;
}

function writeIfChanged(file, global, data, compare) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (prev.includes(compare)) return console.log(`${path.basename(file)} unchanged.`);
  const source =
    `// Generated by scripts/refresh-market-values.js — don't edit by hand.\n` +
    `window.${global} = ${JSON.stringify(data)};\n`;
  if (DRY_RUN) return console.log(`Dry run — ${file} not written (${source.length} bytes).`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
  console.log(`Wrote ${file} (${source.length} bytes)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
