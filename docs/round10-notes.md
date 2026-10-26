# Round 10: the course as one page, jumps measured in real Firefox (2026-10-26)

User feedback: after signing in, opening a course, scrolling a little and switching topics, one or two clicks threw the page to
the top; benches kept passing while the real site jumped. Stock Moodle shows ITB8833 almost whole on one page where KEX showed
one topic (and one lab) at a time. Long lists should turn away like the iPhone clock's picker, as a setting. The sign-in fade
worked only the first time; after that the white came as a cut. Plan: [round 10 plan](https://claude.ai/artifact/5nRcRbTvNAj9BUGDDfB9Fv).

## How it is tested now

`test/live/` drives the tester's own Firefox (159 beta) against live moodle.taltech.ee: geckodriver, a separate profile the tester
signs in to, real wheel scrolls and mouse clicks at screen positions (nothing is scrolled into view first), and a recorder in the
page that notes the scroll position and every tracked block's place each frame. `npm run audit:live` fails a scenario on a scroll
change nobody asked for or on anything moving more than 4 px in one frame by itself. The old benches missed the topic jump because
they ran Chromium on saved pages with no network delay, clicked topics from the top of the page, and clicked once.

## What was wrong, and what changed

| Found in Firefox | Cause | Now |
| --- | --- | --- |
| Second topic click: 350 to 150 px (IAS0230), 65 to 0 (ITB8833) | The topic switch let go of the held height before measuring; Firefox clamped the scroll | The course is one page; a topic click glides there. Nothing is swapped |
| Empty space under short topics | The held height was never released | No held heights; a fold near the end holds the page only until the reader scrolls up |
| Materials drop 294 px when a topic banner loads | Banner without a reserved size | Topic pictures are fixed-size thumbnails in the outline |
| Column slides 9 px sideways on opening a course | Windows' 17 px scrollbar appearing | `scrollbar-gutter: stable` on app pages (not the login) |
| One-frame cut and a placeholder flash on page changes | Cached course read after the first render; exit fade spent inside the long frame | Course read before the first paint; the old page's cover holds until the new view is in, then a 180 ms crossfade; the cover copies only what is on screen |
| 0.6 s freeze opening My courses or the Dossier | WebGL context created in the middle of the page change (the band also had its own canvas) | The band uses the shared canvas; the context is built when the page is first idle |
| My courses cards reshuffle; list drops 68 px | Fresh "last opened" order applied live; Archived tab added a frame late | Order frozen while the view is open (the course just left is noted at once); tab known before the first paint |
| Text reads through the header | Compact header 82 % opaque | 96 % of the page colour |
| Menu fold: course entries jump 63-85 px | Entries change shape between full menu and rail | The list fades through the change |
| Repeat sign-in: purple to white in one cut | Login left after 380 ms while the 220 ms + 560 ms wash was 3 % in | The white starts on the press, is complete in 240 ms, and only then does the browser leave |

## The course page

Every topic in Moodle's order with its materials under it; tile courses too. Wide columns pin an outline of the topics beside the
page, narrow ones the topic bar under the header; both light up the topic being read (scroll spy) and glide to a topic on click.
Topic clicks update the address (`#topic-N`) without adding Back steps. The page reopens where the reader left it (`ui:{course}`
anchor: topic and offset, 14 days), before its first paint; an address with a topic or `#module-N` wins. Compact rows are the
default (settings stored before round 10 get them once). Labs: every lab shown, finished ones folded. Topics fold like Moodle's
"Collapse all". Scroll anchoring is on for the course page.

## The wheel

`components/wheel.css`: rows near the top and bottom of the window turn away on a drum and fade, through scroll-driven animations
(`animation-timeline: view()`), so Firefox runs them with the scroll and nothing in the layout changes. On for long pages
(`data-kex-long`), when the setting is on, effects are not off and motion is not reduced. Folds use `overflow: clip` so the rows
follow the window, not their fold.
