# myTiddlyEncryption

A TiddlyWiki v5 plugin for per-tiddler AES-256 encryption. Each tiddler can be independently encrypted with its own password, or multiple tiddlers can share a password using a prompt label.

## Features

- **Per-tiddler encryption** — encrypt individual tiddlers, not the whole wiki
- **Prompt labels** — group tiddlers under a shared password using a label (e.g. `Encrypt(work)`)
- **Session-only decryption** — decrypted content is held in memory and never written back to the saved file
- **Strong crypto** — AES-256-GCM with PBKDF2/SHA-256 key derivation via the browser-native Web Crypto API
- **Password confirmation** — two-field modal when setting a new password to prevent mistyping
- **Change password** — re-encrypt all tiddlers for a label with a new password in one action

## How it works

```
Tag tiddler with Encrypt(myLabel)
        ↓
Plugin prompts for password (with confirmation)
        ↓
Tiddler text is AES-256-GCM encrypted and stored
Tag changes to Decrypt(myLabel)
        ↓
Saved wiki contains only the encrypted version
        ↓
To read: click Decrypt → enter password → content shown in session only
```

---

## Installation

1. Download `dist/myTiddlyEncryption.json` from this repository
2. Open your TiddlyWiki v5 HTML file in a browser
3. Drag and drop the JSON file onto the page
4. Confirm the import in the dialog that appears
5. Save the wiki — the plugin is now active

> Requires TiddlyWiki v5.1.0 or later. Works with local single-file wikis opened via `file://`.

---

## Usage

### Encrypting a tiddler

1. Open a tiddler and add the tag `Encrypt(myLabel)` — replace `myLabel` with any short hint
2. A password dialog appears with two fields (password + confirm)
3. Enter and confirm your password
4. The tiddler content is encrypted immediately; the tag changes to `Decrypt(myLabel)`
5. Save the wiki — the encrypted version is stored

**Multiple tiddlers, same password:** tag them all with `Encrypt(myLabel)` using the same label. You are only asked for the password once per label per session.

### Decrypting a tiddler

Click the **Decrypt** button that appears in the tiddler body or toolbar.
Enter the password — the content is displayed for the current browser session only.
Saving the wiki always saves the encrypted version.

### Decrypt all tiddlers

Place this widget in any tiddler to add a Decrypt All button:

```
<$tiddlyencrypt-decryptall/>
```

To target a specific label only:

```
<$tiddlyencrypt-decryptall prompt="work"/>
```

### Change password

To change the password for all tiddlers sharing a label:

```
<$tiddlyencrypt-changepw prompt="myLabel"/>
```

This decrypts all matching tiddlers, prompts for a new password (with confirmation), re-encrypts them, and marks the wiki as unsaved.

---

## Widgets reference

| Widget | Description |
|--------|-------------|
| `<$tiddlyencrypt-decrypt tiddler="Title"/>` | Decrypt a single tiddler |
| `<$tiddlyencrypt-decryptall/>` | Decrypt all encrypted tiddlers |
| `<$tiddlyencrypt-decryptall prompt="label"/>` | Decrypt all tiddlers for a specific label |
| `<$tiddlyencrypt-changepw prompt="label"/>` | Change password for all tiddlers under a label |

---

## Security notes

- Passwords are held in memory for the current browser session only — never written to disk
- Encrypted tiddlers use **AES-256-GCM** (authenticated encryption — detects tampering)
- Keys are derived with **PBKDF2 / SHA-256 / 100,000 iterations**
- Each encryption uses a random 16-byte salt and 12-byte IV — identical plaintexts produce different ciphertexts
- **If you lose the password, the tiddler content cannot be recovered**
- The `$:/temp/tiddlyencrypt/session` tiddler (used for in-memory decrypted state) is excluded from TiddlyWiki's save filter and is never persisted

---

## Repository structure

```
src/
└── plugins/pankesh/myTiddlyEncryption/
    ├── plugin.info                  Plugin metadata and version
    ├── crypto-utils.js              Web Crypto API: encrypt / decrypt
    ├── password-store.js            In-memory per-session password cache
    ├── password-prompt.js           Single-field (decrypt) and two-field (encrypt) modals
    ├── startup.js                   Wiki change listener — encrypts on tag
    ├── parser-encrypted.js          Custom parser for application/x-tiddlyencrypt type
    ├── widget-encrypted-body.js     Renders 🔒 notice or decrypted content
    ├── widget-decrypt.js            Standalone decrypt button widget
    ├── widget-decrypt-all.js        Decrypt-all button widget
    ├── widget-change-pw.js          Change-password button widget
    └── tiddlers/
        ├── toolbar-button.tid       Toolbar Decrypt button
        ├── styles.tid               CSS
        └── readme.tid               In-wiki readme (shown in Control Panel)

dist/
└── myTiddlyEncryption.json         Packaged plugin — drag-drop into TiddlyWiki

tests/
├── crypto-utils.test.js            Unit tests for encryption round-trips
└── password-store.test.js          Unit tests for password cache

scripts/
└── build-plugin-json.js            Packages src/ into dist/myTiddlyEncryption.json
```

---

## Development

### Build

Packages the plugin folder into a single JSON and bumps the patch version:

```bash
node scripts/build-plugin-json.js
```

For a minor or major version bump, edit `src/plugins/pankesh/myTiddlyEncryption/plugin.info` directly before running the build.

### Test

```bash
node tests/crypto-utils.test.js
node tests/password-store.test.js
```

Requires Node.js 18+ (built-in Web Crypto API).

---

## License

MIT
