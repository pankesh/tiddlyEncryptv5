/*\
title: $:/plugins/pankesh/myTiddlyEncryption/password-prompt.js
type: application/javascript
module-type: library

Password prompt utilities.

  promptDecrypt(promptName, callback)
    Single password field — used when decrypting (user knows the password).

  promptEncrypt(promptName, callback)
    Two password fields with confirmation — used when setting a new password
    (encryption, change-password). Prevents mistyped passwords locking data.

Both call callback(password) on success or callback(null) on cancel.
\*/
(function() {
"use strict";

/**
 * Single-field prompt for decryption.
 * Uses TW5's built-in $tw.passwordPrompt.
 */
exports.promptDecrypt = function(promptName, callback) {
  $tw.passwordPrompt.createPrompt({
    serviceName: "Decrypt: " + promptName,
    noUserName:  true,
    canCancel:   true,
    submitText:  "Decrypt",
    callback: function(data) {
      callback(data ? data.password : null);
      return true;
    }
  });
};

/**
 * Two-field confirmation prompt for setting a new password.
 * Renders a custom DOM modal; validates that both fields match.
 */
exports.promptEncrypt = function(promptName, callback) {
  showConfirmModal({
    title:      "Set password: " + promptName,
    submitText: "Encrypt",
    onSubmit:   callback
  });
};

/**
 * Same two-field prompt but labelled for changing a password.
 */
exports.promptChangePassword = function(promptName, callback) {
  showConfirmModal({
    title:      "New password for: " + promptName,
    submitText: "Set New Password",
    onSubmit:   callback
  });
};

// ── DOM modal ─────────────────────────────────────────────────────────────

function showConfirmModal(opts) {
  var overlay = document.createElement("div");
  overlay.className = "tiddlyencrypt-modal-overlay";

  var box = document.createElement("div");
  box.className = "tiddlyencrypt-modal-box";

  // Title
  var heading = document.createElement("h3");
  heading.className   = "tiddlyencrypt-modal-title";
  heading.textContent = opts.title;
  box.appendChild(heading);

  // Password field
  var pw1Label = document.createElement("label");
  pw1Label.textContent = "Password:";
  var pw1 = document.createElement("input");
  pw1.type      = "password";
  pw1.className = "tiddlyencrypt-modal-input";
  pw1.setAttribute("autocomplete", "new-password");
  pw1Label.appendChild(pw1);
  box.appendChild(pw1Label);

  // Confirm field
  var pw2Label = document.createElement("label");
  pw2Label.textContent = "Confirm password:";
  var pw2 = document.createElement("input");
  pw2.type      = "password";
  pw2.className = "tiddlyencrypt-modal-input";
  pw2.setAttribute("autocomplete", "new-password");
  pw2Label.appendChild(pw2);
  box.appendChild(pw2Label);

  // Error message (hidden until needed)
  var errorMsg = document.createElement("p");
  errorMsg.className = "tiddlyencrypt-modal-error";
  errorMsg.style.display = "none";
  box.appendChild(errorMsg);

  // Buttons
  var btnRow = document.createElement("div");
  btnRow.className = "tiddlyencrypt-modal-buttons";

  var submitBtn = document.createElement("button");
  submitBtn.textContent = opts.submitText;
  submitBtn.className   = "tiddlyencrypt-modal-submit";

  var cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className   = "tiddlyencrypt-modal-cancel";

  btnRow.appendChild(submitBtn);
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Focus first field
  setTimeout(function() { pw1.focus(); }, 50);

  function close() {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function handleSubmit() {
    var p1 = pw1.value;
    var p2 = pw2.value;

    if (!p1) {
      showError("Please enter a password.");
      pw1.focus();
      return;
    }
    if (p1 !== p2) {
      showError("Passwords do not match. Please try again.");
      pw2.value = "";
      pw2.focus();
      return;
    }

    close();
    opts.onSubmit(p1);
  }

  function showError(msg) {
    errorMsg.textContent    = msg;
    errorMsg.style.display  = "block";
  }

  submitBtn.addEventListener("click", function(e) {
    e.preventDefault();
    handleSubmit();
  });

  cancelBtn.addEventListener("click", function(e) {
    e.preventDefault();
    close();
    opts.onSubmit(null);
  });

  // Enter key in either field submits
  [pw1, pw2].forEach(function(field) {
    field.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
      if (e.key === "Escape") { e.preventDefault(); close(); opts.onSubmit(null); }
    });
  });

  // Click outside the box cancels
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) { close(); opts.onSubmit(null); }
  });
}

})();
