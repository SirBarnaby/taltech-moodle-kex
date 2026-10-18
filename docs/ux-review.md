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

## Animation audit

I could not run the Emil Kowalski skill: it is not installed in this session. I checked `src/fx/navigation.ts` against the same rules by hand:

- Exit 110 ms, enter shortly after: under 300 ms, so interaction feels instant. OK.
- Easing `cubic-bezier(.23,1,.32,1)` (strong ease-out). OK.
- Only `transform` and `opacity` are animated. OK.
- Transitions are interruptible (a new navigation cancels the running one) and skipped for reduced motion and keyboard input. OK.
- The exit copy is a cloned DOM tree. Fine for these pages; watch it on very long topics.
