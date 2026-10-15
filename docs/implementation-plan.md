# Implementation plan

Rules for the implementer:
- Do milestones in order. Each ends with all acceptance criteria green and a commit.
- **Never modify** `captures/`, `ai_generated_enhanced_drafts/`, `how_the_website_looks_like_now/`, or `tools/capture/`.
- Lab: `http://localhost:8080`; student `student` / `Student#2026`; admin `admin` / `LabAdmin#2026`. The lab is Moodle 5.3 (BS5); TalTech is 4.5 (BS4). Every selector must pass both the captures and the lab.
- Playwright: devDependency `playwright@1.56.1` (exact). Env already has `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
- Selenium Firefox 158: `http://localhost:4444` (container `ff`, host network, so it can reach `localhost:8080`).

## M0: Scaffolding, build, dev manifest, test harness

**Tasks**
1. Create `package.json` (type module) with:
   - deps: `preact`, `@preact/signals`, `lucide-preact`, `@fontsource-variable/inter`, `@fontsource-variable/inter-tight`, `@fontsource-variable/jetbrains-mono`;
   - devDeps: `esbuild@0.28`, `typescript`, `web-ext@10.8`, `vitest`, `happy-dom`, `playwright@1.56.1`, `selenium-webdriver`, `pngjs`, `pixelmatch`, `eslint`.
2. Add `tsconfig.json` (strict, `jsxImportSource: preact`, `lib: dom, es2023`).
3. Write `scripts/build.mjs`:
   - bundle content, background, popup and options per architecture §19;
   - bundle `src/styles/index.css` into `kex.css`;
   - copy the 6 woff2 files into `fonts/`;
   - copy `assets/`;
   - write `manifest.json` from `manifest/base.json` (+ `dev.json` overlay for `--dev`);
   - support `--mv3-probe`, which writes an MV3 variant into `dist/firefox-mv3-probe/`.
4. Minimal `content.js`: the boot gate (architecture §5) plus `#kex-root` with a "KEX" placeholder header; data-kex modes; fail-open timer; off-pill; pageinfo; `ws.ts` with batching via `content.fetch`.
5. Test harness:
   - `test/shim/browser-shim.js`: `browser.storage.local` (in-memory, seedable via `window.__KEX_SEED__`), `runtime.getURL` → `https://kex.ext/…`, `runtime.sendMessage` no-op.
   - `test/e2e-chromium/fixtures.ts`:
     - logs in as student (form POST);
     - registers `page.route('https://kex.ext/**')` to serve `dist/firefox-dev/*`;
     - adds init scripts (shim, content.js);
     - injects `kex.css` text as early as possible.
   - `test/e2e-firefox/smoke.mjs`:
     - `npm run pack:dev` (zip `dist/firefox-dev`);
     - builds a Selenium `firefox.Driver` against `http://localhost:4444`;
     - `installAddon(xpiPath, true)`;
     - logs into the lab and runs the assertions below.
6. Unit fixture loader: `test/fixtures/load.ts` reads `captures/pages/*.html` into happy-dom.
7. Write `docs/decisions.md` with the M0 matrix results.

**Acceptance**
- [ ] `npm run build`, `npm run build:dev`, and `npm run lint` pass (`web-ext lint` shows 0 errors).
- [ ] The Firefox smoke test passes all of these:
  - (a) `document.documentElement.dataset.kex` is set on `/my/`;
  - (b) `ws.call('core_course_get_enrolled_courses_by_timeline_classification', …)` returns 6 courses via `content.fetch`;
  - (c) `document.fonts.check('16px "Inter Variable"')` is true after `document.fonts.ready`, with fonts loaded from extension CSS relative URLs. If false, implement the runtime `<style>` fallback (architecture §17) and re-run;
  - (d) the MV2 vs MV3-probe matrix is recorded. Keep MV2 unless MV3 passes (a)–(c) without interaction.
- [ ] Fail-open works:
  - a forced exception (`?kex-test-throw=shell`, debug builds only) leaves Moodle visible with the error pill;
  - disabling JS injection (CSS only) reveals Moodle within ≤ 4.2 s.
- [ ] Unit tests: `pageinfo` parses `M.cfg` from all 8 captures (`userId=333286`, sesskey `REDACTED`).

## M1: Shell (sidebar, compressing header, breadcrumb, palette, theme, settings)

**Tasks**
- `tokens.css`, `base.css`, `fonts.css`.
- `names.ts` with unit tests: all 6 TalTech fullnames from `my_courses.html` plus the 6 lab names produce correct `code`, `semester` and `name`. Example: "MMO5770 MMO5500 Management and Leadership (2026 sügis)" → code MMO5770, name "Management & Leadership".
- `repo/courses.ts`:
  - reads the myoverview prefs (`core_user_get_user_preferences`) and the custom field name (scraped from `/my/` or `/my/courses.php` when present; cached);
  - calls the timeline classification;
  - falls back to `inprogress`;
  - applies `courseOrder` and aliases.
- Sidebar (design-spec §4.1), including the active course from `pageInfo.courseId`, F2 alias rename, the rail and drawer breakpoints, and `Ctrl+B`.
- Header (§4.2):
  - breadcrumb from `pageInfo`;
  - search trigger;
  - theme toggle (`t`);
  - compression (§8.2) with the fixed header and spacer;
  - the compact-title slot (filled in M2).
- Palette (architecture §12) with courses, pages, actions and pins (topics and materials are added in M2 once states exist); fuzzy unit tests.
- Keyboard manager plus the help overlay (`?`).
- Quick settings popover (sidebar Settings): theme, shader switch (stored now, used in M2), motion, "KEX on this page".
- User menu (scraped `#user-action-menu`).
- Session-expired banner.
- Off-pill and `Alt+Shift+O`.
- Popup and options pages (settings only; pins in M3).
- Skin baseline CSS (page-designs §0) so every non-app page already sits inside the shell.

**Acceptance**
- [ ] Chromium e2e: on `/my/`, `/course/view.php?id=2`, `/mod/forum/view.php?id=33` and `/user/profile.php`:
  - the sidebar lists the 6 lab courses with codes;
  - the active course is highlighted on course pages;
  - the header breadcrumb is correct;
  - Moodle's navbar is not visible.
- [ ] Header: at `scrollY=0` its height is 67±1; after scrolling 300px it is 52±1; the document's scrollHeight does not change between states.
- [ ] Palette: `Ctrl+K` opens it with focus in the input; "iti" puts ITI8801 first; Enter navigates; Esc restores focus.
- [ ] Theme: `t` flips `data-kex-theme`; a reload keeps it with no light flash (the boot mirror is read before body).
- [ ] Firefox smoke: the same checks on the real extension; Ctrl+K is not stolen by the browser.
- [ ] axe-core run (Playwright `@axe-core/playwright`) on the shell has 0 serious or critical violations.

## M2: Course page, literal to iteration3 (shader hero, slide-up text)

**Tasks**
- `repo/coursestate.ts` (get_state + normalization).
- `repo/cmdetails.ts` (batched get_module + `scrape/cm.ts`; section.php fallback).
- `classify.ts` with at least 60 table tests (happy-path §6), including Estonian names and the 3 iteration3 rows.
- Components: Hero, Crosshair, MonoLabel, PinnedRow (read-only from seeded pins), Tabs, TopicList, ResourceRow, Thumb (all variants), Button, PreviewSheet (PDF iframe, page article, URL card), SlideUpText (architecture §15, unit-test the splitting).
- Actions: setTopic and setTab (URL hash), toggleDone (optimistic + Undo), togglePin (writes pins; full pin management in M3), openCm.
- Shader: `Ribbons.ts`, `EffectsController.ts`, the static/frozen modes. `scripts/render-fallback.mjs` renders `assets/hero-fallback.webp` (1920×360, frozen t=7.3) with Playwright.
- Tiles: `scrape/tiles.ts` (unit test on `course_view__id-37582.html`: 11 tiles, section ids 153220…, photo URLs) and `/38420`.
- Topics-format parse test on `course_view__id-37829.html` (section 0 "House Rules", the cms list).
- **Lab fixture `tools/lab/iter3_fixture.php`** (idempotent; run with `docker cp` + `docker exec moodle-lab-moodle-1 php /tmp/iter3_fixture.php`). In ITI8801:
  - section 6 "Kubernetes" gets exactly 3 visible cms, with completion off and other cms hidden:
    - resource "Kubernetes — lecture slides" (PDF);
    - resource "Practice 6: Deploy a service" (PDF);
    - url "Week 6: Lecture recording";
  - sections 7–8 are hidden;
  - section 6 is set as the highlighted/current section.
- **Visual diff `scripts/visual-diff.mjs`:**
  - Chromium, viewport 1585×992, DPR 1, light theme, `debug.freezeTime=7.3`, effects animated-frozen.
  - Seeded settings: aliases ITI8801 "Cloud & DevOps", EMT0140 "IoT for Industry", IAS0230 "Embedded Systems", MMO5770 "Management & Leadership", ITB8833 "Digital State ICT", IEE2630 "Smart Networks"; order as in the mock.
  - Pins: "Kubernetes slides"/ITI8801, "ARM Cortex-M"/IAS0230, "IoT project brief"/EMT0140 (real lab cmids).
  - Open `/course/view.php?id=2#topic-6`, wait for `document.fonts.ready`, data idle, and animations finished (`data-kex-anim="done"`).
  - Screenshot to `artifacts/visual/iter3/render.png`.
  - With pngjs + pixelmatch, write:
    - `side-by-side.png` (3170×992: mock | render);
    - `overlay.png` (50/50 blend);
    - `diff.png`;
    - `report.json` (per-region mismatch %, design-spec §10).
  - Also run `test/visual/iter3-geometry.spec.ts` (DOM boxes via `data-kex-test` ids).
  - Iterate CSS until thresholds pass. Attach `side-by-side.png` to the milestone summary.

**Acceptance**
- [ ] Geometry spec passes (design-spec §10 table).
- [ ] Pixel regions meet the thresholds (ribbons region informational).
- [ ] Topic switching with `j`/`k` updates the detail in ≤ 16 ms from cache (performance mark). The URL hash is updated. Back/forward restore the topic.
- [ ] Tabs `1`/`2`/`3` filter correctly on the lab course; dimmed topics show when a filter has no match.
- [ ] Preview (`Space`) opens a PDF in an iframe; `j`/`k` move; Esc returns focus to the row.
- [ ] `x` toggles completion on a manual-completion cm. Verified by reloading: the state comes from the server.
- [ ] Shader:
  - it stops when the hero is offscreen and on `visibilitychange`;
  - reduced motion renders one static frame;
  - effects off shows the fallback image;
  - context loss falls back without errors.
- [ ] Slide-up: the hero animates words, the topic title animates characters, and nothing animates with reduced motion. Screen readers get the full text once (axe + a manual check of the accessibility tree).
- [ ] Tiles-format rendering (unit or snapshot via the captures): topic rows include thumbnails.

## M3: Workspace, pins, Pinned page, My courses

**Tasks**
- Repos: events, recent, notifs, counts.
- Workspace view (page-designs §2).
- `repo/pins.ts`: CRUD, order, rename, cross-tab sync, max 50, unavailable detection.
- PINNED row edit mode.
- Pinned page (`/my/#pinned`).
- My courses (§4): tabs, filter, star, hide with Undo.
- Palette: add topics and materials from the cached states of all sidebar courses (idle prefetch, architecture §8.6); add "Other courses" via search.
- Options page: pins export/import, clear data.

**Acceptance**
- [ ] Workspace on the lab shows overdue and due rows from seeded assignments, sorted (overdue first). Hash tabs work. `Enter` on a deadline row opens the `action.url` submission form.
- [ ] Pins: `p` on a course row → appears on the Workspace PINNED row; persists across reload; syncs to a second tab within 1 s; Edit mode reorders with `Alt+←/→`; Undo (`z`) works.
- [ ] My courses: the star toggles favourite on the server (verified with a second API call); hide plus Undo works.
- [ ] Palette finds "kubernetes" materials across courses after one idle prefetch; diacritic-insensitive (an "oiguse" query matches "Õiguse").
- [ ] No sesskey in `browser.storage.local`: a test dumps all storage and greps `/sesskey|[A-Za-z0-9]{10}&/`.

## M4: Activity pages and the generic restyle fallback

**Tasks**
- ActivityChrome and PageChrome components (injected before `#page-content`; Moodle's `#page-header` hidden).
- Prev/next bar.
- Skin CSS per module (page-designs §7) in `src/styles/skin/mod-*.css`.
- Resource full-height viewer; URL card.
- Quiz focus mode with the right rail (`#mod_quiz_navblock`).
- Assignment form styling; `Ctrl+Enter` submit.
- Forum list and post cards.
- Errors (§17).
- Generic fallback (§18).
- Run the selector report on all captures and lab pages; fix misses.

**Acceptance**
- [ ] Chromium e2e on the lab:
  - resource, url, page, assign (view + editsubmission: upload a small file and save), quiz (view → start attempt → answer → submit → review) and forum (view, discuss, post a reply) all complete their native flows with KEX on.
  - No console errors from KEX; Moodle's JS errors are unchanged versus KEX off (compare console logs between both runs).
- [ ] Every skin page passes axe with 0 serious/critical violations attributable to KEX CSS (contrast included), in both themes.
- [ ] `Alt+Shift+O` on the quiz attempt shows the pure Moodle page; pressing it again restores KEX.

## M5: Remaining pages

**Tasks**
- Login view (§1): verify with the lab's stock login and with `captures/pages/login_index.html` served statically via `page.route` for the TalTech markup.
- Grades overview (app) and user report (skin+).
- Notifications (app).
- Calendar, messages, profile, preferences, participants (`captures/pages/user_index__id-37582.html`), badges, catalogue, search: all skin+.

**Acceptance**
- [ ] Login: Enter submits/follows the last-used IdP; on the lab, username/password login works through our view.
- [ ] Notifications: mark read and mark all read update the counts in the sidebar badge without a reload.
- [ ] Every route in the architecture §6 table has a Chromium screenshot in `artifacts/pages/` in light and dark (generated by `npm run test:visual -- --all`).

## M6: Polish, a11y, performance, reduced motion, packaging

**Tasks**
- No-flash probe.
  - The debug build records `getComputedStyle(body).visibility` and whether `nav.navbar` is visible at the first rAF after body creation, into `sessionStorage.kex.firstFrame`.
  - The Firefox smoke asserts `visibility === 'hidden'` or that the KEX shell is visible, and that the Moodle navbar is never visible, for 10 page types.
- Performance pass:
  - bundle sizes within budget;
  - Playwright trace shows no KEX long tasks over 50 ms;
  - shader frame cost logged.
- Reduced motion audit. Forced-colors check. Keyboard-only walkthrough of every happy-path journey (scripted in Playwright).
- Moodle Buddy coexistence: install both in Firefox Selenium; Buddy's popup finds files on a course page with KEX on.
- `npm run pack` and `npm run sign` dry run. Write `README.md`: install, temporary load, signing, privacy.
- Final visual diff run; attach the artifacts.

**Acceptance**
- [ ] All tests green: unit, Chromium e2e, Firefox smoke, visual thresholds.
- [ ] `web-ext lint`: 0 errors, and warnings justified in `docs/decisions.md`.
- [ ] A signed `.xpi` installs in Firefox release (manual, by the user with their AMO keys).

## Test inventory (summary)
| Layer | Tool | Where |
|---|---|---|
| Unit and fixture | vitest + happy-dom | `test/unit/**`; fixtures from `captures/pages/*.html` |
| Fast e2e/visual | Playwright chromium + shim | `test/e2e-chromium/**`, `test/visual/**`, `scripts/visual-diff.mjs` |
| Real extension | Selenium Firefox 158, `installAddon(temporary)` | `test/e2e-firefox/**` |
| a11y | `@axe-core/playwright` | in e2e-chromium |

## Open questions for the user (defaults are already chosen; answering is optional)
1. **Sidebar course names.** Default: auto-shortened names (e.g. "Management & Leadership"), renameable with F2. Do you want an English alias set preloaded for your six courses, matching the mock ("IoT for Industry", "Smart Networks")?
2. **UI language.** Default: English labels as in iteration3, with an Estonian option in settings.
3. **Pins sync.** Default: local to this Firefox profile only, with JSON export/import. Say so if you want `storage.sync` across your devices instead.
4. **AMO signing.** Needed from you: an AMO account and API key and secret, used only on your machine (`npm run sign`).
