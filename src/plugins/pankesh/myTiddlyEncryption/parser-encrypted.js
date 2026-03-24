/*\
title: $:/plugins/pankesh/myTiddlyEncryption/parser-encrypted.js
type: application/javascript
module-type: parser

Parser for tiddlers with type: application/x-tiddlyencrypt

When TiddlyWiki renders the body of an encrypted tiddler via
  <$transclude field="text" mode="block"/>
it calls this parser. The parser returns a parse tree containing a single
tiddlyencrypt-encrypted-body widget node, which checks session state and
renders either the decrypted content or a Decrypt button.
\*/
(function() {
"use strict";

var EncryptedParser = function(type, text, options) {
  // Return a single widget node — the widget reads currentTiddler at render time
  this.tree = [{
    type:       "tiddlyencrypt-encrypted-body",
    attributes: {},
    children:   []
  }];
};

exports["application/x-tiddlyencrypt"] = EncryptedParser;

})();
