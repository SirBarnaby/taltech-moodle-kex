# UX and flow review (round 3, 2026-10-18)

Checked against the user's round-3 list, the Codex build, and the real TalTech theme CSS in `captures/css/`.

## Found and fixed

- **Login: gray right half.** TalTech's theme sets `body.pagelayout-login { width: calc(100% - 640px) }`, so our full-page login view only got the left part and the rest was the page background. Codex's width override fixes it (reproduced with the real theme: body 943 px before, 1583 px after).
- **Login: first sign-in button unreadable.** The theme has `a:hover, a:focus { background-color: transparent !important }`. The first button is focused on load, so its light fill vanished and dark text sat on dark. The same rule would have removed the fill of every link-shaped button on hover or focus. Fixed by removing that one declaration from the live theme sheet (`src/content/themefix.ts`).
- **Sidebar:** nav rows had uneven heights, the footer took three rows and covered the course list at about 880 px window height, and hovering the left edge dimmed the page. Compacted to the `design_change_nr1` blueprint.
- **Course header at half width:** the hero took about 250 px before any content. Compact below 1000 px wide or 900 px tall.

## Still open (not fixed, your call)

1. **Plain-Moodle fallbacks.** The course navigation (Participants, Grades, Activities, Competencies) and routes like editing are full page loads, so the soft transitions stop there. They could be opened in place later.
2. **Our own labels are English in the lab.** On the real site they follow Moodle's language, but words we add ("Learning materials", "Preview", "Pin", "Open") come from our own tables. Estonian exists for all of them; keep it complete when strings are added.
3. **The lab can't catch theme bugs.** Both labs run plain Boost. `tools/realtheme/` renders captured real pages with the real theme; extend it to the course and workspace captures before the next release.
4. **Hidden sidebar by default.** With auto-hide on, a new user sees no navigation except the menu button. The edge hover and the button both reveal it; consider showing the sidebar open for the first visit.
5. **Two ways to see grades.** Sidebar Grades, the course Grades tab and the Workspace all lead to different grade pages. Worth merging once the course tab is soft-navigated.

## Animation audit

I could not run the Emil Kowalski skill: it is not installed in this session. I checked `src/fx/navigation.ts` against the same rules by hand:

- Exit 110 ms, enter shortly after: under 300 ms, so interaction feels instant. OK.
- Easing `cubic-bezier(.23,1,.32,1)` (strong ease-out). OK.
- Only `transform` and `opacity` are animated. OK.
- Transitions are interruptible (a new navigation cancels the running one) and skipped for reduced motion and keyboard input. OK.
- The exit copy is a cloned DOM tree. Fine for these pages; watch it on very long topics.
