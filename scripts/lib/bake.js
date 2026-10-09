// Helpers for the refresh-*.js scripts, which rewrite data blocks baked into
// index.html (e.g. `const WEEKLY_SCORES = {` … `\n};`) in place.

function extractBlock(source, start, end) {
  const i = source.indexOf(start);
  const j = source.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error(`Couldn't find "${start}" in index.html`);
  return { start: i, end: j + end.length, text: source.slice(i, j + end.length) };
}

function replaceBlock(source, start, end, body, close = "};") {
  const block = extractBlock(source, start, end);
  return source.slice(0, block.start) + `${start}\n${body}\n${close}` + source.slice(block.end);
}

module.exports = { extractBlock, replaceBlock };
