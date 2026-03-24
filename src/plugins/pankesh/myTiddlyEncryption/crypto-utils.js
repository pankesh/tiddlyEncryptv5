/*\
title: $:/plugins/pankesh/myTiddlyEncryption/crypto-utils.js
type: application/javascript
module-type: library

Encryption using the browser-native Web Crypto API.
No external dependencies — no SJCL, no third-party libraries.

Algorithm: AES-256-GCM (authenticated encryption — tamper detection built in)
Key derivation: PBKDF2 / SHA-256 / 100,000 iterations

All encrypt/decrypt functions return Promises.

Storage format (tiddler text field when encrypted):
  TWEncrypted:v2\n<base64(salt[16] + iv[12] + ciphertext)>
\*/
(function() {
"use strict";

var HEADER     = "TWEncrypted:v2";
var SALT_LEN   = 16; // bytes for PBKDF2 salt
var IV_LEN     = 12; // bytes for AES-GCM IV
var ITERATIONS = 100000;

/** Synchronous. Returns true if text is a versioned encrypted blob. */
exports.isEncrypted = function(text) {
  return typeof text === "string" && text.indexOf(HEADER + "\n") === 0;
};

/**
 * Encrypt plaintext with password.
 * @param {string} plaintext
 * @param {string} password
 * @returns {Promise<string>} versioned blob ready to store in a tiddler field
 */
exports.encrypt = function(plaintext, password) {
  var enc  = new TextEncoder();
  var salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  var iv   = window.crypto.getRandomValues(new Uint8Array(IV_LEN));

  return deriveKey(password, salt, ["encrypt"])
    .then(function(key) {
      return window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(plaintext)
      );
    })
    .then(function(ciphertext) {
      var blob = new Uint8Array(SALT_LEN + IV_LEN + ciphertext.byteLength);
      blob.set(salt, 0);
      blob.set(iv, SALT_LEN);
      blob.set(new Uint8Array(ciphertext), SALT_LEN + IV_LEN);
      return HEADER + "\n" + uint8ToBase64(blob);
    });
};

/**
 * Decrypt a versioned encrypted blob.
 * @param {string} ciphertext  The full TWEncrypted:v2\n... blob
 * @param {string} password
 * @returns {Promise<string>} decrypted plaintext
 * Rejects with Error("DecryptionFailed") on wrong password or corruption.
 */
exports.decrypt = function(ciphertext, password) {
  if (!exports.isEncrypted(ciphertext)) {
    return Promise.reject(new Error("DecryptionFailed: not an encrypted blob"));
  }

  var blob;
  try {
    blob = base64ToUint8(ciphertext.slice(HEADER.length + 1));
  } catch (e) {
    return Promise.reject(new Error("DecryptionFailed: invalid base64"));
  }

  var salt      = blob.slice(0, SALT_LEN);
  var iv        = blob.slice(SALT_LEN, SALT_LEN + IV_LEN);
  var encrypted = blob.slice(SALT_LEN + IV_LEN);

  return deriveKey(password, salt, ["decrypt"])
    .then(function(key) {
      return window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encrypted
      );
    })
    .then(function(plainBuffer) {
      return new TextDecoder().decode(plainBuffer);
    })
    .catch(function() {
      throw new Error("DecryptionFailed");
    });
};

// ── Internal helpers ──────────────────────────────────────────────────────

function deriveKey(password, salt, usages) {
  var enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  ).then(function(keyMaterial) {
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: ITERATIONS, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      usages
    );
  });
}

function uint8ToBase64(bytes) {
  var binary = "";
  for (var i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64) {
  var binary = atob(b64);
  var bytes  = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

})();
