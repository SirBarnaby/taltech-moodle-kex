# UX and flow review (round 3, 2026-10-18)

Checked against the user's round-3 list, the Codex build, and the real TalTech theme CSS in `captures/css/`.

## Found and fixed

- **Login: gray right half.** TalTech's theme sets `body.pagelayout-login { width: calc(100% - 640px) }`, so our full-page login view only got the left part and the rest was the page background. Codex's width override fixes it (reproduced with the real theme: body 943 px before, 1583 px after).
- **Login: first sign-in button unreadable.** The theme has `a:hover, a:focus { background-color: transparent !important }`. The first button is focused on load, so its light fill vanished and dark text sat on dark. The same rule would have removed the fill of every link-shaped button on hover or focus. Fixed by removing that one declaration from the live theme sheet (`src/content/themefix.ts`).
- **Sidebar:** nav rows had uneven heights, the footer took three rows and covered the course list at about 880 px window height, and hovering the left edge dimmed the page. Compacted to the `design_change_nr1` blueprint.
- **Course header at half width:** the hero took about 250 px before any content. Compact below 1000 px wide or 900 px tall.

## Still open (not fixed, your call)

1. ~~Plain-Moodle fallbacks.~~ Partly done. The course navigation (Participants, Grades, Competencies, …) renders in Moodle itself, so it stays a normal page load. A click on one now answers at once: the view leaves, the navigation skeleton enters with the soft-navigation transition and the header line runs, and the next load paints the shell snapshot (`hardLoadFeedback` in `src/content/index.ts`). Opening those pages in place would need KEX views for them; the grades overview is the only one that exists. Editing routes are still page loads.
2. **Our own labels are English in the lab.** On the real site they follow Moodle's language, but words we add ("Learning materials", "Preview", "Pin", "Open") come from our own tables. Estonian exists for all of them; keep it complete when strings are added.
3. **The lab can't catch theme bugs.** Both labs run plain Boost. `tools/realtheme/` renders captured real pages with the real theme; extend it to the course and workspace captures before the next release.
4. **Hidden sidebar by default.** With auto-hide on, a new user sees no navigation except the menu button. The edge hover and the button both reveal it; consider showing the sidebar open for the first visit.
5. **Two ways to see grades.** Sidebar Grades, the course Grades tab and the Workspace all lead to different grade pages. Worth merging once KEX has its own per-course grade view.
6. **Not yet looked at in a browser.** The My courses card grid, the shared microinteractions (`src/styles/components/micro.css`) and the hard-load skeleton are covered by unit tests and the build only. Check them in Firefox with effects on, off and with reduced motion. `test/visual/iter3-geometry.spec.ts` and `scripts/visual-diff.mjs` were updated for the auto-hide sidebar by calculation and have not been run.

## Done since the review

- My courses is a card grid (columns of 260 px or more, school accent, code, title, progress, last access). Filtering, sorting and keyboard use are unchanged; up and down move a row, left and right a card. Cards stagger in (30 ms steps, first eight).
- One set of microinteractions: press feedback, hover lift on cards for fine pointers, fills and checks that grow in, a sliding highlight for the sort control, one focus ring. All of it follows the effects setting and reduced motion.

- Round 4, motion (checked in Firefox at 960 and 1585 px with a Selenium probe): one choreography for a page change, constants in `MOTION` (`src/fx/navigation.ts`). A copy of the whole `.kex-main` (hero text and visible rows, no canvas) fades out in 120 ms while the real page, already scrolled to the top underneath, fades in and slides down from min(old scroll, 160) px (8 px from the top) in 240 ms: a long course page reads as a short scroll up. Title pieces start at 80 ms with a 35 ms stagger, 260 ms each (the coloured words too; all start within 130 ms of the click in the lab), meta line at 140 ms, topic title characters at 160 ms in a 120 ms stagger. Effects off: 120 ms crossfade, the title does not move. Reduced motion and keyboard use: nothing animates (`getAnimations()` is empty, `scrollY` is 0).
- The coloured title words were not missing because Firefox failed to paint `background-clip:text` on a moving element (it painted them mid-move in the probe). They came late: slow ease, 700 ms, a 60 ms stagger and the title started after the content had entered. The gradient still moved to a static `span.kex-su-ink`, and `will-change` is gone. "Learning materials" no longer replays on soft navigation.
- Back and forward restore the scroll position as soon as the view is mounted and hold the page height until the content is in (at most 2 s). Switching topic while scrolled jumps to the top of the topic under the sticky strip, under the copy of the old panel. `focusTopic` no longer scrolls the page. Active course tab scrolls smoothly (`scrollBehavior()`). Skeleton to content fades in (120 ms); the tab row and the hero meta line keep their height while their data arrives, and the tabs of a course seen before are filled from the cache at once. Tab underline moves with transform (translateX plus scaleX). Escape on the preview sheet fades it out like the backdrop click. Sidebar full or rail with auto-hide off: the page and the header slide into place with a transform over 220 ms (pointer use only; Ctrl+B stays instant by the keyboard rule). Reduced motion now removes CSS animations (`animation: none`) instead of shortening them, so none stay registered.
- Not done: nothing skipped. Known: the 1.6 s header loading line while a page loads is an indeterminate progress indicator, not part of the 300 ms rule.

## Animation audit

I could not run the Emil Kowalski skill: it is not installed in this session. I checked `src/fx/navigation.ts` against the same rules by hand:

- Exit 110 ms, enter shortly after: under 300 ms, so interaction feels instant. OK.
- Easing `cubic-bezier(.23,1,.32,1)` (strong ease-out). OK.
- Only `transform` and `opacity` are animated. OK.
- Transitions are interruptible (a new navigation cancels the running one) and skipped for reduced motion and keyboard input. OK.
- The exit copy is a cloned DOM tree. Fine for these pages; watch it on very long topics.
