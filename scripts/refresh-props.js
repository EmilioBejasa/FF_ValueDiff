#!/usr/bin/env node
// Refreshes the `WEEK_PROPS` array embedded in ../index.html with every
// player-prop line currently posted for this week's games, pulled from
// RotoWire's player-props board (which aggregates BetMGM, DraftKings,
// FanDuel, Caesars, and more).
//
// Usage: node scripts/refresh-props.js [--dry-run]
//
// Why a script instead of a live fetch like Sleeper's: RotoWire sends no
// CORS header, so a browser tab can't read it directly. Its page does embed
// the whole board as JSON, though, so a plain server-side fetch gets every
// book's line for every player without scraping rendered HTML.
//
// Books post lines game by game through the week (usually Tuesday-Saturday),
// so rerun this closer to kickoff to fill in games that weren't posted yet.

const fs = require("fs");
const path = require("path");
const { normalizeName } = require("./lib/parse-beatadp");

const INDEX_HTML = path.join(__dirname, "..", "index.html");
const ROTOWIRE_URL = "https://www.rotowire.com/betting/nfl/player-props.php";
const DRY_RUN = process.argv.includes("--dry-run");

// RotoWire market key -> WEEK_PROPS field.
const MARKETS = {
  passyds: "passYds",
  passtd: "passTds",
  intsthrown: "ints",
  rushyds: "rushYds",
  recs: "recs",
  recyds: "recYds",
  rushrec: "rushRecYds",
  anytd: "tdOdds",
};
// When books disagree on a line, the median line wins; these books' odds at
// that line are preferred, in this order.
const PREFERRED_BOOKS = ["mgm", "draftkings", "fanduel", "caesars"];
const FIELD_ORDER = ["passYds", "passTds", "ints", "rushYds", "rushRecYds", "recs", "recYds", "tdOdds"];

// "Kenneth Walker III" and "Kenneth Walker" should match.
function matchKey(name) {
  return normalizeName(String(name).replace(/\b(jr|sr|ii|iii|iv|v)\.?$/i, "").trim());
}

function medianLow(nums) {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

function extractRows(html) {
  const rows = [];
  const re = /\[\{"gameID"/g;
  let m;
  while ((m = re.exec(html))) {
    // Walk forward to the matching closing bracket (skipping string contents).
    let depth = 0, inStr = false, esc = false, i = m.index;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "[" || ch === "{") depth++;
      else if (ch === "]" || ch === "}") { depth--; if (depth === 0) break; }
    }
    try { rows.push(...JSON.parse(html.slice(m.index, i + 1))); } catch (e) { /* not a data array */ }
    re.lastIndex = i + 1;
  }
  return rows;
}

// { playerName: { team, markets: { passYds: [{book, line, over, under}] } } }
function collectLines(rows) {
  const byPlayer = new Map();
  const keyRe = new RegExp(`^([a-z]+)_(${Object.keys(MARKETS).join("|")})$`);
  for (const r of rows) {
    if (!r.name) continue;
    if (!byPlayer.has(r.name)) byPlayer.set(r.name, { team: r.team, markets: {} });
    const p = byPlayer.get(r.name);
    for (const [k, v] of Object.entries(r)) {
      const km = keyRe.exec(k);
      if (!km || v == null || v === "") continue;
      const [, book, market] = km;
      const field = MARKETS[market];
      const entry = { book, line: Number(v), over: toOdds(r[`${k}Over`]), under: toOdds(r[`${k}Under`]) };
      const list = (p.markets[field] ||= []);
      if (!list.some((e) => e.book === entry.book && e.line === entry.line)) list.push(entry);
    }
  }
  return byPlayer;
}

function toOdds(v) {
  return v == null || v === "" ? null : Number(v);
}

function consensus(field, entries) {
  // Anytime TD is a single price per book (no line, no under): take the median.
  if (field === "tdOdds") return medianLow(entries.map((e) => e.line));
  const line = medianLow(entries.map((e) => e.line));
  const atLine = entries.filter((e) => e.line === line && e.over != null && e.under != null);
  atLine.sort((a, b) => rank(a.book) - rank(b.book));
  const pick = atLine[0];
  return pick ? [line, pick.over, pick.under] : [line, null, null];
}

function rank(book) {
  const i = PREFERRED_BOOKS.indexOf(book);
  return i === -1 ? PREFERRED_BOOKS.length : i;
}

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Couldn't find "${startMarker}" in index.html`);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Couldn't find the end of "${startMarker}" in index.html`);
  return { start, end: end + endMarker.length, text: source.slice(start, end + endMarker.length) };
}

function samplePlayersFrom(source) {
  const block = extractBlock(source, "const samplePlayers = [", "\n];");
  // eslint-disable-next-line no-new-func
  return new Function(`${block.text.replace("const samplePlayers =", "return")}`)();
}

function formatEntry(id, props) {
  const parts = [`id: ${JSON.stringify(id)}`];
  for (const f of FIELD_ORDER) {
    if (props[f] === undefined) continue;
    parts.push(`${f}: ${Array.isArray(props[f]) ? `[${props[f].join(", ")}]` : props[f]}`);
  }
  return `  { ${parts.join(", ")} },`;
}

async function main() {
  const source = fs.readFileSync(INDEX_HTML, "utf8");
  const players = samplePlayersFrom(source);

  console.log(`Fetching ${ROTOWIRE_URL} ...`);
  const res = await fetch(ROTOWIRE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`RotoWire responded ${res.status}`);
  const html = await res.text();

  const rows = extractRows(html);
  if (rows.length === 0) throw new Error("Parsed 0 prop rows — RotoWire's page structure likely changed");
  const weekMatch = /Player Props:?\s*Week\s+(\d+)/i.exec(html);
  const lines = collectLines(rows);

  const byKey = new Map();
  for (const [name, p] of lines) {
    const key = matchKey(name);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(p);
  }

  const entries = [];
  let withYardage = 0;
  for (const player of players) {
    const candidates = byKey.get(matchKey(player.name)) || [];
    const found = candidates.find((c) => c.team === player.team) || (candidates.length === 1 ? candidates[0] : null);
    if (!found) continue;
    const props = {};
    for (const [field, list] of Object.entries(found.markets)) props[field] = consensus(field, list);
    if (Object.keys(props).length === 0) continue;
    if (Object.keys(props).some((f) => f !== "tdOdds")) withYardage++;
    entries.push(formatEntry(player.id, props));
  }

  const today = new Date().toISOString().slice(0, 10);
  let updated = source;
  const block = extractBlock(updated, "const WEEK_PROPS = [", "\n];");
  updated = updated.slice(0, block.start) + `const WEEK_PROPS = [\n${entries.join("\n")}\n];` + updated.slice(block.end);
  updated = updated.replace(/const PROPS_UPDATED_ON = "[^"]*";/, `const PROPS_UPDATED_ON = "${today}";`);
  if (weekMatch) updated = updated.replace(/const PROPS_WEEK = \d+;/, `const PROPS_WEEK = ${weekMatch[1]};`);

  console.log(`${rows.length} prop rows, ${lines.size} players on the board.`);
  console.log(`${entries.length} of ${players.length} pool players have at least one line; ${withYardage} have yardage/reception lines (the rest only a TD price so far).`);
  if (weekMatch) console.log(`Week ${weekMatch[1]}.`);

  if (DRY_RUN) {
    console.log("--dry-run: index.html not written.");
    return;
  }
  fs.writeFileSync(INDEX_HTML, updated);
  console.log("index.html updated.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
