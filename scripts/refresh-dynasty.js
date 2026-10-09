#!/usr/bin/env node
// Rewrites the DYNASTY_VALUES snapshot embedded in ../index.html from
// FantasyCalc, for both 1QB and Superflex.
//
// Usage: node scripts/refresh-dynasty.js [--dry-run]
//
// The page already pulls these live on every load (see lib/fantasycalc.js),
// so this is only needed to keep the baked-in fallback current: what the
// dynasty tabs show offline or if FantasyCalc is down.

const fs = require("fs");
const path = require("path");
const { fetchValues } = require("./lib/fantasycalc");
const { replaceBlock } = require("./lib/bake");

const INDEX_HTML = path.join(__dirname, "..", "index.html");
const DRY_RUN = process.argv.includes("--dry-run");

// Must match DYNASTY_FIELDS in index.html, which expands each row back into an object.
const FIELDS = ["id", "name", "position", "team", "age", "value", "redraftValue", "overallRank", "posRank", "trend30", "tier"];

async function main() {
  let source = fs.readFileSync(INDEX_HTML, "utf8");
  const formats = { "1qb": await fetchValues({ superflex: false }), sf: await fetchValues({ superflex: true }) };
  for (const f in formats) console.log(`${f}: ${formats[f].length} rows (${formats[f].filter((r) => r.position === "PICK").length} picks)`);
  if (formats["1qb"].length < 100 || formats.sf.length < 100) throw new Error("Suspiciously few rows — index.html left as is.");

  const before = source;
  source = replaceBlock(source, "const DYNASTY_VALUES = {", "\n};", formatValues(formats));
  if (source === before) return console.log("Values unchanged — index.html left as is.");
  const today = new Date().toISOString().slice(0, 10);
  source = source.replace(/const DYNASTY_VALUES_UPDATED_ON = "[^"]*";/, `const DYNASTY_VALUES_UPDATED_ON = "${today}";`);

  if (DRY_RUN) return console.log("Dry run — index.html not written.");
  fs.writeFileSync(INDEX_HTML, source);
  console.log(`Wrote ${INDEX_HTML}`);
}

// One row per line, as a positional array in FIELDS order.
function formatValues(formats) {
  return Object.keys(formats).map((f) => {
    const rows = formats[f].map((r) => `    ${JSON.stringify(FIELDS.map((k) => r[k] ?? null))},`);
    return `  ${JSON.stringify(f)}: [\n${rows.join("\n")}\n  ],`;
  }).join("\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
