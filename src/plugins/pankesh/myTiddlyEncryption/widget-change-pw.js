/*\
title: $:/plugins/pankesh/myTiddlyEncryption/widget-change-pw.js
type: application/javascript
module-type: widget

<$tiddlyencrypt-changepw prompt="promptName"/>

Changes the encryption password for all tiddlers sharing a prompt label.
This is the ONE operation that modifies the wiki store — it re-encrypts
all matching tiddlers with the new password and clears their session state.
\*/
(function() {
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var ChangePwWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options);
};
ChangePwWidget.prototype = Object.create(Widget.prototype);
ChangePwWidget.prototype.constructor = ChangePwWidget;

ChangePwWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  var self       = this;
  var promptName = this.getAttribute("prompt", "");
  if (!promptName) { return; }

  var btn       = this.document.createElement("button");
  btn.className = "tc-btn-invisible tiddlyencrypt-changepw-btn";
  btn.title     = "Change password for \"" + promptName + "\"";
  btn.appendChild(this.document.createTextNode("Change Password (" + promptName + ")"));

  btn.addEventListener("click", function(e) {
    e.preventDefault();
    self.doChangePassword(promptName);
  }, false);

  parent.insertBefore(btn, nextSibling);
  this.domNodes.push(btn);
};

ChangePwWidget.prototype.doChangePassword = function(promptName) {
  var cryptoUtils        = require("$:/plugins/pankesh/myTiddlyEncryption/crypto-utils.js");
  var passwordStore      = require("$:/plugins/pankesh/myTiddlyEncryption/password-store.js");
  var bodyModule         = require("$:/plugins/pankesh/myTiddlyEncryption/widget-encrypted-body.js");
  var passwordPromptUtils = require("$:/plugins/pankesh/myTiddlyEncryption/password-prompt.js");

  function withCurrentPassword(currentPassword) {
    // Decrypt all matching tiddlers from the store
    var targets = [];
    $tw.wiki.each(function(tiddler, title) {
      var decryptTag = findTag(tiddler.fields.tags || [], "Decrypt(");
      if (!decryptTag) { return; }
      if (extractPromptName(decryptTag, "Decrypt(") !== promptName) { return; }
      if (!cryptoUtils.isEncrypted(tiddler.fields.text || "")) { return; }
      targets.push({ tiddler: tiddler, title: title });
    });

    if (targets.length === 0) {
      // eslint-disable-next-line no-alert
      alert("No encrypted tiddlers found for \"" + promptName + "\".");
      return;
    }

    // Decrypt all (async) then prompt for new password
    var decryptPromises = targets.map(function(item) {
      return cryptoUtils.decrypt(item.tiddler.fields.text, currentPassword)
        .then(function(plaintext) {
          return { tiddler: item.tiddler, title: item.title, plaintext: plaintext };
        });
    });

    Promise.all(decryptPromises)
      .then(function(decrypted) {
        // New password — two-field confirmation modal
        passwordPromptUtils.promptChangePassword(promptName, function(newPassword) {
            if (!newPassword) { return; }

            // Re-encrypt all with new password
            var reEncryptPromises = decrypted.map(function(item) {
              return cryptoUtils.encrypt(item.plaintext, newPassword)
                .then(function(encrypted) {
                  $tw.wiki.addTiddler(new $tw.Tiddler(item.tiddler, {
                    text: encrypted,
                    type: "application/x-tiddlyencrypt"
                    // tags stay as Decrypt(promptName)
                  }));
                  return item.title;
                });
            });

            Promise.all(reEncryptPromises).then(function(titles) {
              // Clear stale session entries for re-encrypted tiddlers
              var session = bodyModule._getSessionData();
              titles.forEach(function(t) { delete session[t]; });
              bodyModule._setSessionData(session);

              passwordStore.clear(promptName);
              passwordStore.set(promptName, newPassword);
              // eslint-disable-next-line no-alert
              alert("Password changed for \"" + promptName + "\". Save to persist.");
            });
        });
      })
      .catch(function() {
        passwordStore.clear(promptName);
        // eslint-disable-next-line no-alert
        alert("Could not decrypt with current password for \"" + promptName + "\".");
      });
  }

  if (passwordStore.has(promptName)) {
    withCurrentPassword(passwordStore.get(promptName));
  } else {
    $tw.passwordPrompt.createPrompt({
      serviceName: "Current password for: " + promptName,
      noUserName:  true,
      canCancel:   true,
      submitText:  "OK",
      callback: function(data) {
        if (data && data.password) {
          passwordStore.set(promptName, data.password);
          withCurrentPassword(data.password);
        }
        return true;
      }
    });
  }
};

ChangePwWidget.prototype.refresh = function() { return false; };

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

exports["tiddlyencrypt-changepw"] = ChangePwWidget;

})();
