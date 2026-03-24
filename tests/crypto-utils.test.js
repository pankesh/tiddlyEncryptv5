/**
 * Unit tests for crypto-utils.js (Web Crypto API version)
 *
 * Requires Node.js 18+ (built-in Web Crypto at globalThis.crypto).
 * Run with: node tests/crypto-utils.test.js
 */
"use strict";

// Node.js 18+ has globalThis.crypto; older versions need the webcrypto shim
if (typeof globalThis.crypto === "undefined") {
  var nodeCrypto = require("crypto");
  globalThis.crypto = nodeCrypto.webcrypto || nodeCrypto;
}
// btoa / atob are built-in in Node 16+
if (typeof globalThis.btoa === "undefined") {
  globalThis.btoa = function(s) { return Buffer.from(s, "binary").toString("base64"); };
  globalThis.atob = function(s) { return Buffer.from(s, "base64").toString("binary"); };
}
if (typeof globalThis.TextEncoder === "undefined") {
  var util = require("util");
  globalThis.TextEncoder = util.TextEncoder;
  globalThis.TextDecoder = util.TextDecoder;
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}

var fs   = require("fs");
var src  = fs.readFileSync(
  __dirname + "/../src/plugins/pankesh/myTiddlyEncryption/crypto-utils.js", "utf8"
);

// Strip TW module header comment, extract IIFE body
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
  var result = fn();
  // Allow returning a Promise
  var p = (result && typeof result.then === "function") ? result : Promise.resolve(result);
  return p.then(function() {
    console.log("  ✓ " + name);
    passed++;
  }).catch(function(e) {
    console.error("  ✗ " + name);
    console.error("    " + (e && e.message || e));
    failed++;
  });
}

function assert(cond, msg) {
  if (!cond) { throw new Error(msg || "Assertion failed"); }
}
function assertEqual(a, b, msg) {
  if (a !== b) {
    throw new Error((msg || "Expected equal") + ": " + JSON.stringify(a) + " !== " + JSON.stringify(b));
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

console.log("\ncrypto-utils.js tests (Web Crypto API):\n");

var allTests = [

  test("isEncrypted returns false for plain text", function() {
    assert(!exports.isEncrypted("Hello world"));
  }),

  test("isEncrypted returns false for empty string", function() {
    assert(!exports.isEncrypted(""));
  }),

  test("encrypt produces TWEncrypted:v2 header", function() {
    return exports.encrypt("Hello", "password123").then(function(result) {
      assert(result.indexOf("TWEncrypted:v2\n") === 0, "bad header: " + result.slice(0, 20));
    });
  }),

  test("isEncrypted returns true for encrypted output", function() {
    return exports.encrypt("Hello", "password123").then(function(result) {
      assert(exports.isEncrypted(result));
    });
  }),

  test("encrypt/decrypt round-trip", function() {
    return exports.encrypt("Secret message", "MyPassword!")
      .then(function(encrypted) {
        return exports.decrypt(encrypted, "MyPassword!");
      })
      .then(function(decrypted) {
        assertEqual(decrypted, "Secret message");
      });
  }),

  test("decrypt rejects with DecryptionFailed on wrong password", function() {
    return exports.encrypt("Secret", "correctPassword")
      .then(function(encrypted) {
        return exports.decrypt(encrypted, "wrongPassword");
      })
      .then(function() {
        throw new Error("Should have rejected");
      })
      .catch(function(e) {
        assert(e.message === "DecryptionFailed", "got: " + e.message);
      });
  }),

  test("decrypt rejects on non-encrypted input", function() {
    return exports.decrypt("not encrypted", "password")
      .then(function() { throw new Error("Should have rejected"); })
      .catch(function(e) {
        assert(e.message.indexOf("DecryptionFailed") !== -1, "got: " + e.message);
      });
  }),

  test("encrypt handles empty string", function() {
    return exports.encrypt("", "password")
      .then(function(enc) { return exports.decrypt(enc, "password"); })
      .then(function(dec) { assertEqual(dec, ""); });
  }),

  test("encrypt handles unicode text", function() {
    var text = "Héllo wörld \u65E5\u672C\u8A9E \uD83D\uDD12";
    return exports.encrypt(text, "pass")
      .then(function(enc) { return exports.decrypt(enc, "pass"); })
      .then(function(dec) { assertEqual(dec, text); });
  }),

  test("two encryptions of same text produce different blobs (random IV/salt)", function() {
    return Promise.all([
      exports.encrypt("same text", "same password"),
      exports.encrypt("same text", "same password")
    ]).then(function(results) {
      assert(results[0] !== results[1], "ciphertexts should differ due to random IV/salt");
    });
  })

];

Promise.all(allTests).then(function() {
  console.log("\n" + passed + " passed, " + failed + " failed\n");
  if (failed > 0) { process.exit(1); }
});
