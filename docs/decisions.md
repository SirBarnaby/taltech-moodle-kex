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

## M2: course page

### Fonts and type (measured against iteration3)
- The mock's UI text is narrower than Inter: `--kex-font-ui` is now Inter Tight Variable (sidebar and header included), and
  `--kex-font-hero` is Inter Variable. The hero title is Inter 300 at -0.02em; the design-spec's "Inter Tight -0.035em" made
  the title 10% narrower than the mock.
- "Learning materials" is 510/-0.0205em and the topic title 520/-0.029em (Inter Tight). Heavier weights with tighter tracking
  matched the width but not the ink: pixel counts were 25-35% above the mock.
- Tabs are 16px, the active one 17px/600 (this is what puts the underline at x=1276, w=98).

### Names and order
- English short names ship as the default aliases of the six TalTech courses (ITI8801 "Cloud & DevOps", EMT0140 "IoT for
  Industry", IAS0230 "Embedded Systems", MMO5770 "Management & Leadership", ITB8833 "Digital State ICT", IEE2630 "Smart
  Networks") in the mock's order. A rename (F2) overrides them.

### Hero ribbons shader
- design-spec §9's starting point (layered sines) could not get near the mock. The shader is built from four traced key curves
  (arch A, arch B with its lower sweep, pink rim C/E, pink rim P) in a 1339x253 reference frame, translucent fills between them
  and hairline strands, plus the uniform `uWin` (the part of the frame a canvas shows; `x0 > x1` mirrors it).
- The constants (`K_*`, `Q_*`) are fitted with `scripts/fit-ribbons.mjs` (coordinate search on a blurred L1 loss, 4 sweeps:
  26.7 -> 22.5). Strand strength was then raised by hand because a blurred loss pushes it to zero.
- Clock `uTime * .07`; `debug.freezeTime` = 7.3 gives the static frame used by the visual diff and the fallback image
  (`scripts/render-fallback.mjs` -> `assets/hero-fallback.webp`).
- Video thumbnails use the same shader on a mirrored window of the hero's right edge (flat purple before: an offscreen canvas has
  `clientWidth` 0, so the renderer resized it to 1x1; offscreen canvases now keep their size).
- Each canvas carries `data-fx="running|paused|static|fallback"`; the e2e tests read it (shader stops offscreen and on
  `visibilitychange`, static under reduced motion, fallback for effects off and for a lost context).

### Data
- `core_courseformat_get_state` is the source of sections and cms; details of a cm (icon type, dates, completion toggle) come from
  `core_course_get_module` HTML, fetched for the selected topic first, then its neighbours, then the rest when idle. The server
  state wins over a cached completion toggle on every load.
- Previews of `resource` modules probe the module URL with `redirect=1` (`ws.probe`) to learn the file type; pages and URLs use the
  rendered HTML. PDFs open in an iframe, images and video natively, other files as a link card.
- Assignment due text from Moodle's long date ("Due: Thursday, 10 September 2026, 5:38 PM") is shortened to "Due Thu 10 Sep".
- When `get_state` fails and nothing is cached, the page switches to the skin ("Moodle layout in KEX") with a toast.
- The weeks format shows "Week N" for default date-range titles; tiles format rows get the tile photo as the topic thumbnail
  (unit-tested; the lab course is weeks format with real titles, so neither is exercised live).

### Known deviations from the mock (kept on purpose)
- The seeded "Kubernetes slides" pin makes row 1 say "Unpin" where the mock says "Pin" (it is pinned; the mock is not consistent).
- Row 3 (recording) shows the Preview/Pin line, the mock omits it for recordings.
- The mock's "&" in the hero title is a wider glyph than Inter's; line 2 is 3% narrower.
- The mock's pinned cells have unequal widths; ours grow evenly from their content (close, not identical).

### Tests
- `test/e2e-chromium/course.spec.ts` (topic switch <= 16 ms measured from the `kex:topic-switch` mark to the DOM update, hash and
  history, tabs, dimming via a trimmed state response, preview, `x` with reload, slide-up, axe, thumbs),
  `hero-shader.spec.ts` (needs software WebGL, so it has its own `launchOptions`; the other specs run without a GPU),
  `test/visual/iter3-geometry.spec.ts`, and `node scripts/visual-diff.mjs` (pixelmatch, writes `artifacts/visual/iter3/`).
- Firefox smoke gained `m2` (course page: title read once, topic, `k`, tabs, preview, canvas); `node scripts/firefox-shot.mjs`
  writes a real-Firefox screenshot.
- The short-window trick (`setViewportSize` 500 high) is needed to scroll the course page in tests: it is shorter than the window.
- The course view only focuses the active topic row on load when nothing else has focus (otherwise it stole focus from the palette).
