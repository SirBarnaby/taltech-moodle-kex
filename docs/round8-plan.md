
# Round 8 plan (user feedback 2026-10-26)
 · 
## Summary
Round 8 is six pieces of work, built in the order at the end of this doc, all on staging. Three of them start from bugs I found in the code:
- The shader hasn't run anywhere since the 25 October merge. The login art is empty, and course heroes show the pre-rendered still picture, not the live ribbons. A CSS rule hides the canvas until it is ready, and the runtime won't start a hidden canvas (item 2).
- Pins are sized by their title and borrowed from other courses. Each pin cell grows with its text, and the course row fills its three cells with this course's pins first, then any other course's (item 5).
- TalTech's theme paints Moodle's own pages white in dark mode. Its CSS has 523 rules with hard-coded white or light backgrounds. The forum, participants and activity pages show white panels with our light text on top (item 4).
The bigger changes I propose:
- A sign-in hand-off: the last frame of the login art survives the SSO redirect and breaks into particles that settle into the new page.
- One course bar: the full topic grid stays in place, and a slim sticky bar with one scrolling row of topics and this course's pins slides in once you scroll past it.
- A generated dark layer: a build script reads TalTech's theme CSS and writes the dark twin of every light colour rule. An automatic dark audit checks the result.
- Series detection for labs and weekly work, applied only when it is sure, with a one-click way back to the plain list.
- Achievements that double as a tour of KEX, with medallion badges drawn in the redesign's own style.
What I need from you: approval or changes, answers to the three questions at the end, and if you can, captures of 3 or 4 more courses with the capture add-on.
## Item 2: the login shader
The shader is stuck in a loop where each half waits for the other, and the fix is two CSS lines plus a better first frame.
Cause. Since the Codex merge on 25 October (29387f8), src/fx/effects.ts only creates a WebGL context for a canvas that is visible on screen. login.css and hero.css hide the canvas with display: none while its mode is fallback. The mode stays fallback until a context exists, so neither side ever moves.
Evidence. I bundled our own heroCanvas and effects runtime into a test page in Chromium with WebGL. With the site's display: none rule, the canvas was still deferred with 0 contexts after 4 s. Without the rule it went live and drew 29 frames.
Why only the login looked broken. The course hero has a pre-rendered picture of the ribbons behind the canvas, so it looks right but never moves. The login's fallback is a plain gradient (a round 6 choice), so it shows nothing at all.
Fix.
- Keep the canvas in layout while the shader compiles. It stays invisible through the existing opacity: 0 until its first frame is drawn, so its visibility can be measured. Both display: none rules go.
- Give the login art its own pre-rendered picture, framed for the tall panel (same seed and time as the live shader). The first second is no longer empty, and the live ribbons fade in over a matching image.
- Add a Firefox smoke check that the login and a course hero reach live within 3 s. A unit test can't catch this, because happy-dom has no real layout.
## Item 1: a sign-in hand-off
We carry the login's last frame across the sign-in redirect ourselves, and it breaks into light as the new page assembles. The browser can't do this for us. Signing in leaves Moodle for TalTech Uni-ID or TARA (ID-card, Mobile-ID, Smart-ID) and comes back through redirects. Firefox has no cross-document view transitions yet, and they couldn't cross another site anyway.
What you see.
- Leaving the login (about 600 ms, never delays the redirect). You pick a sign-in method. The panel's words lift away, and the ribbons widen to fill the window, speeding up and brightening. The navigation starts at once; the animation only fills the wait.
- The sign-in pages. Uni-ID and TARA are their own sites, and we don't touch them.
- Back on Moodle. Moodle's redirect pages stay dark instead of flashing white.
- Arriving (about 1.4 s). The first painted frame is the login's last frame, full screen. It shrinks into the hero band of the page you land on. As it shrinks, about 600 points of light shed from the bright parts of the ribbons, drift into the page and fade. Behind them the shell assembles: sidebar rows slide in one after another, the header settles, the title rises. Moodle's own "Welcome back, {name}!" line shows in the hero for a few seconds.
Rules. It plays once per sign-in: only when the login saw you leave less than 15 minutes ago and you arrive signed in. A click or key ends it at once, and the page is usable from the first frame. Reduced motion gets a 200 ms cross-fade. Effects off gets the shell assembly without particles. A failed sign-in plays nothing.
How it works.
- On the way out, the login saves a small snapshot of the ribbons (960 px wide, about 80 KB) with its seed, palette and time in sessionStorage. That storage belongs to the tab and survives the trip through other sites.
- On the next page, the boot code paints the snapshot as a full-window veil at document_start, before Moodle's page or our shell exist. Last frame out = first frame in.
- Particles live in a new src/fx/particles.ts: Canvas 2D with additive blending, seeded from the snapshot's bright pixels. There is no shader to compile, so it starts on the first frame. The same module draws the achievement bursts (item 3).
- The ribbons shader gets one new input, a "rush" amount, for the speed-up on the way out.
- A page without a hero (an activity) gets the veil shrinking into the header strip instead.
The dashed box is the only stage KEX can't run on; the saved frame carries the picture past it.
## Item 4: dark theme
Dark mode gets three changes: the sidebar responds, the switch itself animates, and Moodle's own pages get a dark layer generated from TalTech's theme instead of patched by hand.
### 4a. Sidebar and shell
The sidebar tokens are literally marked "same in both themes" in tokens.css, so toggling dark changes nothing on the left. In dark:
- The base gradient goes deeper and calmer (about #140e26 to #0d0a1a instead of #1f1339 to #140f29), and the top-right glow drops from 28% to about 12%.
- A 1 px hairline separates sidebar and page, since both are dark now.
- The active course loses its bright violet fill and takes the dark topic-chip look: a soft tint plus the 3 px accent bar.
- Hover, dividers, mono labels, count badges and the user card each step down one notch.
Light mode stays exactly as it is, and the hero art is the same in both.

Rendered from the current build on a captured TalTech page, with the proposed dark sidebar values on the right. The white panel in both is the 4c problem.
### 4b. The switch
The moon button reveals the new theme in a circle growing from the button (450 ms), using the browser's view transitions (Firefox 144 and newer). Older Firefox and reduced motion get a 180 ms colour cross-fade. The t shortcut does the same, growing from the button.
### 4c. Moodle's own pages
I ran a dark audit on the captured TalTech pages with the current build:
- Moodle's main content panel is white. TalTech's theme sets #page.drawers div[role="main"] { background: #fff }, and our skin only clears #region-main.
- On the participants list, names are light lavender on that white panel, about 1.2:1 contrast.
- The forum's activity header and discussion list, course section headers and search inputs stay light.
- TalTech's theme has 523 rules with hard-coded white or light backgrounds, and bg-white appears 218 times in the five captured pages.

Forum (top) and participants (bottom) in dark mode with the current build and TalTech's real theme CSS. The names on the participants list are there, at about 1.2:1.
Patching these one at a time never ends, so the plan is:
- A generated dark layer. scripts/dark-mirror.mjs reads TalTech's theme CSS. For every rule that sets a light background, dark text or a light border, it writes the same selector under :root[data-kex="skin"][data-kex-theme="dark"] with the colour mapped onto our dark palette. Hue stays and lightness flips: big surfaces become our surface tokens, light tints (alerts, badges, status cells) a 14% tint of the same hue, TalTech purple text our violet. It runs at build time, costs nothing at runtime, and the output is plain CSS we can review.
- Hand-tuned parts where a mapping isn't enough: the TinyMCE editor (its text sits in a same-site frame, so we style inside it), the file picker, quiz questions and navigation, calendar, grade tables, dropdowns and dialogs.
- Teacher content. Teachers often write inline colours (black text, white or yellow boxes). Inside content areas only, a small pass remaps colours that would be unreadable on dark, keeping their hue, and restores them in light. Transparent diagrams with black lines would vanish, so images with transparency get a light paper backing.
- A dark audit as a test. The audit becomes test/bench/dark-audit.mjs. In Firefox, on the lab and on real-theme captures, it fails on any large light surface or text under 4.5:1 in Moodle content. Pages: forum, participants, assignment, quiz attempt and review, grades, calendar, profile, messages, book, page, choice, feedback, questionnaire, attendance.
- Theme updates. The theme URL carries a revision number. When TalTech updates the theme, KEX notes the new number in diagnostics, so we know to re-capture and re-generate.
## Items 5 and 6: pins and topics in one course bar
Pins and topics become one course bar with two states: the full grid where it stands, and a slim sticky row once you scroll past it. Two elements instead of one reshaping element keeps the page from jumping, which round 7's stability rules require.
The in-place grid never changes size, so nothing below it moves when the bar appears.
### Pins (item 5)
- Equal cells. The row becomes three equal columns. Today each cell grows with its title (flex: 1 1 auto). Long titles end in an ellipsis and show in full on hover.
- Own course only. The course page shows only that course's pins. Today rowPins() fills empty cells with other courses' pins.
- Three per course, enforced. Pinning a fourth material in a course no longer overflows silently. The row lights up, its cells become numbered targets, and you press 1 to 3 (or click) to choose which pin it replaces. Esc cancels, and Undo works as now.
- Nothing is deleted. A course that already has more than 3 pins shows the first 3, and edit mode lists the rest to keep or drop.
- Elsewhere. The Pinned materials page still lists every pin by course. The Dossier row shows your 3 most recently opened pins across courses, also in equal thirds.
- Each pin shows its format icon (PDF, link, page, quiz) instead of the generic document glyph.
### Topics (item 6)
- In place, the topic grid is no longer sticky and no longer scrolls. It wraps to as many rows as it needs, usually 3 or 4. For unusual courses, beyond 5 rows it shows 4 and Moodle's own "Show all" button, which expands the rest in place.
- Once you scroll past it, a 48 px bar slides down under the compact header. It holds one row of topic chips that scrolls sideways: the active chip stays in view, the edges fade where more chips wait, arrows appear on hover, and the mouse wheel scrolls it. On the right sit this course's pins as three compact chips. Picking a topic there switches topic and lands at the top of its materials, just under the bar.
- Narrow course column (under 900 px): topics only, plus a pin button with a count that opens the three pins in a small popover.
- Keyboard: left and right arrows move between topics in both states, as now. P pins, and 1 to 3 picks a slot when replacing.
- Stuck detection uses an invisible marker after the grid and an IntersectionObserver. CSS scroll-state queries would need no script, but Firefox doesn't support them.
- Anchor jumps and the side reader allow for the bar's 48 px, so nothing hides under it.
## Item 7: labs and weekly work, detected safely
The labs view stays, but it switches on from evidence in the course's own titles and activities, and you can always switch it back.
Why it's overfit today. isTrack() in src/data/labtrack.ts turns any topic with 4 or more subsections into a lab track. Only Embedded Systems builds its labs from Moodle 4.5 subsections. It can also misfire: a topic with subsections like "Theory, Practice, Homework, Extra" would get a fake "next lab" (EMT0140 already has a "Theory" subsection).
Three shapes of a series, from the captured courses:
Shape
Example
How it shows
Subsections in one topic
IAS0230: "Lab 1 - Simple I/O" to "Lab 12", then "Lab Final - Game"
The current labs board, unchanged
Numbered activities in one topic
ITB8833 "Home assignments": "1. National digitalisation strategy", "2. Terms of use"
The same board, one card per numbered item; other rows stay below as normal rows
The course's topics
A weekly course, or one topic per lab
Topic chips get done, overdue and next marks; the course opens on the next one unless you picked a topic
Detection. A new pure module, src/data/series.ts, scores each candidate on four signals:
- Numbering: at least 3 siblings share a word plus a number ("Lab 3", "3. praktikum", "Week 5", "5. nädal", "HW2", "Kodutöö 2", "Harjutus 4", "Ülesanne 1", "Tund 5") or start with a number ("1. …"). Numbers mostly rise, and gaps are fine. A "Lab Final" with the same word joins at the end.
- Coverage: numbered members are at least 60% of their siblings.
- Work, not reading: members hold something to do (assignment, quiz, VPL, workshop, questionnaire) or have deadlines or completion tracking. "Lecture 1" to "Lecture 4" is reading and stays a list.
- Weekly format: a course in Moodle's weekly format is a topic-level series by definition, and the current week gets Moodle's own "This week" label.
A high score applies on its own. A medium score only offers a small "Labs | List" switch in the topic header. A low score does nothing.
Fail-safe rules.
- No activity is ever lost. Before showing a board, KEX checks that every activity of the topic appears exactly once. If not, it shows the plain list and notes why in diagnostics.
- A crash shows the list. The board sits in its own error boundary.
- Your choice wins. The "Labs | List" switch is remembered per course and topic.
- A global off switch in Settings: Labs view automatic or off.
- Tests on real markup. Detection runs on every course capture with its expected result. More captures make this much stronger (question 3 at the end).
## Item 3: achievements
Achievements reward real study progress from Moodle's own data and teach KEX's features along the way, each with a medallion badge drawn in the redesign's style.
Where they live.
- A Saavutused page at /my/#achievements: a sub-row under Dossier like Pinned materials, and in Ctrl K. A header band with your count (say 9 / 22), then groups under mono kickers (KURSUSED, LABORID, TÄHTAJAD, HINDED, KEX, HARJUMUSED). Each card has the badge, name, one line, and the date earned or a progress bar ("7 / 10"). Hidden ones show as "???" until earned, and a card links to where it was earned.
- The unlock moment. A toast slides in at the bottom right. The medallion pops in, its ring draws itself, a sheen sweeps across, and about 60 particles burst from it (the item 1 particle module). It shows the name, one line and a "Vaata" link, for 6 s. Several unlocks queue, at most 3 on screen, then "and 4 more". Reduced motion: no pop, no burst.
- First run. KEX checks what you've already done and unlocks it quietly, then shows one toast ("9 achievements found") that opens the page. No flood.
The badges. One SVG medallion family, so they read as a set: a 1 px ring carrying the hero's four "+" crosshair marks, a disc, and a Lucide glyph in the middle. Lucide is the icon set the UI already uses, so stroke and style match. Earned badges take their category's ink, and the top tier takes the hero's gradient ink with a slow sheen. Locked ones are outline only, glyph at 30%. Repeatable ones have tiers I, II and III.

A design sketch in our fonts and dark tokens, not a screenshot of built code: earned badges at tiers I to III, two in progress, one hidden, and the unlock toast frozen mid-burst.
The first set (22).
Achievement
Unlocks when
From
Esimene linnuke · First tick
your first activity is marked done
Moodle completion
Teema läbi · Topic cleared
every activity in one topic is done
completion
Poolel teel · Halfway
a course reaches 50%
course progress
Kursus läbi I–III · Course complete
1, 3, then all courses at 100%
course progress
Labor tehtud · Lab done
the first lab of a series is done
series (item 7)
Labori seeria · Lab streak
3 labs in a row done before their deadline
series, deadlines
Kõik laborid · Every lab
every lab of a course is done
series
Varajane lind · Early bird
handed in 48 h or more before the deadline
assignment status
Puhas leht · Clean slate
14 days with nothing overdue
calendar deadlines
Viimasel minutil · Photo finish (hidden)
handed in during the last hour
assignment status
Täispunktid · Full marks
100% on a graded item
grades
Kindel käsi · Steady hand
5 graded items at 90% or more
grades
Kiirotsing · Quick search
your first search with Ctrl K
KEX
Kinnitaja · Pinned
your first pinned material
KEX
Klaviatuuril · Keyboard pilot
10 different shortcuts used
KEX
Lugeja · Reader
a material read in the side reader
KEX
Uurija · Explorer
every course of the semester opened
KEX
Järjekindel · Steady streak
Moodle opened 5 weekdays in a row
local visit log
Varahommik · Early start (hidden)
studying before 7:00
local visit log
Öökull · Night owl (hidden)
studying after midnight
local visit log
Uus semester · Fresh start
first sign-in of a new semester
academic calendar
Kollektsionäär · Collector
15 achievements earned
achievements
How it works.
- Rules live in src/achievements/ as pure functions over one facts snapshot (courses, completion, deadlines, grades, KEX counters). They run in idle time after data refreshes, and each is easy to unit test.
- State sits in browser.storage.local per user: when each was earned, and progress. Nothing leaves the browser.
- Settings: achievements on or off, unlock toasts on or off, grade-based ones on or off (grades are personal).
- The names are ours, in Estonian and English, because Moodle has no words for these.
- If TalTech ever awards Moodle badges, they appear as their own group with Moodle's images. None of the captured pages link to badges today.
## What already exists
I searched for each piece first. Nothing does these inside a redesign like ours, so we build, but each part borrows what works.
Need
What exists
Verdict
Page-to-page transition
Cross-document view transitions: Chrome only, Firefox still in development. Same-document ones shipped in Firefox 144
Neither crosses the SSO sites, so the hand-off is ours. Same-document transitions power the theme switch
Particles
canvas-confetti: small, permissive licence, reduced-motion option. tsParticles confetti and fireworks bundles
Both throw generic confetti. Ours must rise from the ribbons' own light, so a small module of our own; canvas-confetti is the fallback for the badge burst
Moodle dark mode
Boost Dark: server plugin, Moodle 4.0 to 5.1. Moodle Dark Mode: 66 users, last updated July 2024. Dark Moodle: one university's Moodle. Dark Reader: any site
A server plugin needs TalTech to install it. The add-ons are generic and would fight our dark theme. Moodle has no core dark mode, and its forum names inline colours and bg-white as the hard parts, which is what 4c targets
Achievements
Level Up XP: points, levels, leaderboards, about 25,000 sites. Moodle's own badges
Server-side and set up by teachers, so KEX can't add them. KEX can show Moodle badges if TalTech awards any
Sticky "stuck" state
CSS scroll-state queries; an IntersectionObserver marker
Firefox lacks the first, so the second
Lab detection
Nothing found
Build it, with the fail-safes above
## Build order and questions
The fixes you'll notice every day come first. Each step is one commit on staging, synced to your PC through git, never a zip over the folder Codex works in.
- Fixes: the shader loop and login picture (item 2); pins in equal thirds, own course only, three per course with replace (item 5); the topic grid without scrolling (item 6, the in-place half).
- Course bar: the sticky row of topics and pins (items 5 and 6).
- Dark: sidebar and shell, the theme switch, the generated dark layer, teacher content and the dark audit (item 4).
- Series detection (item 7), tuned on whatever captures you can send.
- Sign-in hand-off with particles (item 1).
- Achievements with badges, toasts and the page (item 3).
Tests. Unit tests stay within the 120-test budget: series detection and pin rules get tests on real captures, achievement rules one test per data source. In Firefox: the shader reaches live on the login and a course, the dark audit passes, and the round 7 stability bench stays green with the course bar (nothing jumps when it appears). A real SSO can't run in the lab, so the hand-off is tested with the lab's form login.
If Codex has uncommitted work on the PC, have it commit before I sync.
Questions for you.
- Pins: three per course with a replace prompt (my pick), or no limit with a "+2 more" chip in the bar?
- Achievements: keep the grade-based ones and the hidden Night owl and Early start, or drop any of them?
- Captures: could you capture 3 or 4 more courses with the capture add-on? EMT0140, ITI8801 and IEE2630, plus any course with weekly exercises, would cover lab shapes I can't see yet. A forum discussion, an assignment and a quiz review page would also help the dark audit.

## As built (2026-10-26)

One commit per part on staging: 678dc5a (shader, pins, course bar), 526b61a (dark), aca5ba5 (series detection), 183b6aa
(sign-in hand-off), 47cd270 (achievements), then part 6 (school colours). The questions were not answered before the build,
so the recommended defaults stand: three pins per course with a replace prompt; all 22 achievements, with switches in the
options for unlock messages and for the grade-based ones.

### Item 8: shader colour by course code (asked after the plan)

- Course codes: three letters and four digits; the first two letters are the department, the first one the school. I = IT
  (blue), E = Engineering (gold), L = Science (pink), M = Business and Governance (green), V = Maritime Academy (teal),
  U = university-wide (graphite). Pre-2017 codes still running: Y and N science, T and H business and law, K and A
  engineering, MED/MES/MET/MHK engineering (old mechanical). The earlier map had M as Maritime and no L, U, N, H, K or A.
- Each three-letter prefix nudges its school's ribbons (src/lib/school.ts `ribbonsFor`): the hue turns up to 14 degrees
  (engineering only toward orange, never lime), the curves are up to 12% taller or flatter and 10% wider or narrower, and
  drift up to 25% more or less. Same prefix, same look, in every browser.
- Study level (bachelor, master) is not in the course code; it is in the programme code. The grey line under each course on
  My courses is the institute ("Arvutisüsteemide instituut"), not the level. With no reliable source, level does not change
  the look.
- Fallback pictures regenerated per school (`KEX_CHROMIUM=/opt/pw-browsers/chromium node scripts/render-fallback.mjs`).
