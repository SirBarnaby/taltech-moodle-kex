# Decisions log

Choices made while implementing, where a doc was silent, wrong when tested, or where tooling forced a different path.
Newest milestone last. Each entry says what was chosen and why.

## M0

### MV2 vs MV3-probe matrix (Firefox 158 on Selenium, lab Moodle 5.3 at `localhost:8080`)

Both variants were built from the same sources (`npm run build:probe` writes `dist/firefox-mv3-probe/`), packed
(`node scripts/pack.mjs probe`), installed with `installAddon(xpi, true)` and driven by `test/e2e-firefox/smoke.mjs`.

| Check | MV2 (`dist/firefox-dev`) | MV3 probe |
|---|---|---|
| (a) `html[data-kex]` set on `/my/` (no interaction) | pass (`skin`) | pass (`skin`) |
| (b) ws batch returns 6 courses | pass, transport `content.fetch` | 6 courses, but transport `fetch` (no `content.fetch` in MV3 content scripts) -> **fail as specified** |
| (c) `document.fonts.check('16px "Inter Variable"')` after `fonts.ready`, faces loaded from extension CSS | pass (`Inter Variable` face `loaded`) | pass |
| M1 shell checks (23 asserts: sidebar, breadcrumb, header 67->52, Ctrl+K, theme) | 23/23 | 26/27 incl. the (b) failure above |
| Host permissions without a user prompt | granted at install (permissions) | granted for the temporary install; in a release build MV3 host permissions are optional and need a user grant |

**Decision: keep MV2.** The plan says to keep MV2 unless MV3 passes (a)-(c) without interaction. MV3 fails (b) because
`content.fetch` is gone, and it adds a persistent-permission prompt. The data layer already falls back to the page `fetch`
(`src/data/ws.ts`), so a later MV3 move is a manifest-only change; the probe build stays in `scripts/build.mjs` to re-check.

Commands: `node test/e2e-firefox/smoke.mjs --variant dev` and `node test/e2e-firefox/smoke.mjs --variant probe`.

### Fonts: extension CSS relative URLs work, no runtime `<style>` fallback needed
`kex.css` references `fonts/*.woff2` relatively; Firefox resolves them against the `moz-extension://` stylesheet URL and loads
them thanks to `web_accessible_resources: ["fonts/*.woff2", "assets/*"]`. The smoke test asserts both `fonts.check(...)` and that
a `FontFace` named `Inter Variable` has status `loaded` (`fonts.check` alone is vacuously true when no face matches).
The architecture §17 fallback was therefore not implemented.

### Dev manifest uses `http://localhost/*`
Firefox match patterns ignore ports, so `http://localhost:8080` is covered by `http://localhost/*`. `manifest/dev.json` adds the
origin to `permissions` and `content_scripts[0].matches`, mirrors the `exclude_matches`, and changes the gecko id so a dev build
can sit next to a release build.

### Fail-open
- `?kex-test-throw=shell` (debug builds only, `__DEBUG__`) throws from a probe component inside the shell. The `ErrorBoundary`
  defers `failOpen` with `queueMicrotask`: unmounting from inside Preact's commit phase threw `Cannot read properties of undefined
  (reading '__k')` and left the page stuck in `skin` mode. After the fix the page ends in `data-kex="off"` with the error pill.
- CSS-only build (`node scripts/build.mjs --dev --css-only`, content script without `js`): the gate animation reveals Moodle
  4022 ms after the gate started. The 4 s delay in `gate.css` starts when `<body>` is first styled, i.e. after the server's first
  byte (the lab's Moodle has a TTFB of about 1.3 s inside the Selenium container), so the test measures from the gate start, not
  from navigation start. Measured: gate start about 1.3 s, visible at about 5.4 s after navigation start.

### Tooling
- **web-ext lint**: 0 errors, 3 warnings. All three are `UNSAFE_VAR_ASSIGNMENT` on Preact's `dangerouslySetInnerHTML` branch
  (`innerHTML` at the same line in each bundle). We never use that prop; the warning comes from the library. The Android
  min-version warning was removed with `gecko_android.strict_min_version = 142.0` (needed for `data_collection_permissions`).
- `scripts/pack.mjs <prod|dev|probe|cssonly>` builds and zips through `web-ext build` into `dist/packages/`.
- `scripts/make-icons.mjs` renders `assets/icon-{16,32,48,96}.png` from an inline SVG with Playwright's Chromium (placeholder
  mark: a "K" key cap; replace when a real brand asset exists).
- Unit tests use happy-dom with JS evaluation disabled; `M.cfg` is parsed from the inline script text with a brace matcher
  (`parseCfgFromText`), never `eval`.

## M1

### Scope boundary
- `IMPLEMENTED_VIEWS` is empty until M2+, so every route renders in `skin` mode (shell + restyled Moodle). Login and quiz-attempt
  pages stay pure Moodle (`PURE_MOODLE_UNTIL_READY = {login, quiz-focus}`).
- Not part of M1 (recorded as gaps): unread-count badge on the nav, palette "Other courses" group, topics/materials in the palette.

### Sidebar courses
- An unset `block_myoverview_user_grouping_preference` maps to `all`, not `inprogress`. Moodle's own default is `all`-like for a
  user that never changed it, and the lab's courses are mostly past their end date, so `inprogress` would have shown 2 of 6.
- The first time a course is seen its position is frozen into `settings.courseOrder` using the order the sidebar *displays*
  (not API order); later arrivals are appended.
- Course titles with a code prefix are parsed by `names.ts`: code, semester, and name (`&` replaces "and"). Aliases are the F2
  rename and win over parsed names.

### Layout
- Breakpoints: below 760px the sidebar is a drawer, below 1100px a rail, otherwise full (or rail when collapsed with `Ctrl+B`).
- Header compression uses a hysteresis (compress above 24px of scroll, expand below 8px) and a fixed header with a spacer so
  `document.scrollHeight` is unchanged (67 -> 52).
- Lucide glyphs fill about 75% of their nominal box; sizes in the CSS were tuned so the rendered glyphs match the mock's pixel
  measurements.

### Console noise
`Failed to fetch` and `ERR_ABORTED` (Moodle ESM modules) appear with and without the extension; they are Moodle's own.

### Accessibility (axe-core on `#kex-root`, light, dark, palette open: 0 serious/critical)
- Fixed `label-content-name-mismatch` by letting the sidebar brand link and the header search button take their accessible name
  from their visible text (the search button adds `aria-keyshortcuts`); an `aria-label` that does not contain the visible text fails WCAG 2.5.3.
- Palette group heads and meta labels use `--kex-mono` (#494280) instead of `--kex-mono-soft` (#7771a0, 4.4:1 on the palette
  background, 3.7:1 on the selected row).
- `@axe-core/playwright` pulled in `playwright-core@1.64`, whose `Page` type does not match `playwright@1.56.1`; `package.json`
  `overrides` pins `playwright-core` to 1.56.1.

### Tests
- Chromium e2e: `npx playwright test` (`test/e2e-chromium/shell.spec.ts`, 12 tests incl. the screenshots written to `artifacts/m1/`).
- The "no light flash" test samples the root background every animation frame from document start (init script) until
  `data-kex-shell="ready"` and requires the first sampled `data-kex-theme` to be `dark` and no frame to be light.
- Firefox: `node test/e2e-firefox/smoke.mjs` runs MV2 M0+M1 (27 asserts), fail-open and CSS-only; `--variant probe` runs the MV3 matrix.
  Key events go through Marionette actions (`Ctrl+K` reaches the page and the palette input is focused, so the browser did not take it).
- Dark theme, skin baseline: Moodle's own loading skeletons (`.bg-pulse-grey`), the forum `.activity-details` box and the
  `.btn-submit.search-icon` button hard-code light fills and are re-coloured under `[data-kex-theme=dark]`.
- Page `<mark>` styling from Bootstrap (padding) spread the palette's fuzzy highlights; reset to `padding: 0`.
