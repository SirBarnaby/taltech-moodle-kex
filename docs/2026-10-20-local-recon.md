# Moodle KEX: local recon and polish, 20 October 2026

The three epics below have since been implemented. See [the 23 October handover](2026-10-23-epics.md) for the final build, verification and live-testing boundary. This document preserves the original recon and proposal record.

## What was tested

Work was performed in `C:\Users\barna\ReverseEngineering\taltech-moodle-kex` on the existing `codex/kex-interactions` branch. The checkout already contained substantial uncommitted work. Those changes were retained; nothing was committed or published.

The browser checks ran **on this Windows PC, using installed Microsoft Edge**, against a localhost replay of the captured TalTech pages and captured `taltech4_boost` CSS. Both the development bundle and the minified production bundle were exercised. This catches the actual theme overrides and local rendering problems that the plain Boost lab missed.

This is a captured-page replay with reconstructed read-only API responses, not a connection to the current signed-in Firefox session. The source pages were captured on 15 October. SSO, current server data, submission flows, Moodle Buddy, and Firefox extension isolation still require a live Firefox pass. Missing captured routes return 404 rather than pretending to implement Moodle. The replay preserves captured deadline dates and course associations; the large-feed test explicitly synthesizes 60 events to test density.

## The eight reported issues

| Point | Finding | Change and evidence |
| --- | --- | --- |
| Login/logout composition and blurry art | Login reused a very wide hero fallback on a tall surface. The fallback renderer also omitted the palette and shape uniforms now required by the shader. | Added a dedicated 1440×1600 login fallback; rebuilt the hero fallback at 2560×480 with every uniform specified and higher image quality. Increased the canvas DPR cap to 2, softened login intensity and added a bottom scrim behind the title. Login was checked at 1440, 960 and 390 px. |
| Dossier and My courses as home | Workspace was the default post-login route, brand destination and breadcrumb home. Merely renaming its sidebar entry would leave those entry points inconsistent. | Estonian and English labels now say Dossier. Default `/my/` arrivals and ordinary dashboard links resolve to `/my/courses.php`; the brand, breadcrumb and signed-in login continuation lead there too. `/my/?view=dossier` is the explicit bookmarkable Dossier route. `?kex=off` and legacy topic/filter links retain their meaning. The Estonian home heading now says “Minu kursused” even before Moodle's own strings arrive. |
| Dossier at larger volumes | The course selector inherited the course view's one-column topic-strip layout. Unbounded activity rows and three repeated empty pin slots pushed the actual work down. Automatically highlighting the nearest course also looked like an active filter while “All” was selected. | Added a dedicated two-column desktop layout, bounded sticky course list, course search, activity search and 24-row batches. Mobile uses horizontal course cards and stacks the activity pane. Empty pins become one compact hint. Only the selected course receives the selected treatment. The 60-event browser test reveals 24 → 48 → 60 without losing entries. |
| Accent text timing | The previous word stagger continued across both lines. Accent timing depended on how many words the primary line contained. | Accent words fade together 700 ms after the primary starts. Primary text retains its existing masked reveal. Keyboard and reduced-motion paths show the final text immediately. A timing regression checks the primary at 50 ms and the accent at 750 ms. |
| Instant scrolling | `focusTopic()` explicitly allowed browser scrolling. Replacing long content with short content could also shrink the scroll range before the reveal. Page swaps called `window.scrollTo(0, 0)` independently of the transition. | One viewport owner now coordinates reveal, focus and scrolling. Focus uses `preventScroll`; the root keeps its height until the reveal and scroll finish. Targets are clamped to the destination's natural height. A later interaction cancels the previous transaction. Wheel, touch, pointer and keyboard input interrupt scrolling. |
| Stock Moodle information omitted | The captured dashboard contains a course-access FAQ notice, library/citation guidance, AI-use guidance, useful links and university news. App mode hid them with the original page. | Added a shared dashboard scraper/store and a home/Dossier information component. Notices remain visible; reference blocks and news are available under a disclosure. Content and link wording come from Moodle and pass through the HTML sanitizer. A fixture regression checks these actual blocks. |
| Shader shifts after loading | Readiness was shared globally between independent canvases. During compilation, `display:none` could give the canvas a zero CSS size; the renderer then revealed a differently sized first frame. Fallback and live rendering also started at different times. | Each surface owns its readiness through `useRibbons`. Hidden canvases retain their layout and fade by opacity after the first frame is painted. Live rendering starts at the fallback's 7.3 s phase. Static/reduced-motion changes and resize preserve the current phase. Adaptive static fallback stays static. A delayed-compile browser test verifies stable geometry and correctly sized backing stores. |
| “Nädal 321” | `studyWeek()` counted from the oldest enrolled course start date. Long-lived courses made the number grow across academic years. | A separate TalTech calendar uses published term dates and Tallinn civil dates. Teaching weeks are restricted to 1–16; exams, winter/summer breaks and orientation have their own labels. 20 October 2026 resolves to week 8. Unknown years omit a guessed week. Tests cover term boundaries, breaks, midnight and DST. |

## What the local reproduction added

The first browser run caught a remaining 351–355 px movement between rendered frames. Instrumentation showed that a native smooth scroll was progressing while the main thread spent about 219 ms hydrating content. It was not a second focus scroll: the trace showed one smooth-scroll request and a stable document height.

The shared scroll helper now bounds elapsed animation time and pixel movement per rendered frame. This avoids consuming most of the animation during a blocked frame. Activity video thumbnails now use the generated ribbon asset instead of compiling a WebGL program and reading pixels while topic rows mount. The deep-scroll reproduction then passed its unchanged 200 px step limit. This improves pacing; it does not claim that a heavily loaded browser can maintain 60 fps.

Visual inspection also caught narrow-screen defects that a document-overflow check alone missed: a clipped greeting, a two-line section heading squeezed beside tabs, and a 40 px date number inside a 48 px tile. The final CSS allows the greeting to wrap, gives the title and tabs separate rows, and sizes date tiles for their contents.

The repository root contained an unpacked extension alongside `dist/firefox`, and their timestamps differed. `build:local` now builds and synchronizes both locations. `build-info.json` records the build time and mode. Matching root/dist bundle hashes were verified. This removes one source of “the fix exists but my installed copy still behaves the same.”

## Verification

- Full unit suite: **350 tests passed across 25 files**.
- Local browser suite: **9 passed**, including the minified production build.
- Covered flows: home arrival, sidebar/brand navigation, editorial content, three login widths, delayed shader compilation, course/activity filtering, deep-scroll topics, rapid switching and Back, 60-event pagination, reduced motion and effects off.
- Final TypeScript and ESLint checks passed. The final motion, calendar and wording rerun passed 39 tests; the home/mobile layout rerun passed both affected browser cases.
- Firefox package validation: **0 errors, 0 notices, 3 bundled-code `innerHTML` warnings**. The warning category is heuristic; it is not a clean security attestation. Newly surfaced Moodle HTML is sanitized before insertion.
- Screenshots are in `artifacts/local-review/`. Browser logs are in `.scratch/local-production-browser.log` and `.scratch/local-final-layout.log`.

Review was limited to the changed behavior and new helpers because the branch contains unrelated pre-existing edits. Existing dirty files were not subjected to a broad cleanup or automatic commit.

Remaining verification is specific: the current authenticated Firefox session, SSO/logout redirects, and cold-cache cross-page history restoration under delayed server responses. The local Back test covers rapid topic history, not all Moodle routes. The stock root/site homepage was not among the supplied captures. A smaller copy issue also remains: semester labels such as `AUTUMN` are hardcoded in English and belong in the language adapter.

## Three recommended epics

### 1. One navigation transaction from click to usable destination

**Problem:** route loading, hash state, topic selection, focus, skeletons and history still have several owners. The shared viewport helper fixes the immediate collision, but the controller and action files remain coupled by conventions.

**Scope:** introduce a typed navigation intent (`page`, `topic`, `filter`, `history`, `reader`), one cancellation token, explicit scroll/focus policies, and destination readiness. Keep the current shell persistent. Preserve per-history-entry topic and scroll state, including slow cold-cache returns. Abort stale requests where possible and separate “data arrived” from “destination is ready to restore.”

**Acceptance:** no direct viewport writes or implicit focus scrolling in view/action components; Back/Forward restores long pages under delayed responses; rapid route/topic/filter changes leave one active destination and no stale overlays. Add desktop, half-width and keyboard regression cases to the local suite. This should be the first epic because every new view otherwise adds another navigation exception.

### 2. A small visual-effects runtime with a frame budget

**Problem:** readiness, quality adaptation, animation timing and CSS still span several modules. The expensive thumbnail path demonstrated how decoration can steal time from navigation.

**Scope:** build on `useRibbons` and the effects controller: define compiling/painted/live/paused/static/fallback states, maintain a shared render budget, schedule decorative work outside interaction bursts, and generate correctly shaped static assets for each surface. Keep policy tokens for reveal, press, focus, accent and overlay motion in one place. Track long frames locally without recording private course content.

**Acceptance:** no zero-size first frame, no phase reset on static/visibility changes, no shader compilation or pixel readback when activity lists mount, no stale canvas callbacks after disposal, and a test matrix for effects off/static/live, reduced motion, resize, visibility and context loss. Measure on this PC and in Firefox, with realistic long course pages.

### 3. Moodle parity adapters and a repeatable local release gate

**Problem:** APIs, scraped HTML, editorial content and academic dates have different freshness and coverage rules. The old Boost-only lab and duplicate unpacked builds made incomplete parity and stale installations hard to notice.

**Scope:** maintain an explicit stock-to-KEX parity inventory. Give notices, course summaries, deadlines, grades, navigation and calendar data small typed adapters with source/freshness metadata. Keep current captured TalTech fixtures and add a live Firefox smoke flow for authenticated pages. Make the release gate build both local entry points, validate the manifest, run unit and real-theme browser checks, and save screenshots/build provenance together.

**Acceptance:** every hidden stock block has an intentional destination or original-Moodle escape; annual calendar updates have boundary tests and a visible maintenance requirement; no fabricated progress/deadlines in the replay; Firefox SSO and submission links receive a live check; an installed build can be matched to its tested artifact. The local gate should remain read-only against real student data.

## Local workflow

From the project directory:

```powershell
npm run build:local
npm run test:local
npm run demo
```

The preview is `http://localhost:8099/my/courses.php`; Dossier is `/my/?view=dossier`, the sign-in screen is `/login/index.php`, and the stock captured dashboard is `/my/?kex=off`.

For the actual Firefox extension, open `about:debugging#/runtime/this-firefox`, reload the existing temporary KEX add-on, then reload the Moodle tab. Both the repository-root manifest and `dist/firefox/manifest.json` now point at synchronized production files. The browser's already-running content script cannot be replaced by editing files alone.

## Calendar sources

- [TalTech academic calendar 2026/2027](https://oigusaktid.taltech.ee/akadeemilise-kalendri-kinnitamine-jargmiseks-oppeaastaks/), including the 4 December 2025 amendment.
- [TalTech academic calendar 2025/2026](https://oigusaktid.taltech.ee/akadeemiline-kalender-oppeaastaks/).
- [2027/2028 admission calendar](https://oigusaktid.taltech.ee/en/admission-calendar-for-first-and-second-level-studies-in-the-academic-year-the-year-after-next/), for the following orientation period.

The calendar is deliberately finite. Publishing the next year's dates should update this adapter and its tests; course creation dates must never become a fallback for the academic week.
