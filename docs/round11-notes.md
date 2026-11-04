# Round 11: the course page in the new look (2026-11-04)

User ask: bring the course page close to the mockup (`Last_ver.png`): each topic in its own accordion card, an Apple-like
finish, and the course's four sections (Course, Participants, Grades, Competencies) in the hero. Scope, in the user's words:
the hero stays as it is (two-colour course name and all) except for the four-section selector under the name; only the view
below the hero changes; the topic outline stays on the left at full width; the side menu is untouched.

## Hero

`CourseNav` moved from the Learning materials header into the hero through a new `nav` prop on `Hero` (other heroes keep their
links). It is a glass segmented control: blurred white glass, a pale pill under the page we are on. A press on another section
slides the pill there at once, then Moodle loads that page as before (`hardLoadFeedback` still shows the skeleton). Back from the
browser's cache puts the pill back. The hero grows only by the bar's height: a one-line course name at 1600 px stays 255 px.

## Learning materials

- The bar under the hero: "Learning materials" on the left, Collapse all / Expand all and a **Pinned** switch on the right. Pinned
  keeps only this course's pinned materials, each under its topic, never folded; with none pinned it says so and offers
  "Show all materials". The switch resets when the course is opened again.
- Each topic is a card on a soft grey ground (`--kex-course-bg`, `--kex-card-*` tokens, dark versions too). Header: chevron,
  number (none for the intro), title, then "2 of 3 complete" (a green check when all are done) or "8 resources". The whole header
  folds the card; Moodle's own fold state is kept as before.
- A title that starts with its own number ("1. LEADING SELF" under 01) drops it, in the cards, the outline, the topic bar and the
  header (`withoutOwnNumber`).
- Compact density (the default) draws list rows: an icon tile for Moodle's module or the file's kind (`KindIcon.tsx`), the title
  over "Type · due date · detail", Moodle's own "Mark as done" box where the student marks completion (a check where Moodle marks
  it), a pin, and a chevron (an arrow out when a plain click opens a new tab). The whole row opens the material; selecting text
  in it does not. Comfortable density keeps the big rows, inside the cards.
- Labs sit in the cards as inset cards.

## Checked

Chromium on the saved pages (38420, 37829, 37582; light, dark, 900 px, folded, Pinned and its empty state, side reader open,
comfortable density) and real Firefox 158 (blur works, pill aligned, wide, compact and 760 px, dark, no sideways overflow).
`npm test` 171/171, typecheck, eslint, CSS check, and `verify:release`.

## Gotchas

- Firefox let an image in a topic summary widen the fold's auto grid column (1613 px), which pushed the pin and chevron out of
  the card. The fold and its inner box need `grid-template-columns: minmax(0, 1fr)` and `min-width: 0` (lab cards too).
- `Reveal` holds the outer box at the inner box's height, so padding belongs on `.kex-reveal__in`.
- The release gate fails as "Build is stale" if any source changes while it runs.
