# Page designs: every student-facing page in the iteration3 language

**Legend.**
- **App:** our view rendered in `#kex-root`; Moodle's `#page-wrapper` is hidden but still live.
- **Skin:** Moodle's content stays in place inside our shell (sidebar and header), restyled by `src/styles/skin/*.css`.
- **Skin+:** skin plus our injected chrome (ActivityChrome or PageChrome) replacing Moodle's `#page-header`.

## 0. Shared pieces

**Shell (all logged-in pages):**
- sidebar and header (design-spec §4.1–4.2);
- the breadcrumb comes from `pageInfo.breadcrumb`, normalized: ⌂ → My courses → `<course code>` → `<NN topic title>` → `<activity>`; long middle crumbs collapse into "…" (popover);
- unread counts: a magenta 8px dot on the avatar and a `mono-s` count pill right-aligned in the Workspace nav item.

**PageChrome** (Skin+ for non-activity pages) replaces `#page-header` with:
- a 132px dark band (hero background, shader at 40% intensity, crosshair #2 only);
- mono label (e.g. `GRADES / ITI8801`);
- the title in display 300, 40px (one line, slide-up words);
- optional right-aligned outlined-light buttons (1.5px rgba(255,255,255,.5), white text).

Moodle's secondary navigation (`.secondary-navigation .nav-tabs`) is restyled as our tabs (17px, violet active underline) directly under the band.

**ActivityChrome** (Skin+ for `/mod/*`): the PageChrome band at 168px, containing:
- label: `<CODE> / TOPIC NN / <KIND> · <FORMAT>`;
- the title (display 300, 44px);
- a meta line (`body` `--kex-hero-link`): due/close dates from events, the completion state, and "Opened 2 h ago";
- right-side actions: [Pin] [Done] (manual completion; calls the same service) [Open in new tab] and, for files, [Download].
- Below the content, a sticky prev/next bar (48px, `--kex-border` top): "← 05 · Containers & Docker" | "Next: Deploy a service →", from the course state order. `[` / `]` keys.
- Moodle's `.activity-header` (completion, dates, description) is restyled as a compact info card under the band: a 1px border card with `mono-s` labels.

**Skin baseline** (`skin/base.css`, applies to every skin page under `:root[data-kex="skin"]`):
- **Hidden:** `nav.tt-level1`, `nav.navbar.fixed-top`, `#page-footer`, `.drawer-toggles`, `#theme_boost-drawers-primary`, `#theme_boost-drawers-courseindex`, `#page-navbar .breadcrumb` (our header has it), `.btn-footer-popover`, and the pink drawer handles. Blocks drawer `#theme_boost-drawers-blocks`: hidden, except where a page says otherwise.
- **Layout:** `#page-wrapper { padding: 67px 0 0 var(--kex-sb-w) }`; `#page.drawers { position: static; margin: 0; height: auto; overflow: visible; padding: 0 var(--kex-pad) 48px }`; `#topofscroll, .main-inner { max-width: none; margin: 0 }`; `.limitedwidth` gets max-width 1100px for readability on text pages.
- **Typography:**
  - body Inter 16/1.55 `--kex-text-2`;
  - h1–h3 Inter Tight (h1 40/300; h2 28/650 −0.03em; h3 20/600);
  - links `--kex-violet` with underline offset 3, hover `--kex-accent`;
  - `code`/`pre` in JetBrains Mono.
- **Bootstrap components:**
  - `.btn-primary` → `--kex-primary` (radius 3, 40px tall, 600);
  - `.btn-secondary`/`.btn-outline-*` → outlined 1.5px `--kex-outline`;
  - `.btn-link` → violet;
  - `.card` → 1px `--kex-border-card`, radius 2, no shadow;
  - `.form-control`, `.custom-select`, `.form-select` → 40px, 1px `--kex-search-border`, bg `--kex-bg`, radius 4, focus 2px `--kex-focus`;
  - `.table`/`.generaltable` → header `mono-s` uppercase `--kex-mono-soft`, rows 1px `--kex-border`, hover `--kex-hover`, numbers tabular;
  - `.nav-tabs` → our tabs;
  - `.badge` → 1px-bordered pills, `mono-s`;
  - `.alert-*` → left 3px bar (info violet, success #2f8f5b, warning #c47a00, danger `--kex-magenta`) on a tinted bg;
  - `.dropdown-menu` and `.popover` → popover styles;
  - `.modal-content` → radius 10, palette shadow, header in display 600 20px;
  - `.pagination` → mono numbers;
  - `.list-group` → hairline rows;
  - Font Awesome icons keep their glyphs, colored `currentColor`.
- **Dark theme:** the same selectors, using the dark tokens. Moodle user content with hard-coded colors (inline `style="color: blue"`) is left alone except `background-color: white`, which becomes `var(--kex-bg)` inside `.no-overflow`.

## 1. Login (`/login/index.php`): App
- Rebuilt; links and the form keep working.
- **Layout:**
  - left 58%: a full-height canvas running the ribbons shader (`uLeftFade 0`, `uIntensity 1.15`) over the hero gradient. Bottom-left: mono label `TALTECH / LEARNING ENVIRONMENT` (#c6c1d9) and display 300, 88px "Moodle" with "KEX" in gradient text on the second line.
  - right 42%: a panel in the sidebar gradient. Top-left: Moodle's logo (`.brand img`, `taltech_white.png`) at height 64. Top-right: language segmented EN/ET (Moodle's `#lang-dropdown` hrefs). Then:
    - mono `SIGN IN`;
    - display 300, 44px "Welcome back";
    - a 2×2 grid of 52px SSO buttons from `.potentialidp a` (same hrefs and titles). The last-used method (saved on click in page localStorage `kex.lastIdp`, default Uni-ID) is filled `#f7f6fa` with #201055 text; the others are outlined 1.5px `rgba(255,255,255,.55)` with white text. Keys `1`–`4`.
    - "More sign-in options ▾" (`M`) reveals Moodle's own `form#login`, moved into the panel (keeps `logintoken`), restyled: dark inputs #1b1334 with 1px #3a2e62 and 44px height; primary button "Log in".
    - "Help ↗" opens the TalTech service desk (from `.tt-level1` "Abi" if present) or toggles Moodle's `#faq-container`, restyled as a dark sheet.
- The EU cookie popup (`.eupopup-container`) is restyled as a bottom dark toast. Its buttons keep working.
- **Lab** (stock Moodle login): `form#login` with username and password shown directly; identity providers from `.login-identityproviders`.
- **States:** a Moodle login error (`#loginerrormessage`, `.alert-danger`) shows as a magenta-bar alert above the buttons. Already logged in (Moodle shows "You are logged in as…"): a single "Continue to Workspace" button.

## 2. Workspace (`/my/`): App
- **Data:**
  - courses + prefs;
  - `core_calendar_get_action_events_by_timesort` (−14 d … +60 d);
  - `block_recentlyaccesseditems_get_recent_items` (9);
  - `message_popup_get_popup_notifications` (20) and counts;
  - pins;
  - course progress (from the course list).
- **Hero** (253px):
  - label `WORKSPACE / THU 15 OCT · WEEK 7` (week = ⌊(now − earliest current course startdate) / 7 d⌋ + 1);
  - title line 1 "Good evening, Marten" (morning < 12, afternoon < 18, evening);
  - line 2 (gradient) the summary: "2 due this week" / "1 overdue · 2 due this week" / "Nothing due this week";
  - links: "Calendar ↗", "Grades ↗", "Notifications 34 ↗".
- **PINNED row:** identical to the course page.
- **"This week"** h1 + tabs Everything / Deadlines / Updates (`1`/`2`/`3`; hash).
- **Left column (328px), label `COURSES`:** one 64px row per sidebar course:
  - mono code (11px), name (`list` 17px, one line), a 2px progress bar (`--kex-border` track, `linear-gradient(90deg,#6d4dff,#c114fe)` fill) with `mono-s` "%" right;
  - second line `small` `--kex-text-3`: "Next: Lab 6 · Thu" or "No deadlines";
  - active-row style on the course with the nearest deadline; Enter opens the course.
- **Right column:** label `UP NEXT` (or `DEADLINES`, `UPDATES`) + counter `N ITEMS`. Rows use the resource-row anatomy:
  - **Deadline row:**
    - thumb = date tile (134×92, doc background): day number display 700 44px `--kex-violet` and `mono-s` "OCT · THU"; magenta number and "OVERDUE" when overdue; a 3px magenta top edge when due within 48 h;
    - label `ASSIGNMENT / ITI8801`;
    - title (activity name);
    - subtitle "Due Thu 15 Oct, 17:38 · in 2 days";
    - actions Pin | Done (if manual) | "Open course";
    - button: "Submit ↗" (filled for the first row) when `action.actionable`, else "Open ↗".
  - **Continue row:** kind thumb; label `LECTURE / PDF · ITI8801`; subtitle "Opened 2 h ago"; Preview | Pin; "Open ↗".
  - **Update row:** a 134×92 thumb with a 28px glyph (`megaphone` for announcements, `bell` otherwise); label `ANNOUNCEMENT / IAS0230`; title = subject; subtitle = `smallmessage` (2 lines); actions "Mark read" (`m`); button "Read ↗" → `contexturl`.
- **Empty states:**
  - "Nothing due in the next 14 days. Enjoy it." with a Calendar button;
  - "No recent materials yet";
  - "You're all caught up".
- **Loading:** skeleton rows (3) under cached content, or alone.
- **Error:** inline error state in the column with Retry.

## 3. Pinned materials (`/my/#pinned`): App
- PageChrome band: label `PINNED MATERIALS / 7 ITEMS`, title "Pinned".
- Grouped by course (`mono-wide` group headers "ITI8801 / CLOUD & DEVOPS") with resource rows (thumb by kind; the button opens the material).
- **Edit mode** (`e` or the "Edit" button): each row gets a drag handle (`grip-vertical`), rename (F2, inline input), remove (×); `Alt+↑/↓` reorder; "Done" exits.
- Toolbar: "Export JSON", "Import JSON" (options page handles the files).
- Empty: kicker `NO PINS YET`, "Press P on any material, or use the pin icon. Pins stay across courses."

## 4. My courses (`/my/courses.php`): App
- **Data:** the timeline classification per tab; favourites (`core_course_set_favourite_courses`); hide/show via `core_user_update_user_preferences` (`block_myoverview_hidden_course_<id>`).
- PageChrome band: `MY COURSES / AUTUMN 2026`, title "My courses".
- **Tabs:**

  | Tab | Classification |
  |---|---|
  | Current | mirrors Moodle's own grouping (customfield `is_archived = -1` at TalTech, else `inprogress`) |
  | Starred | `favourites` |
  | Upcoming | `future` |
  | Past | `past` |
  | Archived | customfield value 1, when that field exists |
  | Hidden | `hidden` |
  | All | `all` |

- **Filter input** (`f` focuses it) filters by code, name or category, diacritic-insensitive.
- **Dense list rows (64px):**
  - 64×40 course image (`courseimage`, radius 3);
  - mono code; name (`list`); category `small` `--kex-text-3`;
  - progress bar 120px with %;
  - last access `mono-s`;
  - star toggle (`s`); hide (`Shift+H`, with Undo toast).
  - Enter opens.
- Sort segmented control: Last accessed / Name / Code.

## 5. Course page (`/course/view.php`): App, all formats
Topics, weeks and tiles all render the iteration3 layout.

**Data:**
- `core_courseformat_get_state` gives sections and cms (normalizes every format);
- batched `core_course_get_module` for the selected topic's cms, prefetching neighbours on idle; fallback: `/course/section.php?id=` HTML;
- page DOM: tile photos (`li.tile` background-image), section summaries (`.summarytext`);
- `core_calendar_get_action_events_by_course` for due labels.

**Layout:** exactly design-spec §4.3–4.9.

**Format-specific notes:**
- **weeks:** the section title is the week name. If `title` is a date range only (e.g. "12 October – 18 October"), the topic row shows "Week N" and the date range in `small` under the detail title.
- **tiles (IAS0230, MMO5770):**
  - topic rows show the 40×28 tile photo;
  - the topic detail shows the photo as a 160×100 image right of the title (radius 4);
  - the tiles banner label (section 0 image) appears in the Course info panel only;
  - subtiles (`format-tiles-subtiles`) are cms, so no special handling.
- **Subsections** (Moodle 4.5 `mod_subsection`, `section.component = "mod_subsection"`): rendered inside the parent topic as a `mono-wide` group header plus its rows. They are not top-level topics.

**Course info (key `0`, hero link):** the detail pane shows section 0:
- label `COURSE INFO`;
- title = section 0 name, or "Course info" when the name is "General" or "Üldine";
- the section summary (sanitized);
- rows for its cms (announcements forum first);
- no topic row is active.

**Hero links:**
- Course info → section 0.
- Recordings → the first section whose title matches RECORDING_RE (select it), else the first cm whose kind is recording (open it, new tab). Hidden if neither exists.
- Grades → `/grade/report/user/index.php?id=<courseId>`.

**Edit mode** (teachers, `body.editing`) → mode off (Moodle's editor). Not a student path.

**States:**
- first visit with no cache: hero, tabs and topic skeletons;
- zero sections: empty state;
- get_state fails: switch to skin ("Moodle layout in KEX") with a toast.

## 6. Section page (`/course/section.php?id=`): App
Same as the course page, with that section preselected. The URL is kept; switching topics updates `#topic-N` only.

## 7. Activity pages (`/mod/<mod>/…`): Skin+ with ActivityChrome
| Module/page | What we do |
|---|---|
| resource `view.php` | If Moodle shows an intermediate page (embed/"click to open"), replace the content area with a full-height (`calc(100vh - 67px - 168px)`, min 600) iframe of the file URL from `.resourceworkaround a`, `object[data]` or `iframe#resourceobject`. PDF opens in Firefox's viewer. Plus a [Download] action (`?forcedownload=1`). Non-previewable types: a card with file name, type, size and Download. |
| url `view.php` | A card: favicon-less globe glyph, external domain `mono`, full URL `small` (copy button `c`), primary "Open ↗" (new tab). Moodle's intro is shown as the description. |
| page | Moodle's `.box.generalbox` content as a readable article (max-width 760, ui 17/1.7, display headings); "Last modified" as a `mono-s` meta line. |
| book | Content as an article. The chapter TOC (Moodle's `.book_toc` block) becomes a sticky left list in topic-list style (numbers and titles, active bar). `←`/`→` map to Moodle's prev/next links. |
| folder | Moodle's tree (`.foldertree`) restyled as rows: icon + name + size; "Download folder" as the primary button. |
| assign `view.php` | Moodle's submission status table becomes a key/value card (labels `mono-s`, values `body`). Status pills: "Submitted" violet, "No attempt" grey, overdue magenta. Due countdown in the chrome meta. "Add submission"/"Edit submission" as the primary button. Feedback section as an article. |
| assign `action=editsubmission` | Keep Moodle's form. Restyle `.fp-*` filemanager (dashed drop zone, 1px violet when dragging) and the editor toolbar border. Save = primary, Cancel = outlined. `Ctrl+Enter` clicks `#id_submitbutton`. |
| quiz `view.php` | The attempts table is restyled. The "Attempt quiz"/"Continue" button is primary. Timing info sits in the chrome meta. |
| quiz `attempt.php`, `summary.php` | **Focus mode:** sidebar becomes the rail, the chrome shrinks to the breadcrumb only. Moodle's `#mod_quiz_navblock` (from the blocks drawer) is shown as a sticky right rail of 260px (question number buttons as 32px mono squares: answered violet, flagged magenta corner). The timer `#quiz-timer` is restyled as a mono pill in the header area. KEX hotkeys are off except `Ctrl+K` and `Alt+Shift+O`. Moodle's form, autosave and submission are untouched. |
| quiz `review.php` | Questions as cards: correct green bar, incorrect magenta bar, partial amber. Mono marks. |
| forum `view.php` | `table.discussion-list` restyled: rows 56px, unread dot magenta, author `small`, last post `mono-s` relative time, pinned star. "Add discussion topic" is the primary button. |
| forum `discuss.php` | Posts become cards: author avatar 32px, name 600, time `mono-s`, content as an article, reply/edit links as small outlined buttons. Moodle's inline reply JS is kept. |
| forum `post.php` | Keep the form; restyle it. |
| lesson | Content area as an article; buttons restyled. |
| h5pactivity, h5p embed | Iframe container full width, radius 4, 1px border. |
| scorm | The player page is restyled minimally (the TOC tree in topic-list style). The iframe is untouched. |
| choice, feedback, survey | Forms restyled; result charts left as is. |
| glossary, wiki, data | Tables, lists and forms restyled; tabs as our tabs. |
| lti | Launch page or iframe left as is inside the chrome. Recording-like tools (Echo360) get "Watch ↗". |
| bigbluebuttonbn, zoom | The "Join" button becomes primary; recordings table restyled. |
| label | Never a page. |

## 8. Grades
- **Overview** (`/grade/report/overview/index.php`): **App**.
  - Data: scrape `#overview-grade` table rows on this page (course link, grade).
  - Layout: PageChrome band `GRADES / AUTUMN 2026`, "Grades". Tabs Current / All (Current = sidebar courses).
  - Rows (topic-list style, 56px): mono code, course name, grade right-aligned (JetBrains Mono 600, 20px), arrow. Enter opens the course user report.
- **User report** (`/grade/report/user/index.php?id=`, `/course/user.php?mode=grade`): **Skin+** (PageChrome `GRADES / ITI8801`).
  - `table.user-grade`: category rows tinted `--kex-tint` with `mono-s` names; item rows 44px; numeric columns tabular mono and right-aligned; feedback cells as sanitized text; the "Course total" row bold with a top border.

## 9. Calendar (`/calendar/view.php`): Skin+
- PageChrome `CALENDAR / OCTOBER 2026`. Moodle's view switch becomes our tabs (Month / Day / Upcoming → the same URLs with `view=`).
- **Month table (`.calendarmonth`):**
  - 1px `--kex-border` grid, day numbers `mono-s` at the top-left;
  - today: day number in a 24px `--kex-primary` circle with white text;
  - events as 22px pills (`small`), with a left 3px bar: course events violet, due events magenta, user events grey;
  - "more" link `mono-s`.
- Moodle's JS (event popovers, navigation) is kept.
- The upcoming view list is restyled as rows.

## 10. Notifications (`/message/output/popup/notifications.php`): App
- **Data:** popup notifications (paged 20); mark read / all.
- **Layout:**
  - PageChrome `NOTIFICATIONS / 34 UNREAD`;
  - two columns: left list (380px) with rows 64px (unread magenta dot + 600 subject; `mono-s` "FORUM / IAS0230 · 2 H");
  - right detail: subject in display 650 28px, meta, `fullmessagehtml` sanitized as an article, primary "Open ↗" (`contexturl`), "Mark unread" is not available (Moodle has no such API).
- Keys: `j`/`k`, Enter, `m`, `Shift+M`.

## 11. Messages (`/message/index.php`, message drawer): Skin
- Moodle's messaging app is kept.
- Restyled: the conversation list (rows 56px, avatars 32px, unread pill), message bubbles (own: `--kex-primary` with white text; others: `--kex-tint`), and the composer as an input style with a primary send.

## 12. User profile, preferences, edit profile, notification preferences, private files: Skin+
- PageChrome (`PROFILE`, `PREFERENCES`, …).
- Profile sections (`.profile_tree section`) become cards in a 2-column grid at ≥ 1280.
- Preferences links become a list of rows with chevrons.
- Forms are restyled.
- Private files: filemanager restyled as for assignments.

## 13. Course participants (`/user/index.php?id=`, body id `page-course-view-participants`): Skin+
- PageChrome `PARTICIPANTS / IAS0230`.
- The filter UI is restyled (selects and inputs). `table#participants`: avatar 28px, name 600, roles as `mono-s` pills, last access `mono-s`. Paging bar restyled.

## 14. Search
- **Global search** (`/search/index.php`, if enabled) and **course search** (`/course/search.php`): Skin+ (PageChrome `SEARCH / "query"`). Results as rows with a mono course code.
- The header search always opens the KEX palette. The palette's footer offers "Search Moodle for "q" ↵" (`Shift+Enter`), which goes to `/course/search.php?search=q`.

## 15. Badges (`/badges/mybadges.php`, `/badges/view.php`): Skin+
Badge images in a grid of 160px cards (1px border, name 600, issuer `small`, date `mono-s`).

## 16. Site front page / catalogue (`/?redirect=0`, `/course/index.php`): Skin+
- PageChrome `CATALOGUE`. Category tree in topic-list style; course boxes as rows with a mono code.

## 17. Errors, notices, maintenance: Skin+
- Detection: `.errorbox`, `#notice`, `body.pagelayout-maintenance`, or Moodle's "Error" page heading.
- Content: kicker `ERROR / <errorcode or HTTP status>` in magenta mono, the title in display 300 40px (Moodle's message), and detail text. Buttons: "Back" (history.back), "Workspace", and Moodle's "Continue" link if present.
- `requirelogin` redirects land on the login view.

## 18. Generic fallback (any other page): Skin
- The skin baseline (§0) plus PageChrome, using the Moodle h1 as the title and the breadcrumb's second-to-last item as the label.
- **Guarantee:** sidebar, header, palette, theme and keyboard work everywhere; Moodle content stays functional and readable in both themes.
