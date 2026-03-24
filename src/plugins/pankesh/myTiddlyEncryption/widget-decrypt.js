/*\
title: $:/plugins/pankesh/myTiddlyEncryption/widget-decrypt.js
type: application/javascript
module-type: widget

<$tiddlyencrypt-decrypt tiddler="TiddlerTitle"/>

Standalone decrypt button for toolbar or wikitext placement.
Writes decrypted plaintext to session state only — never the wiki store.
\*/
(function() {
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var DecryptWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options);
};
DecryptWidget.prototype = Object.create(Widget.prototype);
DecryptWidget.prototype.constructor = DecryptWidget;

DecryptWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  var self    = this;
  var title   = this.getAttribute("tiddler", this.getVariable("currentTiddler"));
  var tiddler = $tw.wiki.getTiddler(title);
  if (!tiddler) { return; }

  var cryptoUtils = require("$:/plugins/pankesh/myTiddlyEncryption/crypto-utils.js");
  if (!cryptoUtils.isEncrypted(tiddler.fields.text || "")) { return; }

  var btn       = this.document.createElement("button");
  btn.className = "tc-btn-invisible tiddlyencrypt-decrypt-btn";
  btn.title     = "Decrypt (session only — not saved)";
  btn.appendChild(this.document.createTextNode("Decrypt"));

  btn.addEventListener("click", function(e) {
    e.preventDefault();
    self.doDecrypt(title);
  }, false);

  parent.insertBefore(btn, nextSibling);
  this.domNodes.push(btn);
};

DecryptWidget.prototype.doDecrypt = function(title) {
  var cryptoUtils   = require("$:/plugins/pankesh/myTiddlyEncryption/crypto-utils.js");
  var passwordStore = require("$:/plugins/pankesh/myTiddlyEncryption/password-store.js");
  var bodyModule    = require("$:/plugins/pankesh/myTiddlyEncryption/widget-encrypted-body.js");

  var tiddler = $tw.wiki.getTiddler(title);
  if (!tiddler) { return; }

  var decryptTag = findTag(tiddler.fields.tags || [], "Decrypt(");
  if (!decryptTag) { return; }
  var promptName = extractPromptName(decryptTag, "Decrypt(");

  function attemptDecrypt(password) {
    cryptoUtils.decrypt(tiddler.fields.text || "", password)
      .then(function(plaintext) {
        passwordStore.set(promptName, password);
        var session    = bodyModule._getSessionData();
        session[title] = plaintext;
        bodyModule._setSessionData(session);
      })
      .catch(function() {
        passwordStore.clear(promptName);
        // eslint-disable-next-line no-alert
        alert("Decryption failed for \"" + title + "\". Wrong password?");
      });
  }

  if (passwordStore.has(promptName)) {
    attemptDecrypt(passwordStore.get(promptName));
  } else {
    $tw.passwordPrompt.createPrompt({
      serviceName: "Decrypt: " + promptName,
      noUserName:  true,
      canCancel:   true,
      submitText:  "Decrypt",
      callback: function(data) {
        if (data && data.password) { attemptDecrypt(data.password); }
        return true;
      }
    });
  }
};

DecryptWidget.prototype.refresh = function(changedTiddlers) {
  var title = this.getAttribute("tiddler", this.getVariable("currentTiddler"));
  if (changedTiddlers[title]) { this.refreshSelf(); return true; }
  return false;
};

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

exports["tiddlyencrypt-decrypt"] = DecryptWidget;

})();
