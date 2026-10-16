# TalTech Moodle KEX: handoff

A Firefox add-on that redesigns moodle.taltech.ee (Moodle 4.5, Bootstrap 4, theme `taltech4_boost`, language Estonian). It runs as a content script and replaces Moodle's page with its own UI; Moodle itself keeps serving the data.

## Where the source is

The folder you were given only has the compiled add-on (`dist/firefox/`), docs and page captures. The source and the git history are not in it.

- **Source and git history:** the cloud workspace at `/home/claude/taltech-moodle-kex`, branch `staging` (`main` holds the earlier version). A copy of the tracked source is also in the project files folder `taltech-moodle-kex-src.zip` (no `node_modules`, no `.git`, no big screenshots).
- **GitHub:** none yet. A private repo `SirBarnaby/taltech-moodle-kex` is planned. The owner must create it empty, then the cloud side pushes `staging` and `main`. `staging` is the working branch; `main` only gets ship-ready versions.
- **Ground truth:** `captures/pages/*.html` are real moodle.taltech.ee pages (session keys removed). Use them as fixtures instead of guessing markup.

## Build and test

Needs Node 22 or newer. From the source root:

- `npm ci`
- `npm run build`: writes the production add-on to `dist/firefox/`. It matches only `https://moodle.taltech.ee/*`.
- `npm run pack`: writes the unsigned `dist/packages/kex.xpi`.
- `npm run build:dev`: also matches the local test Moodle labs.
- `npx vitest run`: unit tests (285 pass).
- `npm run typecheck`, `npm run lint:eslint`.
- `npm run test:ff`: smoke test in real Firefox through Selenium, against the test Moodle labs. Needs docker.
- `npx playwright test` (Chromium) and `npm run test:visual` (pixel diff against `ai_generated_enhanced_drafts/iteration3.png`).

Load it by hand: `about:debugging#/runtime/this-firefox`, "Load Temporary Add-on…", pick `dist/firefox/manifest.json`. Alt+Shift+O shows plain Moodle; `?kex=off` disables it for a page.

## Layout

- `src/content/`: boot gate, router, soft navigation, shell snapshot, page info, skin and guest skin.
- `src/data/`: Moodle web-service calls (`ws.ts`), course state, scrapers for tiles, summaries, secondary nav, grades.
- `src/state/`, `src/actions/`: Preact signals and the actions that change them.
- `src/ui/`: views (`Course`, `Workspace`, `MyCourses`, `GradesOverview`, `Notifications`, `Login`), the shell (header, sidebar, palette) and components.
- `src/styles/`: all CSS, scoped under `#kex-root`. `skin/` restyles Moodle's own pages.
- `src/fx/`: hero shader, slide-up text. `src/i18n/`: our strings, plus Moodle's own (`moodle.ts`).
- `manifest/`, `scripts/`: manifests and build, pack and test scripts. `test/`: unit, Chromium, Firefox.
- `docs/`: `architecture.md`, `design-spec.md`, `page-designs.md`, `round2-plan.md`.

## Rules of the project

- Moodle's words, not ours: labels come from Moodle in the page's language. Nothing user-visible may be text we invented where Moodle supplies it.
- Native and finished: it must look built into Moodle's site, not bolted on.
- Do not edit `ai_generated_enhanced_drafts/`, `how_the_website_looks_like_now/` or `tools/capture/`.
- No model names in commits or code.

## Current state (2026-10-16)

Done: Estonian from Moodle, soft navigation between app views, course page with subsections, "House Rules" and Moodle's own course nav, Workspace grouped by course, school colours by course-code letter, guest login header, skin for Moodle 4.5 and 5.3.

Not yet verified on the real site: SSO login, real images, shader on a real GPU, Moodle Buddy.

Next (from the user, not started): sidebar that appears on hover and is narrower, page-leave and page-enter transitions with skeletons, materials in a dimmed full-screen overlay, a topic selector that does not squeeze the lab text, grade percentages and point meters, more microinteractions, layout tuned for a half-width window, and a review of awkward user flows. Design inspiration is in `design_change_nr1/` and `to_be_course_view.png` on the user's PC.
