/*\
title: $:/plugins/pankesh/myTiddlyEncryption/widget-encrypted-body.js
type: application/javascript
module-type: widget

Internal widget rendered by parser-encrypted.js.
Uses currentTiddler from widget context to determine which tiddler to show.

Renders one of:
  - Decrypted wikitext (read from $:/temp/tiddlyencrypt/session — never saved)
  - 🔒 Locked notice + Decrypt button (when not yet decrypted this session)

$:/temp/tiddlyencrypt/session is excluded from saves by TW5's default saver
filter (prefix $:/temp/), so decrypted plaintext is never written to the file.
\*/
(function() {
"use strict";

var SESSION_TIDDLER = "$:/temp/tiddlyencrypt/session";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var EncryptedBodyWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options);
};
EncryptedBodyWidget.prototype = Object.create(Widget.prototype);
EncryptedBodyWidget.prototype.constructor = EncryptedBodyWidget;

EncryptedBodyWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  this.renderContent(parent, nextSibling);
};

EncryptedBodyWidget.prototype.renderContent = function(parent, nextSibling) {
  var title     = this.getVariable("currentTiddler");
  var session   = getSessionData();

  if (Object.prototype.hasOwnProperty.call(session, title)) {
    this.renderDecryptedContent(parent, nextSibling, session[title]);
  } else {
    this.renderLockedNotice(parent, nextSibling, title);
  }
};

EncryptedBodyWidget.prototype.renderDecryptedContent = function(parent, nextSibling, plaintext) {
  var container = this.document.createElement("div");
  container.className = "tiddlyencrypt-decrypted-content";

  var parser      = this.wiki.parseText("text/vnd.tiddlywiki", plaintext, {});
  var innerWidget = this.wiki.makeWidget(parser, {
    document:     this.document,
    parentWidget: this
  });
  innerWidget.render(container, null);
  this.innerWidget = innerWidget;

  parent.insertBefore(container, nextSibling);
  this.domNodes.push(container);
};

EncryptedBodyWidget.prototype.renderLockedNotice = function(parent, nextSibling, title) {
  var self    = this;
  var tiddler = this.wiki.getTiddler(title);
  if (!tiddler) { return; }

  var tags       = tiddler.fields.tags || [];
  var decryptTag = findTag(tags, "Decrypt(");
  var promptName = decryptTag ? extractPromptName(decryptTag, "Decrypt(") : null;

  var wrapper = this.document.createElement("div");
  wrapper.className = "tiddlyencrypt-locked-notice";

  var notice = this.document.createElement("span");
  notice.className   = "tiddlyencrypt-lock-icon";
  notice.textContent = "\uD83D\uDD12 This tiddler is encrypted.";
  wrapper.appendChild(notice);

  if (promptName) {
    var btn = this.document.createElement("button");
    btn.className   = "tiddlyencrypt-decrypt-btn";
    btn.textContent = "Decrypt";
    btn.title       = "Decrypt for this session only — not saved to file";
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      self.handleDecrypt(title, promptName);
    }, false);
    wrapper.appendChild(btn);
  }

  parent.insertBefore(wrapper, nextSibling);
  this.domNodes.push(wrapper);
};

EncryptedBodyWidget.prototype.handleDecrypt = function(title, promptName) {
  var cryptoUtils   = require("$:/plugins/pankesh/myTiddlyEncryption/crypto-utils.js");
  var passwordStore = require("$:/plugins/pankesh/myTiddlyEncryption/password-store.js");

  var attemptDecrypt = function(password) {
    var tiddler = $tw.wiki.getTiddler(title);
    if (!tiddler) { return; }

    cryptoUtils.decrypt(tiddler.fields.text || "", password)
      .then(function(plaintext) {
        passwordStore.set(promptName, password);
        var session    = getSessionData();
        session[title] = plaintext;
        setSessionData(session);
      })
      .catch(function() {
        passwordStore.clear(promptName);
        // eslint-disable-next-line no-alert
        alert("Decryption failed for \"" + title + "\". Wrong password?");
      });
  };

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

EncryptedBodyWidget.prototype.refresh = function(changedTiddlers) {
  var title = this.getVariable("currentTiddler");
  if (changedTiddlers[SESSION_TIDDLER] || changedTiddlers[title]) {
    this.refreshSelf();
    return true;
  }
  if (this.innerWidget) {
    return this.innerWidget.refresh(changedTiddlers);
  }
  return false;
};

// ── Session state ─────────────────────────────────────────────────────────

function getSessionData() {
  var tiddler = $tw.wiki.getTiddler(SESSION_TIDDLER);
  if (!tiddler || !tiddler.fields.text) { return {}; }
  try { return JSON.parse(tiddler.fields.text); } catch (e) { return {}; }
}

function setSessionData(data) {
  $tw.wiki.addTiddler(new $tw.Tiddler({
    title: SESSION_TIDDLER,
    text:  JSON.stringify(data)
  }));
}

// ── Tag helpers ───────────────────────────────────────────────────────────

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

exports["tiddlyencrypt-encrypted-body"] = EncryptedBodyWidget;
exports._getSessionData = getSessionData;
exports._setSessionData = setSessionData;

})();
