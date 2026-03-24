#!/usr/bin/env node
/**
 * Build script: packages the plugin folder into a single JSON file
 * that can be drag-and-dropped into a TiddlyWiki v5 HTML file.
 *
 * Output: dist/myTiddlyEncryption.json
 *
 * Usage: node scripts/build-plugin-json.js
 */
"use strict";

var fs   = require("fs");
var path = require("path");

var ROOT       = path.resolve(__dirname, "..");
var PLUGIN_DIR = path.join(ROOT, "src/plugins/pankesh/myTiddlyEncryption");
var DIST_DIR   = path.join(ROOT, "dist");
var OUT_FILE   = path.join(DIST_DIR, "myTiddlyEncryption.json");

// ── Read plugin.info and bump patch version (semver) ─────────────────────
//
// Versioning strategy (semver: MAJOR.MINOR.PATCH):
//   PATCH  bumped automatically on every build (bug fixes, iterative testing)
//   MINOR  bump manually when new backwards-compatible features are added
//   MAJOR  bump manually for breaking changes or significant rewrites
//
// Rule: patch resets to 0 when minor is bumped; both reset when major is bumped.

var pluginInfoPath = path.join(PLUGIN_DIR, "plugin.info");
var pluginInfo     = JSON.parse(fs.readFileSync(pluginInfoPath, "utf8"));

var parts = (pluginInfo.version || "1.0.0").split(".").map(Number);
parts[2]  = (parts[2] || 0) + 1; // bump patch
pluginInfo.version = parts.join(".");

fs.writeFileSync(pluginInfoPath, JSON.stringify(pluginInfo, null, 2) + "\n", "utf8");
console.log("  version → " + pluginInfo.version + "  (patch bump; edit plugin.info for minor/major)");

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Parse the TW module header comment block at the top of a .js file.
 * Format:
 *   /*\
 *   title: ...
 *   type: ...
 *   module-type: ...
 *   \* /
 * Returns an object with the fields found in the header.
 */
function parseJsHeader(src) {
  var match = src.match(/^\/\*\\\n([\s\S]*?)\\\*\//);
  if (!match) { return {}; }
  var fields = {};
  match[1].split("\n").forEach(function(line) {
    var colon = line.indexOf(":");
    if (colon < 0) { return; }
    var key = line.slice(0, colon).trim();
    var val = line.slice(colon + 1).trim();
    if (key) { fields[key] = val; }
  });
  return fields;
}

/**
 * Parse a .tid file. The format is:
 *   key: value
 *   key: value
 *   <blank line>
 *   <body text>
 *
 * Returns a tiddler fields object.
 */
function parseTidFile(src) {
  var blankLine = src.indexOf("\n\n");
  var headerBlock, body;
  if (blankLine === -1) {
    // No body — all headers
    headerBlock = src;
    body = "";
  } else {
    headerBlock = src.slice(0, blankLine);
    body = src.slice(blankLine + 2);
  }

  var fields = {};
  headerBlock.split("\n").forEach(function(line) {
    var colon = line.indexOf(":");
    if (colon < 0) { return; }
    var key = line.slice(0, colon).trim();
    var val = line.slice(colon + 1).trim();
    if (key) { fields[key] = val; }
  });

  fields.text = body;
  return fields;
}

// ── Collect tiddlers ──────────────────────────────────────────────────────

var tiddlers = {};

// Process .js files in the plugin root
fs.readdirSync(PLUGIN_DIR).forEach(function(filename) {
  if (!filename.endsWith(".js")) { return; }
  var src    = fs.readFileSync(path.join(PLUGIN_DIR, filename), "utf8");
  var header = parseJsHeader(src);

  if (!header.title) {
    console.warn("  WARN: no title in header of " + filename + " — skipping");
    return;
  }

  tiddlers[header.title] = Object.assign({}, header, { text: src });
  console.log("  + " + header.title + "  [" + (header["module-type"] || "?") + "]");
});

// Process .tid files in tiddlers/ subfolder
var tiddlersDir = path.join(PLUGIN_DIR, "tiddlers");
if (fs.existsSync(tiddlersDir)) {
  fs.readdirSync(tiddlersDir).forEach(function(filename) {
    if (!filename.endsWith(".tid")) { return; }
    var src    = fs.readFileSync(path.join(tiddlersDir, filename), "utf8");
    var fields = parseTidFile(src);

    if (!fields.title) {
      console.warn("  WARN: no title in " + filename + " — skipping");
      return;
    }

    tiddlers[fields.title] = fields;
    console.log("  + " + fields.title);
  });
}

// ── Assemble plugin tiddler ───────────────────────────────────────────────
//
// A TiddlyWiki v5 plugin is itself a tiddler whose:
//   - type  = "application/json"
//   - text  = JSON string of { "tiddlers": { <title>: <fields>, ... } }
//
// The drag-and-drop import format is a JSON array of one or more tiddlers.

var pluginTiddler = Object.assign({}, pluginInfo, {
  type: "application/json",
  text: JSON.stringify({ tiddlers: tiddlers }, null, 2)
});

var output = JSON.stringify([pluginTiddler], null, 2);

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

fs.writeFileSync(OUT_FILE, output, "utf8");

console.log("\n✓ Plugin packaged → " + path.relative(ROOT, OUT_FILE));
console.log("  Tiddlers included: " + Object.keys(tiddlers).length);
console.log("\nTo install: drag-and-drop dist/myTiddlyEncryption.json onto your TiddlyWiki v5 page.\n");
