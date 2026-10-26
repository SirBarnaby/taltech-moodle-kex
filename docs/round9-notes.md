# Round 9: smooth clicks, sign-in, last push before release (2026-10-26)

User feedback: pages still jump on some clicks; the sign-in (login → Microsoft → My courses) did not look good with or without the
hand-off; make the login nicer; check performance; get ready for production.

## Jumps

A new bench, `test/bench/jumps.mjs`, runs 16 kinds of click and load on the capture site and records every layout shift with the
element that moved. A move counts as a jump when an element lands in its new place in one frame; the same element moving over
several frames is an animation. Found and fixed:

| Jump | Cause | Fix |
| --- | --- | --- |
| My courses toolbar 68 px, Dossier 20 px | Bundled fonts load only once text uses them (`font-display: swap`): first layout in a fallback face, then a reflow | `fx/fonts.ts` starts the fonts at document_start; the first render waits for them (at most 300 ms, the snapshot stays up meanwhile). Checked in Firefox 158: all six faces load from the content script |
| "Moodle KE" (Firefox) | The slide-up gradient was sized before the font swap and only re-measured on box resizes | `slideup.ts` also re-measures on `loadingdone` and when a word resizes; the ink has the accent colour under the gradient, so a word never disappears |
| Notices and the dashboard info push the page 157 px | They come from a cache or a fetch after the first paint | `Reveal` slot: holds its height after the first frame and glides to the new one (a disclosure inside it glides too). `cache.swr` hands fresh data to the view before storing it |
| "moodle" beside the logo moves 24 px | Wordmark first, then a zero-width image until it loaded | The logo's address and natural size are remembered (`kex.logo`); never seen: an empty 52 px square holds its place |
| Achievement cards grow | Progress bars arrived with the first idle-time run | Last run's bars are stored and shown at once; the page runs the evaluation before its first paint |
| Tabs shift 9 px when switching | The active tab is bolder and larger | A hidden copy of the label in the active style holds the width |
| Menu fold (Ctrl+B) | Page and header slid, the menu snapped | The menu's width travels with them |

## Sign-in

Before: the login widened its picture and saved it as an image (slow on the click), Microsoft's white pages, then on /my/ a picture
cover painted late, a second full page load (/my/ → /my/courses.php) under it, and a clip-path close into the band.

Now (`fx/handoff.ts`, `fx/rush.ts`):
- White is the colour in between, because the identity provider's pages are white. Leaving: the panel's words lift away, the
  ribbons speed up, the window eases to white (a thin bar appears if the provider is slow).
- Back on /my/: the white is there from document_start (a plain colour, no image to decode). My courses opens right on that page
  (`history.replaceState`), so there is one page load instead of two; My courses' own document is fetched in the background for
  its title. The white lifts in 460 ms while the menu slides in, its rows cascade, the header settles, the content rises and the
  band's ribbons start fast and settle. Moodle's "Welcome back, Name! 👋" shows in the band as before.
- Reduced motion: no wash, a 200 ms fade. A failed sign-in or a stale note plays nothing.
- Bench: `test/bench/handoff.mjs`, 12 checks.

## Login page

Panel comes in top to bottom; ribbons lean toward the pointer; sign-in buttons get a soft light on hover and sink on press.
The menu's "KURSUSED / SÜGIS 2026" label fits the narrowest full menu.

## Performance

Profiled the boot of My courses. The one real waste: `themefix.ts` read the selector of all ~25,000 theme rules, twice per page.
It now runs once per sheet, from the end (the rule sits near the end), and skips KEX's own sheet. The shader compile is already
off the critical path (parallel compile, idle fallback). Bundle: content.js 575 KB (177 KB gzip), mostly our own views; kex.css
443 KB. Firefox compiles an add-on's content scripts and sheets once and reuses them across pages, so neither size is paid on
every page load.

## Release gate

`npm run verify:release` passes again (all 17 browser checks). It had been red since rounds 6 to 8 for reasons outside the
add-on: `pngjs` was used by the checks but never listed as a dependency; the checks still expected the announcement inside
the Moodle info disclosure (it is a notice card since round 6), a page that scrolls while a topic changes (since round 7 the
page moves only under the old panel's held copy, so nothing on screen moves), the old IT palette (round 8 turns it per course
prefix) and a single hero canvas (round 8 lays the old look's last frame over the new one while it fades). The shader-hold
checks relied on KHR_parallel_shader_compile, which software GL lacks; they now supply a stand-in. Version 1.0.0.
