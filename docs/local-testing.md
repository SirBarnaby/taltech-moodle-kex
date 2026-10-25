# Moodle KEX local testing

The local production extension is available from either `manifest.json` in the repository root or `dist/firefox/manifest.json`. Both entry points are synchronized by `npm run build:local`. Firefox retains the content script already running in an open page: reload the temporary add-on at `about:debugging#/runtime/this-firefox`, then reload Moodle.

## Repeatable release check

Run `npm run verify:release`. It runs ESLint, TypeScript, unit and provenance tests, builds and synchronizes the production extension, validates its manifest, and runs headless Edge against the captured TalTech theme. Each run reserves its own local port and checks the server run ID and the page's `data-kex-build` marker. It never attaches to your real browser or account.

Evidence is saved together under `artifacts/releases/<run>/`: `report.json`, build hashes, check logs, test results, screenshots and failure traces. A failed or interrupted run is not a release pass. The final check verifies that source and both extension copies still match the tested build. `npm run verify:build` checks the current production artifact separately.

The replay preserves captured progress and deadlines and uses a fixed test date, 20 October 2026, for repeatable calendar assertions. It cannot prove SSO, live permissions, current Moodle markup or submission behavior.

The fixture adjusts `Date` only. Animation frames, `performance.now()` and timers use the browser's real clock, because replacing them with a simulated scheduler can hide or invent scroll jumps during long frames.

## Testing in your usual Firefox

1. Reload the add-on and Moodle. Normal arrival should open **Minu kursused**. Dossier remains a separate sidebar destination.
2. Open a long course without a topic hash. Change topics, use Back and Forward, and repeat while a course is still loading. Check the selected topic, restored position and keyboard focus.
3. Open and close a material reader, including one that cannot preview. Its original Moodle link should remain available. Open another course while a reader is open.
4. In appearance settings, switch effects between animated, static and off, then turn them back on. Resize to half width. Watch the first image, rather than only the final animation.
5. Compare the university notices and information disclosure with the original Moodle dashboard. Unknown widgets should have an original-Moodle link. The academic label should use weeks 1–16 or the relevant break/session.
6. Check your usual SSO and open an assignment/quiz page. These keep Moodle's native activity flow; the smoke test requires no submission.

## Optional isolated live Firefox flow

`npm run test:live -- --course 37582` opens a fresh Firefox test profile and installs the verified production extension temporarily. Sign in yourself in that window, then follow the terminal prompts. It checks authenticated home/Dossier/course rendering and asks you to confirm SSO and native activity links. It does not borrow your Firefox profile, store credentials or submit work. Its aggregate result goes to `artifacts/live-smoke/`.

Firefox and geckodriver must be available to Selenium. For a nonstandard installation, set `KEX_FIREFOX_BINARY` and, if needed, `KEX_GECKODRIVER` to their executable paths. This live check is deliberately separate from the automated release gate and is not marked passed until a tester runs it.

## Maintaining parity and artwork

`src/data/parity.ts` declares a KEX destination or original-page escape for each stock dashboard block. `src/data/sources.ts` records data authority and freshness; the academic calendar has explicit coverage and review dates. Extend the published dates and boundary tests when TalTech publishes a new calendar.

Hero and page-band first frames use fixed per-faculty compositions so their live shaders match the static artwork. Login has its own portrait asset. After changing the shader, palette, shape, initial phase or intensity, regenerate with `node scripts/render-fallback.mjs` and run the release check. Thumbnail lists use static artwork and never compile a shader or read pixels.
