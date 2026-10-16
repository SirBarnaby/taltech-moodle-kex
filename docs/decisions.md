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

## M3: Workspace, pins, Pinned page, My courses

### Routing and chrome
- `/my/` renders the Workspace; `/my/#pinned` swaps in the Pinned view (the hash lives in the `hash` signal, fed by `hashchange`).
  `go()` handles "same page, hash dropped" (`/my/#pinned` to `/my/`) with `pushState` instead of a reload; the sidebar links use it.
- `/my/courses.php` is an app route. The lab redirects it to `/my/` unless `enablemycourses` is set; `tools/lab/m3_seed.php` sets it.
- The sidebar's Workspace item shows the unread count as a mono pill (a small magenta badge on the rail); the avatar gets a magenta dot
  when notifications or messages are unread. Counts come from `message_popup_get_unread_popup_notification_count` and
  `core_message_get_unread_conversations_count`, refreshed on mount and every 2 minutes while visible; marking read is optimistic.
- Band (PageChrome) crosshair sits at 55% so it never hides behind the right-aligned buttons.

### Workspace
- Feed order (Everything): overdue, due within 7 days, Continue (up to 3 content materials), unread updates, due in 8 to 14 days. Deadlines:
  all, overdue first. Updates: unread first. The selection follows the first row until the user selects one; a tab change resets it.
- Rows: Deadline (date tile), Continue (kind thumb), Update (glyph tile). Done appears only when the manual-completion state of the cm is
  already known (cached by a course visit). "Submit" is shown for `assign` events whose `action.actionable` is true, else "Open".
  Quiz deadlines say "Closes".
- Overdue wording is "overdue, 2 days ago" (the relative formatter has no bare duration).
- Loading shows 3 skeleton rows only when nothing is cached (no skeleton under cached content, to avoid a flash on every visit).
- The week number is `floor((now - earliest started course startdate) / 7 d) + 1`; no started course means no week in the label.

### Pins
- One global ordered list (max 50) in `kex:v1:{host}:{userId}:pins`. The PINNED row shows the current course first. Edit mode (`e` or the
  Edit button) reorders inside the displayed order (`Alt+Left/Right`, Alt+Up/Down on the Pinned page, or drag by the grip), renames
  (F2, inline) and removes. Every change sets a one-level Undo (`z`, 5.5 s).
- The Pinned page groups pins by course in order of first pin; a drag moves a pin onto another pin of its list with one Undo.
- Unavailable pins: after the hourly idle prefetch, a pin whose cm is no longer in the cached state of its course is shown struck
  through with `UNAVAILABLE` and cannot be opened.
- Export downloads `kex-pins.json`; import merges new cmids (URLs must start with the Moodle origin; invalid entries are dropped and
  counted). The options page does the same per stored `host:user` pins key.

### My courses
- Tabs use the timeline classification (`future`, `past`, `favourites`, `hidden`, `all`); Current mirrors the site grouping: customfield
  `-1` when the TalTech `is_archived` field was seen on a /my page, else `inprogress`. Archived appears only with that field.
- Star calls `core_course_set_favourite_courses`; hide writes `block_myoverview_hidden_course_<id>` with `core_user_update_user_preferences`
  (args are `{type, value}`; `null` unhides). Both are optimistic and refresh the lists afterwards; hide has Undo.
- Last access comes from `core_course_get_recent_courses`; courses without an `http(s)` course image get a gradient tile with the code
  (the lab returns `data:` images, which are never stored or shown).

### Palette
- After the sidebar list is known, an idle prefetch fetches `get_state` for every sidebar course in one batched POST (hourly) and the
  palette indexes topics and materials from the cached states. "Other courses" runs `core_course_search_courses` after 250 ms and 3
  characters; a final row searches Moodle (`/course/search.php`). `Alt+P` pins the highlighted material.
- `prefetchStates` bumps `statesVersion` with `peek()`: writing a signal it also reads inside the mount effect threw "Cycle detected".

### Lab and tests
- `tools/lab/m3_seed.php` (idempotent) adds due dates, a submitted/graded set, a quiz, forum posts, notifications, a conversation, events,
  an "Õiguse alused" page in MMO5770 and "Kubernetes at the edge" in EMT0140. Lab 5 stays a draft (a realistic "not submitted yet").
  `tools/lab/m3_reset.php` makes every notification unread again; the updates spec runs it before and after.
- `test/e2e-chromium/workspace.spec.ts` covers every M3 acceptance item; `test/unit/workspace.test.ts` the pure parts.

## M4

### Skin chrome and how pages are decorated
- Skin routes `activity`, `grade-user` and `generic` get a `SkinChrome` band injected before `#page-content`; `#page-header` is hidden. The page
  is read once by `parseSkinPage` (title, kicker, completion, dates, manual-completion button, resource target, error). The DOM is mutated only
  by `decorateSkinPage` (wraps status texts into "pills", clones the book TOC, marks `.kex-bookgrid`); everything else is CSS under
  `:root[data-kex="skin"]`. Moodle's forms, JS and links are never rebuilt.
- Dates in the info card are shortened by `shortDate` (English and Estonian, 12 h -> 24 h). Unknown strings are left alone.
- Prev/next bar and `[` / `]` use the course state order (`data/neighbours.ts`), including `format_tiles` sections; hidden and stealth cms are skipped.
- URL activities show a card with the target host and "Open" (the redirect page is never auto-followed); file resources get a full-height viewer
  with Download; embed/new-window resources fall back to the card.

### Quiz focus mode
- `quiz-focus` (attempt.php, summary.php) sets `data-kex-focus="true"`: the shell is hidden and key bindings are suspended (only Ctrl+Enter submit
  and Alt+Shift+O stay). The navigation block is Moodle's own `#mod_quiz_navblock`; it lives in the blocks drawer, which Moodle clips when
  closed (`clip-path`), so the drawer is forced open as a fixed right rail in focus mode and an absolute rail on review. The rail scrolls with the
  page on review (Moodle's review layout has no fixed region).
- The timer is a fixed pill (`#quiz-timer-wrapper`); `#quiz-timer` loses its border (it produced a red double frame).

### Forms
- Moodle forms are restyled only (`skin/forms.css`): 40 px controls, 2 px focus ring, mono caps labels for `fitemtitle`, filemanager and TinyMCE
  frames. TinyMCE's interior stays light in dark mode (its iframe content is Moodle's; inverting it would change what the student submits).
- `Ctrl+Enter` submits the main `form.mform` on activity pages (also from inside the TinyMCE iframe, which has its own document, via
  `attachEditorFrameKeys`). It is active only on activity pages.

### Errors and generic fallback
- `parseError` detects `.errorbox`, `#notice`, maintenance and "Error" headings; the error code comes from the docs link (`/error/moodle/<code>`).
  The band shows `ERROR / CODE` with Back, Workspace and Moodle's Continue. The generic fallback is the skin baseline plus the band, labelled by area.

### Tests and checks
- `test/e2e-chromium/activities.spec.ts`: the native flows (resource, url, page, assign upload + save, quiz start/answer/submit/review, forum reply),
  Moodle console errors compared with KEX off, `Alt+Shift+O` on the quiz attempt, axe in both themes.
- Axe is judged as "violations present with KEX on that are not present in plain Moodle on the same URL", so Moodle's own markup issues are not
  charged to KEX. Fixes made for it: `mono` instead of `mono-soft` for small labels (4.36 -> 7+), pills mixed with `color-mix` against the surface,
  `code` colour in dark, and the Moodle 5.3 React secondary nav (`mds-nav-pill`) which kept its light fills in dark.
- `tools/lab/m4_seed.php` adds the book, folder, choice, resources, a quiz and forum posts; `tools/lab/m4_reset.php` resets the submission, the quiz
  attempts and the e2e forum posts.
- Selector coverage: `test/unit/skinpage.test.ts` runs the parsers over the capture pages (4.5 / BS4) and over lab-shaped markup (5.3 / BS5).

## M5

### Login
- The login page is a guest page: `boot()` resolves it before the shell (no sidebar, no user), mounts `LoginView` into `#kex-root` and sets
  `data-kex-view="login"`. `scrapeLogin` reads the identity providers (`.potentialidplist .potentialidp a`, `.login-identityproviders a`), Moodle's own
  `form#login` (moved, never cloned, so `logintoken` and the show-password toggle keep working; put back on unmount), the language menu, the FAQ sheet
  and the error alert (`#loginerrormessage`, `.alert-danger`).
- Stock Moodle 5 has no providers: the form is shown directly. TalTech has four: the form hides behind "More sign-in options" (`M`).
  The primary button is the last used provider (`localStorage kex.lastIdp`, saved on click or on `1`-`4`/Enter), else Uni-ID, else the first.
  `Enter` outside a control follows it. A logged-in visitor sees one "Continue" button.
- The login page is dark in both themes (the design has no light variant: the panel uses the sidebar gradient), so its light and dark screenshots
  are the same by design. The cookie notice (`.eupopup-container`) becomes a dark toast.
- Moodle 5's `.toggle-sensitive-btn` sits inside the password field (absolute at the right edge) instead of below it.

### Grades overview
- App view over the scraped `#overview-grade` rows (`scrapeGradeOverview`): the course id comes from the link's `id=`, the code from the trailing
  `(CODE)`; names come from the sidebar list (short names) when the course is known. Current = sidebar courses, All = every row (URL hash `#all`).
  Current falls back to every row only while the sidebar list is still empty. Rows 56 px, grade in JetBrains Mono 600 20 px (an ungraded course
  shows an en dash), keys `j`/`k`/arrows, `Enter` opens the user report, `Ctrl+Enter`/`o` a new tab, `1`/`2` the tabs.
- The band label is `GRADES / <SEASON> <YEAR>` like My courses (page-designs says `AUTUMN 2026`).

### Notifications
- App view with the two-column layout of page-designs §10 (list 380 px, detail on the right; stacked below 1000 px). Data is the cached first page
  of 20 (`notifsStore`) plus "Load older" (`message_popup_get_popup_notifications` with `offset`), kept in `moreNotifs`; the paged list is reset when the page opens.
- Selecting a row never marks it read (reading a long message should not change counts by itself); `m` marks the selected one, `Shift+M` all,
  `Enter` opens the target and marks it read. `markRead`/`markAllRead` update `countsStore`, so the sidebar badge, the avatar dot and the band
  (`NOTIFICATIONS / 12 UNREAD`) move without a reload; failures roll back and toast.
- The detail article is `fullmessagehtml` through `sanitizeHtml`. "Mark unread" does not exist (Moodle has no API), as the design says.

### Skin+ areas
- `skin/pages.css` styles the Moodle markup in place (4.5 and 5.x selectors): grade user report (`table.user-grade`: tinted category rows, 44 px items,
  mono right-aligned numbers, bold total with a 2 px top border), calendar (month grid, today circle, event pills by type, day and upcoming rows),
  messages, profile (2-column cards at >= 1280), preferences (rows with a chevron), participants, badges (180 px cards), catalogue and search (rows).
- Band titles: a course-scoped report shows the course's short name; pages Moodle titles with the user's own name (preferences, badges, files)
  show the area; search shows `SEARCH / "query"`. Titles over 44 characters step down to 30 px instead of being clipped.
- The calendar view switch becomes our tabs in the chrome. A click presses Moodle's own dropdown item (`data-view`), so the AJAX view change, the
  event popovers and "New event" stay Moodle's; the original dropdown is hidden with CSS.
- Two small DOM decorations (idempotent, class/text only): participants columns are found by Moodle's `data-column` (not by header text, so the
  Estonian capture works) and roles become pills; the trailing `(CODE)` of a course box moves in front as a mono code.
- Bug found on the way: the skin's `.btn { display: inline-flex }` beat Moodle's `.hidden`, so hidden buttons (message "Retry") showed. `.btn.hidden`,
  `.btn[hidden]` and `.btn.d-none` now keep `display: none`.
- Messages keep Moodle's JS app; only bubbles, list rows and the composer are restyled. The drawer variant of the message app is not part of the page (no navbar).

### Tests and tooling
- `test/e2e-chromium/pages.spec.ts`: login on the lab (sign-in through our view, wrong password), login on the TalTech capture (via `page.route`: four
  providers, form behind `M`, Enter follows Uni-ID / last used, `1`-`4`), grades overview, notifications (badge in step without reload, `j`, `m`, `Shift+M`,
  `Enter`), nine skin+ pages in both themes with structural checks, the participants capture, and axe in both themes.
- `npm run test:visual -- --all` (`scripts/test-visual.mjs`) writes a light and a dark Chromium screenshot for every route of the architecture §6 table
  to `artifacts/pages/`; it also checks the `data-kex` mode of each route. Plain `npm run test:visual` still runs the geometry specs.
- `tools/lab/m5_seed.php` awards two site badges (it generates the badge images with GD).
- `test/unit/pages.test.ts` includes a selector report: every capture resolves to a route and a skin route yields a band title.

## M5 verification and visual review

- **Login wordmark.** The login panel always draws our own TAL TECH | moodle wordmark (inline, 900 weight, same proportions as the sidebar). Moodle's `<img>` logo is no
  longer used: on the lab it 404s and on the real site we cannot rely on it. The empty dark strip under the brand was the cookie toast container (`.eupopup-container`)
  with no content; it is hidden while empty, and the toast, when present, floats bottom-right.
- **Date tiles.** Deadline tiles are `DateTile` (mono month over a 40 px day, then a weekday or `OVERDUE` line). Overdue is carried by colour and the word, never by colour alone.
- **Screenshot review** (every route, light and dark, against iteration3): fixed the quiz summary and choice controls (drawn radios and checkboxes with a visible dark border,
  flag toggle inverted properly), the quiz summary buttons, the forum discussion list columns, calendar pills (grid `minmax(0,1fr)` so long titles ellipsize), grade chevrons,
  the dark message bubble, icon-only `.btn`s, the file manager, the empty activity header, the 15 px content offset next to the nav block, and a single global focus ring.
- `scripts/test-visual.mjs` now waits for the React secondary nav (Moodle 5.x mounts it late), otherwise it screenshots an empty nav.
- Web-ext lint: 0 errors, 3 warnings. All three are Preact's own `innerHTML` assignment in the bundled library (`dangerouslySetInnerHTML` support and `_hydrate`);
  our code uses `replaceChildren`. Justified, not suppressible without patching the library.

## M6

### No flash
- `src/content/probe.ts` (debug builds only) samples the first frames and writes `sessionStorage['kex.firstFrame']`: body visibility at the first frame, whether Moodle's navbar was
  ever visible, and the number of frames until the shell settled. `smoke.mjs --only m6` asserts, on 11 routes in real Firefox, that the navbar is never seen and that the first
  frame is either hidden or already KEX. Pass.
- `?kex=off` was referenced by the course view's "Open in plain Moodle" link but not implemented. It now settles the page to the off mode with the pill; `turnOn()` clears the
  one-shot so the pill's "Turn KEX on" works afterwards.

### Reduced motion
- The `prefers-reduced-motion` and `data-kex-motion="reduced"` rules had not covered pseudo-elements (`:where()` cannot contain them), the skin pages or the off pill. They now list
  `*`, `*::before`, `*::after` explicitly for `#kex-root`, `:root[data-kex="skin"]` and `.kex-offpill`. Skin `[class*="kex-"]` animations run once. Verified on five pages: no running
  animation or transition longer than 1 ms, the shader static.

### Forced colors
- Checked in Chromium with `forcedColors: 'active'` (workspace, course, forum, grades, notifications, login); screenshots in `artifacts/m6/forced-colors-*.png`. Text and the sidebar
  stay readable and focus uses `Highlight`. Fix: `.kex-btn` had no border (a filled button is only a coloured box and vanished into the page); it now gets a 1 px (2 px for
  filled) `ButtonText` border in forced colors. Remaining cosmetic: the sidebar's decorative icons render in GrayText, and text over the hero art sits on Canvas backplates (the browser's choice).

### Performance
- **Shader compile is asynchronous.** `RibbonsRenderer` compiles and links without reading the status, polls `COMPLETION_STATUS_KHR` when `KHR_parallel_shader_compile` exists (Firefox, Chrome on a
  GPU) and otherwise links from `requestIdleCallback`. The hero shows its CSS fallback (`data-fx="fallback"`) until the program is ready, then `onReady` re-evaluates the mode. The offscreen
  video-thumbnail renderer awaits `ready()` (before this it would have cached a blank image) and renders one thumbnail per task.
- **What the test measures.** `m6.spec.ts` records `longtask` entries with KEX on and with a plain Moodle tab. SwiftShader (software GL, no parallel compile) spends 0.2-2 s linking and
  running the shader the first time; a debug build records those spans (`window.__kexShaderCompileMs`) and the test subtracts them, because they are the driver and not our code.
  The gate is relative: no task over 400 ms and less than 600 ms of long-task time beyond plain Moodle (Moodle's own cron shares the CPU in the lab, which makes 50 ms thresholds flaky).
  Shader frame cost on SwiftShader at 1585x992 is under 5 ms per frame. That is an upper bound for a GPU; real numbers need real hardware.
- **Bundle size.** The production build now minifies whitespace and syntax (not identifiers, so the code stays reviewable by AMO): `content.js` 353 KB (109 KB gzip), `kex.css` 148 KiB
  (26 KB gzip), options 74 KB, popup 62 KB. The architecture budget of 300 KB was written for unminified `content.js`, which is about 500 KB; it was exceeded by the app views (Course,
  Workspace, Grades, Notifications, Login), the Moodle skin DOM code and Preact. Accepted: it is parsed once per page from the extension package, not downloaded.
- Console-parity test (`activities.spec.ts`) filters the "Page unloaded." and "Failed to fetch" messages that a navigation mid-request produces, waits 1.5 s, and has a 120 s timeout.

### Packaging, coexistence
- `npm run pack` makes `dist/packages/kex.xpi` (production build). `npm run sign` needs the owner's own AMO keys (`WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET`) and cannot be run in the lab; the README
  documents the unlisted-signing path.
- Moodle Buddy coexistence was not tested: addons.mozilla.org is unreachable from the lab. Our content script touches only its own `data-kex` attribute, `#kex-root` and class names
  prefixed `kex-` (and, in skin mode, a few classes on Moodle nodes), which is the part to check on a real profile with both add-ons installed.
