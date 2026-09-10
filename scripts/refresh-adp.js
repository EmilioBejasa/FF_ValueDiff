#!/usr/bin/env node
// Refreshes the `samplePlayers` array embedded in ../index.html with current
// ADP from BeatADP's platform-comparison board (Sleeper, ESPN, FantasyPros —
// Yahoo is frozen, see the "stale" note on PLATFORMS in index.html and the
// README's "Keeping data fresh" section for why).
//
// Usage: node scripts/refresh-adp.js [--dry-run]
//
// index.html has no build step and isn't served by anything — it's a static
// file you open directly, and its `samplePlayers` array is baked-in source,
// not fetched at runtime. This script is how you keep that snapshot current:
// run it, it rewrites the array in place, then just reload the file.

const fs = require("fs");
const path = require("path");
const { parseBeatAdpHtml, slugify, normalizeName } = require("./lib/parse-beatadp");

const INDEX_HTML = path.join(__dirname, "..", "index.html");
const BEATADP_URL = "https://www.beatadp.com/platform-adp";
const MAX_PLAYERS = 200;
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const source = fs.readFileSync(INDEX_HTML, "utf8");

  const arrayBlock = extractBlock(source, "const samplePlayers = [", "\n];");
  const oldPlayers = evalPlayerArray(arrayBlock.text);
  const oldYahooByName = new Map();
  const oldIdByName = new Map();
  for (const p of oldPlayers) {
    const key = normalizeName(p.name);
    oldIdByName.set(key, p.id);
    if (p.adp.yahoo != null) oldYahooByName.set(key, p.adp.yahoo);
  }

  console.log(`Fetching ${BEATADP_URL} ...`);
  const res = await fetch(BEATADP_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`BeatADP responded ${res.status}`);
  const html = await res.text();

  const parsed = parseBeatAdpHtml(html);
  if (parsed.length === 0) {
    throw new Error("Parsed 0 players — BeatADP's page structure likely changed; see scripts/lib/parse-beatadp.js");
  }

  const usedIds = new Set();
  let frozenYahooCount = 0;
  let newPlayerCount = 0;
  const newPlayers = parsed.slice(0, MAX_PLAYERS).map((p) => {
    const key = normalizeName(p.name);
    const yahoo = oldYahooByName.has(key) ? oldYahooByName.get(key) : null;
    if (yahoo != null) frozenYahooCount++;
    else newPlayerCount++;

    let id = oldIdByName.get(key) || slugify(p.name);
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

  const newNames = new Set(newPlayers.map((p) => normalizeName(p.name)));
  const droppedPlayers = oldPlayers.filter((p) => !newNames.has(normalizeName(p.name)));

  const newArrayText = renderPlayerArray(newPlayers);
  const today = new Date().toISOString().slice(0, 10);
  const withNewArray =
    source.slice(0, arrayBlock.start) +
    `const samplePlayers = [\n${newArrayText}\n];` +
    source.slice(arrayBlock.end);
  const updatedSource = withNewArray.replace(
    /const DATA_REFRESHED_ON = "[^"]*";/,
    `const DATA_REFRESHED_ON = "${today}";`
  );

  console.log(`Parsed ${parsed.length} players from BeatADP, keeping top ${newPlayers.length}.`);
  console.log(`Yahoo: ${frozenYahooCount} carried over from last known value, ${newPlayerCount} never had one (shown blank).`);
  if (droppedPlayers.length) {
    console.log(`Dropped (no longer in BeatADP's top ${MAX_PLAYERS}): ${droppedPlayers.map((p) => p.name).join(", ")}`);
  }

  if (DRY_RUN) {
    console.log("--dry-run: not writing index.html.");
    return;
  }

  fs.writeFileSync(INDEX_HTML, updatedSource);
  console.log(`Updated ${INDEX_HTML} (DATA_REFRESHED_ON = ${today}).`);
}

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find "${startMarker}" in index.html`);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Could not find closing "${endMarker}" after samplePlayers`);
  return { start, end: end + endMarker.length, text: source.slice(start, end + endMarker.length) };
}

function evalPlayerArray(text) {
  // Trusted local file, plain object-literal source (not JSON: unquoted keys).
  const fn = new Function(`${text}\nreturn samplePlayers;`);
  return fn();
}

function renderPlayerArray(players) {
  return players
    .map((p) => {
      const adp = `{ sleeper: ${fmt(p.adp.sleeper)}, yahoo: ${fmt(p.adp.yahoo)}, espn: ${fmt(p.adp.espn)}, fantasypros: ${fmt(p.adp.fantasypros)} }`;
      return `  { id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, team: ${JSON.stringify(p.team)}, position: ${JSON.stringify(p.position)}, adp: ${adp} },`;
    })
    .join("\n");
}

function fmt(v) {
  return v == null ? "null" : String(v);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
