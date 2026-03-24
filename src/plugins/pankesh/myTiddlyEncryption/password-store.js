/*\
title: $:/plugins/pankesh/myTiddlyEncryption/password-store.js
type: application/javascript
module-type: library

In-memory per-prompt password cache for the current browser session.
Passwords are never persisted to disk.

A "prompt" is the user-supplied label inside the Encrypt(prompt) tag,
used to group tiddlers that share the same password.
\*/
(function() {
"use strict";

var cache = Object.create(null);

/** Return the cached password for a prompt, or undefined. */
exports.get = function(prompt) {
  return cache[prompt];
};

/** Store a password for a prompt. */
exports.set = function(prompt, password) {
  cache[prompt] = password;
};

/** Returns true if a password has been cached for the prompt. */
exports.has = function(prompt) {
  return Object.prototype.hasOwnProperty.call(cache, prompt) && !!cache[prompt];
};

/** Remove the cached password for a prompt (forces re-entry on next operation). */
exports.clear = function(prompt) {
  delete cache[prompt];
};

/** Remove all cached passwords. */
exports.clearAll = function() {
  cache = Object.create(null);
};

/**
 * Return an array of all unique prompt strings that have cached passwords.
 * @returns {string[]}
 */
exports.cachedPrompts = function() {
  return Object.keys(cache).filter(function(k) { return !!cache[k]; });
};

})();
