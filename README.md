# TalTech Moodle KEX

A fast, keyboard-first redesign of [moodle.taltech.ee](https://moodle.taltech.ee) for Firefox. It restyles Moodle in your browser:
a sidebar of your courses, a Workspace with your deadlines, course pages as topic lists with a preview sheet, focused quiz
pages, and a command palette (`Ctrl+K`). Moodle itself is not changed: every action still goes to Moodle's own pages and
web services with your own session.

Firefox 140 or newer (desktop). It was developed against Moodle 4.5 (TalTech) and checked on a Moodle 5.3 lab.

## Install

### Try it (temporary, until Firefox restarts)

1. Build it once: `npm ci && npm run build` (Node 22 or newer). The extension is in `dist/firefox/`.
   (Or use a ready `dist/packages/kex.xpi`, made by `npm run pack`.)
2. In Firefox open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...** and choose `dist/firefox/manifest.json` (or the `.xpi`).
4. Open <https://moodle.taltech.ee>. Firefox forgets temporary add-ons when it closes.

### Permanent install (signed, only for you)

Release Firefox only keeps add-ons that Mozilla has signed. You can sign this one yourself as an **unlisted** add-on: it is not
published on the store and nobody else sees it.

1. Make a free account on <https://addons.mozilla.org> and create API credentials at
   <https://addons.mozilla.org/developers/addon/api/key/> (a "JWT issuer" and a "JWT secret").
2. In this folder:

   ```sh
   export WEB_EXT_API_KEY="user:12345:67"      # JWT issuer
   export WEB_EXT_API_SECRET="..."             # JWT secret
   npm run build
   npm run sign
   ```

   The signed file appears in `web-ext-artifacts/`. Keep the keys private; they are used only on your machine.
3. In Firefox: `about:addons` > the gear menu > **Install Add-on From File...** > choose the signed `.xpi`.

The add-on id is `taltech-moodle-kex@kex.local`. For a new version raise `version` in `manifest/base.json` before signing
(Mozilla refuses to sign the same version twice).

## Privacy

- The extension runs only on `https://moodle.taltech.ee/*`. Its only permissions are `storage` and that host.
- It sends nothing anywhere else: no analytics, no remote code, no third-party requests. It declares `data_collection_permissions: none`.
- It talks to Moodle with the page's own session (the same requests the Moodle web app makes). The session key is kept
  in memory only and is never written to storage.
- What is stored, in this Firefox profile only (`browser.storage.local`): your settings (theme, language, effects, motion),
  course aliases and order, your pins (you can export them as JSON), and a short-lived cache of course structure so pages open
  fast. The options page can clear the cache and export or import pins.

## Keyboard shortcuts

Press `?` anywhere for the live list. Single keys work when you are not typing in a field.

| Where | Keys | Does |
|---|---|---|
| Everywhere | `Ctrl+K` or `/` | Command palette (courses, topics, materials, pins, pages, actions) |
| | `?` | Shortcut help |
| | `t` | Toggle light and dark theme |
| | `Ctrl+B` | Collapse or expand the sidebar |
| | `g w` `g p` `g m` `g d` `g u` | Go to Workspace, Pinned, My courses, Deadlines, Updates |
| | `g c` `g r` `g n` `g s` | Go to Calendar, Grades, Notifications, Messages |
| | `Alt+1` ... `Alt+9` | Open the nth sidebar course |
| | `Alt+Up` / `Alt+Down` | Previous or next course |
| | `Esc` | Close the top overlay |
| | `Alt+Shift+O` | Switch KEX off or on for this page |
| Workspace | `j` `k` or arrows | Move between rows |
| | `1` `2` `3` | Everything, Deadlines, Updates |
| | `Enter` / `Ctrl+Enter` | Open the row / open in a new tab |
| | `p`, `x`, `m`, `Shift+M`, `e`, `z` | Pin, mark done, mark read, mark all read, edit pins, undo |
| Course | `j` `k` | Previous or next topic (or material when the list is focused) |
| | `h` `l` | Move between the topic list and the materials (`g t` focuses the topics) |
| | `0`, `1` `2` `3` | Course info; Everything, Lectures, Labs |
| | `Enter`, `Ctrl+Enter` or `o` | Open the material / open in a new tab |
| | `Space` | Preview the material (`Esc` closes it) |
| | `p`, `x`, `c`, `z` | Pin, mark done, copy link, undo |
| Activity pages | `[` `]` | Previous or next activity |
| | `Ctrl+Enter` | Submit the form |
| My courses | `j` `k`, `Enter`, `f`, `s`, `Shift+H` | Move, open, filter, star, hide |
| Notifications, Grades | `j` `k`, `Enter`, `1` `2` | Move, open, tabs (Notifications: `m` marks read, `Shift+M` all) |
| Login | `1`-`4`, `Enter`, `M` | Pick a provider, follow the last used one, more options |
| Quiz attempt | only `Ctrl+Enter` and `Alt+Shift+O` | Everything else is suspended so keys never touch an answer |

## Turning KEX off

- **This page, right now:** `Alt+Shift+O` (press again to bring KEX back), or the **KEX on this page** switch in the sidebar
  Settings popover. A small pill at the bottom of the page offers the way back and "Always for this page type".
- **One page type for good:** Options > Page types: set a page type to Off (plain Moodle) or Skin (Moodle restyled, no app view).
- **Everything:** the master switch in the toolbar popup, or Options.
- **A link that opens plain Moodle:** add `&kex=off` to any Moodle URL.
- If KEX ever fails while a page loads it steps aside by itself and shows Moodle with a small "KEX hit an error" pill; if
  its script does not run at all, Moodle is revealed after 4 seconds.

## Development

```sh
npm ci
npm run build:dev        # dist/firefox-dev with debug hooks
npm run watch            # rebuild on change
npm test                 # unit tests (vitest + happy-dom)
npm run test:e2e         # Playwright (Chromium) specs on demand, against the lab Moodle on http://localhost:8080
npm run test:ff          # quick real-Firefox smoke through Selenium (http://localhost:4444)
npm run test:ff:full     # every smoke group, before a release
npm run shots            # a light and dark screenshot of every route into artifacts/pages/
npm run lint             # eslint, tsc and web-ext lint
npm run pack             # dist/packages/kex.xpi
```

The design is documented in `docs/` (`design-spec.md`, `page-designs.md`, `architecture.md`, `implementation-plan.md`,
`decisions.md`). The lab Moodle (Docker, Moodle 5.3) and its seed scripts are in `tools/lab/`.

KEX is an unofficial student project and is not affiliated with TalTech or Moodle.
