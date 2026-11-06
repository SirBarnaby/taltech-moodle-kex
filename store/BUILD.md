# Building TalTech Moodle KEX from source

For store reviewers. The add-on's code is TypeScript and Preact, bundled with esbuild. The bundle is not obfuscated: release builds
drop whitespace and dead syntax but keep every name readable.

## Requirements

- Node.js 22 or newer, with npm 10 or newer (any OS; checked on Linux and Windows)
- No other tools, no network access during the build itself

## Build

From the folder this file came in (the root of the source zip):

```sh
npm ci --ignore-scripts
node scripts/build.mjs            # Firefox  -> dist/firefox/
node scripts/build.mjs --chrome   # Chrome   -> dist/chrome/
```

`dist/firefox/` is exactly the content of the Firefox package, and `dist/chrome/` that of the Chrome package, byte for byte. The
only exception is `build-info.json`, which records the build time. The build checks this itself: it hashes its inputs and outputs
into `build-info.json` and verifies them before it finishes.

## What is where

| Path | What it is |
|---|---|
| `src/content/` | The content script: it runs on `https://moodle.taltech.ee/*` and draws the new interface over Moodle's page |
| `src/background/` | The background script: opens the options page when asked, and checks the settings on install |
| `src/popup/`, `src/options/` | The toolbar popup and the options page |
| `src/ui/`, `src/styles/` | Interface components and their CSS |
| `src/data/` | Reads Moodle's pages and calls Moodle's own web services (`/lib/ajax/service.php`) with the user's session |
| `manifest/base.json` | The manifest. The build adds the version from `package.json`, and for Chrome writes the MV3 form |
| `assets/`, fonts from `node_modules/@fontsource-variable/*` | Icons, fallback images and the bundled fonts (Inter, Inter Tight, JetBrains Mono, all OFL) |

## What it does not do

- It loads no remote code, and it makes no requests to any server other than `moodle.taltech.ee`.
- It has no analytics or tracking, and it collects no data.
- It stores settings, pins and a short-lived cache of course structure in `storage.local`, on the user's own computer only.
