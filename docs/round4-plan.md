# Round 4 plan (user feedback 2026-10-18, half-width window)

Planned on Opus (extra high); implemented on Sonnet (high). Causes for items 2 and 3 come from reading code: each has a first probe the implementer must run before fixing. `src/fx/motion.ts` (`motionTier()`, `scrollBehavior()`) already exists.

Rules: Moodle's words not ours; all CSS under `#kex-root`; animate transform/opacity only, ease `cubic-bezier(.23,1,.32,1)`, each step under 300 ms; honour reduced motion and the effects setting; no model names in code or commits.

## 1. Topic strip (WP-A)

Why text is lost: each chip is `flex: 0 0 clamp(180px,22vw,280px)` (course.css ~L263): at 960 px that is 211 px; padding 28 + number column 51 + hidden arrow 28 leaves ~100 px for the title.

Ideas: A) two-row horizontal ribbon (column-major order, clumsy sideways scroll); B) **two-row wrapping grid (chosen)**: chips fill left to right with `repeat(auto-fill, minmax(var(--kex-topic-min),1fr))`, titles wrap to 2 lines, two rows visible, vertical scroll snapped by row; C) one-row picker with dropdown (hides other topics).

Spec: move the topics CSS (course.css L244–373, L760–762, L941) unchanged into new `src/styles/course/topics.css` first, then change it.
- `.kex-topics__list`: `display:grid; grid-auto-rows:52px; gap:6px 8px; max-height:110px; overflow:hidden auto; scroll-snap-type:y mandatory; scrollbar-width:thin`.
- `--kex-topic-min`: 220 px at >=1100, 196 px at 760–1099, 160 px below 760.
- `.kex-topic`: 52 px tall in every state (drop active 53 px/-1 margin); 28 px number column; remove arrow; active = tint + 3 px accent bar; title 14/18 px clamped to 2 lines, full Moodle title in `title`; tile photo only >=1100; `.kex-topics__label` visually hidden below 1100.
- `TopicList.tsx`: replace the `scrollLeft` effect by `list.scrollTo({top, behavior: scrollBehavior()})` so the active row stays in the 2-row window; ArrowUp/Down move one row (columns = `getComputedStyle(list).gridTemplateColumns.split(' ').length`); class `--more` (bottom fade) while rows remain below.
- `TopicSkeleton` (States.tsx): same grid and chip height.
- Accept: 960x992 with rail: >=8 chips visible, strip <=130 px tall, titles up to 34 chars not cut, j/k keeps active chip fully visible, no horizontal scrollbar. 1585x992: 12 chips visible.

## 2. Bar fades in with auto-hide off (WP-A)

Likely cause (probe first: hover the active rail course, read `getComputedStyle(el,'::after').height`; expect ~window height): at 760–1099 px with auto-hide off the sidebar is the 72 px rail; the edge zone is not rendered. The bar is the rail tooltip `[data-tip]::after` (sidebar.css ~L430–458, `position:fixed; left:80px`, no `top`) colliding with the active-course marker `.kex-sb__course--active::after` (L259–268: `top:0; bottom:0; width:4px; box-shadow`). Second: `.kex-sb__courses:hover{scrollbar-width:thin}` fades a scrollbar in. Also: turning auto-hide off in Quick settings leaves the peek overlay open and `scheduleClose` returns early.

Intended: auto-hide off, 760–1099: fixed 72 px rail always visible, no edge zone, no hover expansion; tooltip only beside the hovered item; menu button or Ctrl+B expands it over the page with backdrop. Below 760: drawer opened only by menu button/Ctrl+B with backdrop. Auto-hide on: unchanged.

Fix: new `src/ui/shell/RailTip.tsx`: one fixed element positioned from the item's rect with `translateY(-50%)`, fades in (opacity + translateX -4->0, 120 ms) after 300 ms delay; render only in rail mode with auto-hide off and sidebar closed. Delete the `[data-tip]::after` CSS. Course-list scrollbar `none` in the rail, `thin` in the full sidebar. When auto-hide is turned off: `sidebarOverlay=false`, `peek=false` once any popover closes.

## 3. Hero title plays in two stages (WP-B)

Causes (probe: screenshot 150 ms into the run; coloured words missing = confirmed):
1. The hero is outside the page transition: `beginViewTransition` copies only `.kex-main .kex-content` (content/index.ts ~L653). The Hero remounts and runs its own slide-up (700 ms per word, 60 ms stagger, slow ease `(.625,.05,0,1)`, slideup.ts ~L34), so the title moves after the content has entered.
2. `background-clip:text` sits on the element the animation moves (`.kex-su-item--grad`, also `will-change:transform`); Firefox likely does not paint it while it moves, so it appears when `slideUp` cancels animations at the end (~0.5 s later).
3. Durations 700/600/450 ms break the 300 ms rule; "Learning materials" replays on every course switch.

One choreography in `fx/navigation.ts`, ease `(.23,1,.32,1)`:
| t (ms) | what |
|---|---|
| 0 | copy of whole `.kex-main` (hero text + content, no canvas, rows outside viewport removed) fades out 120 ms; scroll resets underneath |
| 40 | new page opacity 0->1, translateY(-d->0) 240 ms; d = min(old scrollY,160), 8 px when at top |
| 80 | title pieces rise translateY(100%->0) 260 ms, one 35 ms stagger across white and coloured words |
| 140 | hero meta line fades in 160 ms |
| 160 | topic title characters 220 ms, total stagger <=120 ms; `--kex-enter` capped at 8 |

slideup.ts: default ease -> `(.23,1,.32,1)`; clamp duration <=0.3 s and total stagger <=0.25 s; gradient moves to a static inner `span.kex-su-ink` (the moving element carries no background); remove `will-change` (hero.css ~L188); "Learning materials" stays still on soft navigation.

Tiers (`motionTier()`): none = everything instant; subtle (effects off) = 120 ms crossfade, title does not move; full = table above.

## 4. Search box at half width (WP-A)

Cause: at 760–1099 px the button is 180 px wide; padding 35 + icon 24 + gap 14 + Ctrl K 64 leave 43 px, so our own "Search anything" becomes "Sea…". When the header compacts on scroll its 240 px width rule overrides the breakpoint width.

Decision: label = Moodle's own `search` string ("Search"/"Otsi"): add `'header.search': core('search')` to MOODLE_KEYS (i18n/moodle.ts); en/et fallbacks "Search"/"Otsi". Width via `--kex-search-w`: >=1280 268 px (240 compact); 1100–1279 220; 900–1099 188 (text + Ctrl K, 68 px for text); 760–899 44 px icon only; <760 36 px as now. Compact rule becomes `min(240px, var(--kex-search-w))`. Icon-only: `aria-label` = Moodle word, `title` adds shortcut. Accept: at 960 and 1585, top of page and after scrolling, `.kex-search__text` has `scrollWidth <= clientWidth`.

## 5. Abrupt changes (WP-B unless noted)

| where | now | fix |
|---|---|---|
| course to course (`swapView`, content/index.ts ~L718) | instant `scrollTo(0,0)`; copy covers only content | scroll reset hidden under the whole-page copy, then downward enter from item 3 (reads as a smooth scroll up in <=280 ms) |
| back/forward (~L760) | jumps after the view loads | restore Y before `enter()`; keep `#kex-main` min-height = Y + innerHeight until content arrives (<=2 s) |
| topic switch while scrolled (`setTopic`, `onPop`) | stay in middle of old topic | if scrollY is past the detail top minus sticky strip, jump to detail top under the topic copy |
| click active course tab (CourseNav.tsx) | instant scroll to top | `behavior: scrollBehavior()` |
| `focusTopic` | `preventScroll:false` jumps the page | `preventScroll:true`; strip scrolls itself (A) |
| skeleton -> content | pops | same geometry as skeleton + `.kex-fade-in` 120 ms when status becomes ready |
| course tabs arrive late (wrap to new line <1100) | content drops 51 px | fill from `snav:<id>` cache before swap; reserve 51 px while empty |
| hero meta line arrives late | compact title jumps ~11 px | reserve line height; fade items in 160 ms |
| sidebar full <-> rail (Ctrl+B) | `.kex-main` animates margin-left while header jumps | no layout transition; move `#kex-main` and `.kex-header` with translateX FLIP over 220 ms (Shell.tsx) |
| tab underline | animates left/width | translateX + scaleX on a 1 px bar |
| preview sheet, Escape | closes instantly | `dismiss()` |

## 6. Test diet (WP-C)

Now 329 tests, 14–19 s (happy-dom setup 11 s; the same captures re-parsed in several files). Target about 100 tests in ~17 files, `npm test` <=5 s.
- Files that never touch `document`: `// @vitest-environment node`. `test/fixtures/load.ts` parses each capture once and reuses it. Table-driven loops: one test per table, not per row.

| old file (tests) | action | new: tests |
|---|---|---|
| classify (78) | one table test + 2 helper tests | classify: 3 |
| names (16), router (19), search (9) | loops; drop trivia | 3, 3, 4 |
| topics (22) + course-round2 logic | keep subsections, section 0, first topic, preview sanitising; drop slide-up internals, pad2 | course-model: 13 |
| course (4), scrape (4), pages (17), pageinfo (12), login (5), skinguest (6), course-round2 capture tests | one parse per capture; delete per-capture "route and band" loop | captures: 20 |
| skinpage (16), breadcrumb (6) | merge date/idempotence variants | 5, 3 |
| grades-meters (14) | keep zero, decimal comma, scale, hidden grades, account switch | grades: 8 |
| round2-i18n (4), themefix (2) | keep | 4, 2 |
| sidebar-autohide (15) | owned by WP-A: rewrite for round-4 rules | sidebar: 5 |
| navigation-motion (4) | owned by WP-B: add tier tests | motion: 4 |
| round2-shell (21), ux-grid-nav (3), keys (3) | keep soft-nav targets, safe prefetch, PageLoader, snapshot never holds sesskey/script, key chords | shell: 12 |
| workspace (13), data (8), reader (5) | keep feed order, pins import, sesskey scrub, WS batching, focus trap | 6, 4, 3 |

Delete: `test/visual/`, `scripts/visual-diff.mjs`, the `test:visual` script; Chromium specs `hero-shader`, `m6`, `shell`, `course`, `softnav` (Firefox smoke covers them); keep on demand `activities`, `pages` (has the axe pass), `workspace`.

Firefox smoke gets `--only quick` (<=90 s): shell on /my/; topic switch and preview; course to course then back; a 960 px pass; login page with TalTech's `body.pagelayout-login{width:calc(100% - 640px)}` injected (body width must equal viewport); `?kex=off`.

package.json: `test` = `vitest run` (unit only); `test:ff` = `build:dev` + `smoke --only quick`; `test:ff:full` = all smoke groups before a release; `test:e2e` = Chromium specs on demand; `shots` = `scripts/test-visual.mjs --all`. Remove pixelmatch/pngjs only if nothing imports them. Update the test section of HANDOFF.md.

What earns a test: (1) a bug we shipped or nearly shipped, named after the symptom, landing with the fix; (2) reading Moodle markup or web-service data against a real capture, one test per markup shape; (3) security/privacy invariants (sesskey, sanitising, hidden grades, account switch); (4) completeness of the Moodle string mapping. Not: CSS values, class names, DOM snapshots, timings, anything the type checker proves, one test per table row, UI still being redesigned. Budget: <=120 tests and 5 s; to add one over budget, delete one.

## Work packages (disjoint files)

- WP-C (tests): `test/**` (except the two files owned by A and B), `vitest.config.ts`, `playwright.config.ts`, `package.json`, `scripts/test-visual.mjs`, `scripts/visual-diff.mjs`, test section of HANDOFF.md.
- WP-A (layout): `TopicList.tsx`, `States.tsx`, new `styles/course/topics.css`, `styles/index.css`, `Header.tsx`, `header.css`, `Sidebar.tsx`, new `RailTip.tsx`, `sidebar.css`, `tokens.css`, `i18n/moodle.ts`, `en.ts`, `et.ts`, `test/unit/sidebar-autohide.test.ts`.
- WP-B (motion): `fx/*`, `SlideUpText.tsx`, `Hero.tsx`, `hero.css`, `course.css` (after A moves the topics block out), `micro.css`, `Course.tsx`, `CourseNav.tsx`, `Tabs.tsx`, `PreviewSheet.tsx`, `Shell.tsx`, `content/index.ts`, `actions/course.ts`, `test/unit/navigation-motion.test.ts`, `docs/ux-review.md` (last).

Shared: A's first commit moves the topics CSS out of course.css unchanged; after that B owns course.css. A only imports `scrollBehavior` from `fx/motion.ts`.

## Verification (cheap)

1. `npm test`, `npm run typecheck`. 2. `npm run build:dev && npm run pack:dev`. 3. One Selenium probe at 960x992 and 1585x992 (model: /tmp/claude-0/scr/final.mjs, lab at http://localhost:8080):
   1. course id=2: chips in first two rows, strip height, title overflow.
   2. `.kex-search__text` fits, at top and after scrolling 600 px.
   3. auto-hide off in Quick settings; at 960: no edge zone; hover active course 600 ms: no `::after` taller than 40 px, RailTip beside the item.
   4. scroll to 1500, click another course; sample `document.getAnimations()` every 50 ms: all durations <=300 ms, all hero pieces (coloured too) start within 200 ms; screenshot at +150 ms shows the coloured words.
   5. in a topic, scroll down and click chip 3: after 400 ms the detail top sits under the strip.
   6. `data-kex-motion="reduced"`, repeat 4: `getAnimations().length === 0` and `scrollY === 0`.
