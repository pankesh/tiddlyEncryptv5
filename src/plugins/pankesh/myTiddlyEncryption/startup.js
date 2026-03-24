/*\
title: $:/plugins/pankesh/myTiddlyEncryption/startup.js
type: application/javascript
module-type: startup

Listens for wiki changes. When a tiddler gets an Encrypt(prompt) tag with
unencrypted text, prompts for a password then encrypts it (async via Web Crypto).
Sets type: application/x-tiddlyencrypt so the custom parser takes over rendering.
\*/
(function() {
"use strict";

exports.name      = "tiddlyencrypt-startup";
exports.platforms = ["browser"];
exports.after     = ["story"];
exports.synchronous = true;

var cryptoUtils, passwordStore;
var pendingEncryption = Object.create(null); // title → true while awaiting password

var passwordPromptUtils;

exports.startup = function() {
  cryptoUtils        = require("$:/plugins/pankesh/myTiddlyEncryption/crypto-utils.js");
  passwordStore      = require("$:/plugins/pankesh/myTiddlyEncryption/password-store.js");
  passwordPromptUtils = require("$:/plugins/pankesh/myTiddlyEncryption/password-prompt.js");
  $tw.wiki.addEventListener("change", onWikiChange);
};

function onWikiChange(changes) {
  Object.keys(changes).forEach(function(title) {
    if (changes[title].deleted) { return; }
    if (pendingEncryption[title]) { return; }

    var tiddler = $tw.wiki.getTiddler(title);
    if (!tiddler) { return; }

    var tags       = tiddler.fields.tags || [];
    var encryptTag = findTag(tags, "Encrypt(");
    if (!encryptTag) { return; }
    if (cryptoUtils.isEncrypted(tiddler.fields.text || "")) { return; }

    var promptName = extractPromptName(encryptTag, "Encrypt(");
    if (!promptName) { return; }

    pendingEncryption[title] = true;

    function doEncrypt(password) {
      if (!password) {
        delete pendingEncryption[title];
        return;
      }
      passwordStore.set(promptName, password);

      // Re-fetch to get the latest text (user may have typed during async prompt)
      var current = $tw.wiki.getTiddler(title);
      if (!current) { delete pendingEncryption[title]; return; }

      var currentText   = current.fields.text || "";
      if (cryptoUtils.isEncrypted(currentText)) { delete pendingEncryption[title]; return; }

      var currentTags   = current.fields.tags || [];
      var currentEncTag = findTag(currentTags, "Encrypt(");
      if (!currentEncTag) { delete pendingEncryption[title]; return; }

      cryptoUtils.encrypt(currentText, password)
        .then(function(encrypted) {
          var latest = $tw.wiki.getTiddler(title);
          if (!latest) { return; }
          var latestTags   = latest.fields.tags || [];
          var latestEncTag = findTag(latestTags, "Encrypt(");
          if (!latestEncTag) { return; }
          if (cryptoUtils.isEncrypted(latest.fields.text || "")) { return; }
          var newTags = swapTag(latestTags, latestEncTag, "Decrypt(" + promptName + ")");
          $tw.wiki.addTiddler(new $tw.Tiddler(latest, {
            text: encrypted,
            tags: newTags,
            type: "application/x-tiddlyencrypt"
          }));
        })
        .catch(function(e) {
          console.error("TiddlyEncrypt: encryption failed for", title, e);
        })
        .then(function() {
          delete pendingEncryption[title];
        });
    }

    if (passwordStore.has(promptName)) {
      doEncrypt(passwordStore.get(promptName));
    } else {
      // New password — require confirmation via two-field modal
      passwordPromptUtils.promptEncrypt(promptName, doEncrypt);
    }
  });
}

// ── Shared helpers ────────────────────────────────────────────────────────

function findTag(tags, prefix) {
  for (var i = 0; i < tags.length; i++) {
    if (tags[i].indexOf(prefix) === 0) { return tags[i]; }
  }
  return null;
}

function extractPromptName(tag, prefix) {
  var closing = tag.lastIndexOf(")");
  return closing < 0 ? null : tag.slice(prefix.length, closing);
}

function swapTag(tags, oldTag, newTag) {
  return (tags || []).map(function(t) { return t === oldTag ? newTag : t; });
}

function promptForPassword(promptName, action, callback) {
  $tw.passwordPrompt.createPrompt({
    serviceName: action + ": " + promptName,
    noUserName:  true,
    canCancel:   true,
    submitText:  action,
    callback: function(data) {
      callback(data ? data.password : null);
      return true;
    }
  });
}

exports._findTag           = findTag;
exports._extractPromptName = extractPromptName;
exports._swapTag           = swapTag;
exports._promptForPassword = promptForPassword;

})();
