/**
 * Unit tests for password-store.js
 * Run with: node tests/password-store.test.js
 */
"use strict";

var fs   = require("fs");
var src  = fs.readFileSync(
  __dirname + "/../src/plugins/pankesh/myTiddlyEncryption/password-store.js",
  "utf8"
);

// Strip TW module header comment and extract IIFE
var moduleBody = src
  .replace(/^\/\*\\[\s\S]*?\\\*\/\s*/m, "")
  .replace(/^[\s\S]*?\(function\(\)/, "(function()");

var exports = {};
/* jshint evil: true */
(new Function("exports", moduleBody))(exports);

// ── Test helpers ──────────────────────────────────────────────────────────

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  ✓ " + name);
    passed++;
  } catch (e) {
    console.error("  ✗ " + name);
    console.error("    " + e.message);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) { throw new Error(msg || "Assertion failed"); }
}

function assertEqual(a, b, msg) {
  if (a !== b) {
    throw new Error((msg || "Expected equal") + ": " + JSON.stringify(a) + " !== " + JSON.stringify(b));
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

console.log("\npassword-store.js tests:\n");

test("has() returns false for unknown prompt", function() {
  assert(!exports.has("unknown"), "should return false for unknown prompt");
});

test("get() returns undefined for unknown prompt", function() {
  assert(exports.get("unknown") === undefined, "should return undefined for unknown prompt");
});

test("set() and get() round-trip", function() {
  exports.set("work", "mySecret");
  assertEqual(exports.get("work"), "mySecret", "should retrieve stored password");
});

test("has() returns true after set()", function() {
  exports.set("home", "pass123");
  assert(exports.has("home"), "has() should return true after set()");
});

test("clear() removes a specific prompt", function() {
  exports.set("temp", "tempPass");
  exports.clear("temp");
  assert(!exports.has("temp"), "should not have prompt after clear()");
  assert(exports.get("temp") === undefined, "get() should return undefined after clear()");
});

test("clear() does not affect other prompts", function() {
  exports.set("a", "passA");
  exports.set("b", "passB");
  exports.clear("a");
  assert(!exports.has("a"), "a should be cleared");
  assert(exports.has("b"), "b should still be present");
});

test("clearAll() removes all prompts", function() {
  exports.set("x", "passX");
  exports.set("y", "passY");
  exports.clearAll();
  assert(!exports.has("x"), "x should be gone after clearAll");
  assert(!exports.has("y"), "y should be gone after clearAll");
});

test("cachedPrompts() returns only prompts with cached passwords", function() {
  exports.clearAll();
  exports.set("p1", "pass1");
  exports.set("p2", "pass2");
  var cached = exports.cachedPrompts();
  assert(cached.indexOf("p1") !== -1, "p1 should be in cachedPrompts");
  assert(cached.indexOf("p2") !== -1, "p2 should be in cachedPrompts");
  assertEqual(cached.length, 2, "should have exactly 2 cached prompts");
});

test("set() with empty string is treated as falsy by has()", function() {
  exports.set("empty", "");
  assert(!exports.has("empty"), "empty password should be treated as not cached");
});

// ── Summary ───────────────────────────────────────────────────────────────

console.log("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) { process.exit(1); }
