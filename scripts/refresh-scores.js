#!/usr/bin/env node
// Rewrites the WEEKLY_SCORES and DID_NOT_PLAY snapshots embedded in
// ../index.html from Sleeper's stats API, for every week played so far.
//
// Usage: node scripts/refresh-scores.js [--dry-run]
//
// The page already pulls these live from Sleeper on every load (see
// lib/sleeper-scores.js), so this is only needed to keep the baked-in
// fallback current: what the page shows offline or if Sleeper is down.

const fs = require("fs");
const path = require("path");
const { fetchState, fetchWeek, weeksToFetch, mergeExtras } = require("./lib/sleeper-scores");
const { extractBlock, replaceBlock } = require("./lib/bake");

const INDEX_HTML = path.join(__dirname, "..", "index.html");
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  let source = fs.readFileSync(INDEX_HTML, "utf8");
  const players = eval(extractBlock(source, "const samplePlayers = [", "\n];").text.replace(/^const samplePlayers = /, ""));

  const state = await fetchState();
  const byWeek = {};
  const dnp = {};
  for (const week of weeksToFetch(state)) {
    const wk = await fetchWeek(state.season, week, players);
    if (wk.teamsPlayed.length === 0) continue;
    byWeek[week] = wk;
    dnp[week] = wk.dnp;
    console.log(`Week ${week}: ${Object.keys(wk.scores).length} scores, ${wk.dnp.length} did not play, ${wk.teamsPlayed.length}/32 teams played`);
  }
  const { scores, players: extras } = mergeExtras(byWeek);
  console.log(`${extras.length} players outside samplePlayers have scored this season`);
  // Offseason/preseason: keep the last snapshot rather than blanking it.
  if (Object.keys(byWeek).length === 0) return console.log("No weeks played yet — index.html left as is.");

  const before = source;
  source = replaceBlock(source, "const WEEKLY_SCORES = {", "\n};", formatScores(scores));
  source = replaceBlock(source, "const DID_NOT_PLAY = {", "\n};", formatDnp(dnp));
  source = replaceBlock(source, "const EXTRA_PLAYERS = [", "\n];", formatExtras(extras), "];");
  // Only bump the date when the data changed, so scheduled runs don't commit no-ops.
  if (source === before) return console.log("Scores unchanged — index.html left as is.");
  const today = new Date().toISOString().slice(0, 10);
  source = source.replace(/const WEEKLY_SCORES_UPDATED_ON = "[^"]*";/, `const WEEKLY_SCORES_UPDATED_ON = "${today}";`);

  if (DRY_RUN) return console.log("Dry run — index.html not written.");
  fs.writeFileSync(INDEX_HTML, source);
  console.log(`Wrote ${INDEX_HTML}`);
}

// Five entries per line, sorted by id, matching the hand-entered layout.
function wrap(items) {
  const lines = [];
  for (let i = 0; i < items.length; i += 5) lines.push(`    ${items.slice(i, i + 5).join(", ")},`);
  return lines.join("\n");
}

function formatScores(byWeek) {
  return Object.keys(byWeek).map((w) => {
    const ids = Object.keys(byWeek[w]).sort();
    return `  ${w}: {\n${wrap(ids.map((id) => `"${id}": ${byWeek[w][id]}`))}\n  },`;
  }).join("\n");
}

function formatExtras(extras) {
  return extras.map((p) =>
    `  { id: "${p.id}", name: ${JSON.stringify(p.name)}, team: "${p.team}", position: "${p.position}", extra: true },`
  ).join("\n");
}

function formatDnp(byWeek) {
  return Object.keys(byWeek).map((w) => `  ${w}: [\n${wrap(byWeek[w].map((id) => `"${id}"`))}\n  ],`).join("\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
