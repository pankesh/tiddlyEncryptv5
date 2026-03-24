/*\
title: $:/plugins/pankesh/myTiddlyEncryption/widget-decrypt-all.js
type: application/javascript
module-type: widget

<$tiddlyencrypt-decryptall prompt="optionalLabel"/>

Chains password prompts for each unique Decrypt(x) prompt label,
then decrypts all matching tiddlers into session state.
Nothing written to the wiki store — saves always keep tiddlers encrypted.
\*/
(function() {
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var DecryptAllWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options);
};
DecryptAllWidget.prototype = Object.create(Widget.prototype);
DecryptAllWidget.prototype.constructor = DecryptAllWidget;

DecryptAllWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  var self         = this;
  var filterPrompt = this.getAttribute("prompt", "");

  var btn       = this.document.createElement("button");
  btn.className = "tc-btn-invisible tiddlyencrypt-decryptall-btn";
  btn.title     = filterPrompt
    ? "Decrypt all \"" + filterPrompt + "\" tiddlers (session only)"
    : "Decrypt all encrypted tiddlers (session only)";
  btn.appendChild(this.document.createTextNode(
    filterPrompt ? "Decrypt All (" + filterPrompt + ")" : "Decrypt All"
  ));

  btn.addEventListener("click", function(e) {
    e.preventDefault();
    self.doDecryptAll(filterPrompt);
  }, false);

  parent.insertBefore(btn, nextSibling);
  this.domNodes.push(btn);
};

DecryptAllWidget.prototype.doDecryptAll = function(filterPrompt) {
  var cryptoUtils   = require("$:/plugins/pankesh/myTiddlyEncryption/crypto-utils.js");
  var passwordStore = require("$:/plugins/pankesh/myTiddlyEncryption/password-store.js");

  var targets = collectTargets(filterPrompt, cryptoUtils);
  if (targets.length === 0) {
    // eslint-disable-next-line no-alert
    alert("No encrypted tiddlers found" + (filterPrompt ? " for \"" + filterPrompt + "\"" : "") + ".");
    return;
  }

  var missing = uniquePrompts(targets).filter(function(p) {
    return !passwordStore.has(p);
  });

  chainPrompts(missing, 0, passwordStore, function() {
    applyDecryptAll(targets, cryptoUtils, passwordStore);
  });
};

DecryptAllWidget.prototype.refresh = function() { return false; };

// ── Helpers ───────────────────────────────────────────────────────────────

function collectTargets(filterPrompt, cryptoUtils) {
  var results = [];
  $tw.wiki.each(function(tiddler, title) {
    var decryptTag = findTag(tiddler.fields.tags || [], "Decrypt(");
    if (!decryptTag) { return; }
    var promptName = extractPromptName(decryptTag, "Decrypt(");
    if (!promptName) { return; }
    if (filterPrompt && promptName !== filterPrompt) { return; }
    if (!cryptoUtils.isEncrypted(tiddler.fields.text || "")) { return; }
    results.push({ title: title, tiddler: tiddler, promptName: promptName });
  });
  return results;
}

function uniquePrompts(targets) {
  var seen = Object.create(null);
  return targets.reduce(function(acc, t) {
    if (!seen[t.promptName]) { seen[t.promptName] = true; acc.push(t.promptName); }
    return acc;
  }, []);
}

function chainPrompts(prompts, index, passwordStore, done) {
  if (index >= prompts.length) { done(); return; }
  $tw.passwordPrompt.createPrompt({
    serviceName: "Decrypt: " + prompts[index],
    noUserName:  true,
    canCancel:   true,
    submitText:  "Decrypt",
    callback: function(data) {
      if (data && data.password) {
        passwordStore.set(prompts[index], data.password);
        chainPrompts(prompts, index + 1, passwordStore, done);
      }
      return true;
    }
  });
}

function applyDecryptAll(targets, cryptoUtils, passwordStore) {
  var bodyModule = require("$:/plugins/pankesh/myTiddlyEncryption/widget-encrypted-body.js");
  var session    = bodyModule._getSessionData();
  var promises   = [];

  targets.forEach(function(item) {
    var password = passwordStore.get(item.promptName);
    if (!password) { return; }

    var p = cryptoUtils.decrypt(item.tiddler.fields.text, password)
      .then(function(plaintext) {
        session[item.title] = plaintext;
      })
      .catch(function() {
        passwordStore.clear(item.promptName);
        console.error("TiddlyEncrypt: decryption failed for", item.title);
      });
    promises.push(p);
  });

  Promise.all(promises).then(function() {
    bodyModule._setSessionData(session);
  });
}

function findTag(tags, prefix) {
  for (var i = 0; i < tags.length; i++) {
    if (tags[i].indexOf(prefix) === 0) { return tags[i]; }
  }
  return null;
}
function extractPromptName(tag, prefix) {
  var c = tag.lastIndexOf(")");
  return c < 0 ? null : tag.slice(prefix.length, c);
}

exports["tiddlyencrypt-decryptall"] = DecryptAllWidget;

})();
