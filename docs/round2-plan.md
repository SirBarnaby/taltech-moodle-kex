# Round 2 plan (user feedback from the real moodle.taltech.ee, 2026-10-16)

Planned on Opus (high effort); implemented on Sonnet (high effort).

## Recon findings (what causes each complaint)

| # | Complaint | Root cause found |
|---|-----------|------------------|
| 1 | Everything is in English | `settings.uiLanguage` defaults to `'en'` (`src/lib/settings.ts:33`); the page language is never read. Our own en/et tables also put invented wording on screen. |
| 2 | Blank screen between pages | Every click is a full reload. The gate hides `<body>` until settings, preload and data resolve. The gate background falls back to `#fbfbfd` even in dark mode (`src/styles/gate.css`). |
| 3 | "Everything / Lectures / Labs" is useless | It is our own name-based guess (`src/data/classify.ts`) — overfitting by definition. |
| 4 | Section graphics missing | Tile photos are scraped (`scrape/tiles.ts`) but only feed a small thumb. Banner images in labels and section summaries are dropped because we rebuild rows from `get_state` instead of showing Moodle's HTML. |
| 5 | Subsection content missing | `cmsOfSection` (`data/repo/coursestate.ts`) matches a subsection by `section.itemid === cm.id`. On 4.5, `itemid` is the *subsection instance id*, not the cm id, so the lookup misses and the cms vanish. |
| 6 | House rules missing (ITB8833) | That is section 0 renamed "House Rules", with its text in the section summary. Section 0 is treated as hidden course info, and summaries are not rendered. |
| 7 | Participants / grades not reachable | The course secondary nav (`data-key` = participants, grades, competencies, …) exists in the DOM, in Moodle's own language, and we don't show it. |
| 8 | /my/ vs /my/courses.php redundant; picker navigates away | The Workspace course chip links to the course instead of filtering. Deadlines are one flat list. My courses has no sidebar entry. |
| 9 | Hero repeats the breadcrumb | The hero eyebrow (`ITI8801 / AUTUMN 2026`) and title duplicate the header breadcrumb. |
| 10 | Same shader everywhere | One palette and seed for all courses. |
| 11 | Two "Settings" buttons; preferences and calendar buried | One in the sidebar footer and one in quick settings/user menu. Calendar, preferences, messages and files only live in the user menu. |
| 12 | Logged-out pages, settings menus, other pages unstyled | The lab runs **Moodle 5.3 / Bootstrap 5**; production is **4.5 / Bootstrap 4** (`taltech4_boost`). Skin selectors were verified only against 5.3 markup, so dropdowns, action menus and guest headers on 4.5 miss. |

## Principles for this round

- **Moodle's words, not ours.** Any label Moodle already has comes from Moodle in the page's language. That means headings, nav entries, section names, module type names and course tabs. They are read from the DOM or from `core_get_strings` (an AJAX, no-login web service), cached per language. Our en/et tables only keep strings Moodle has no equivalent for (palette hints, toasts). Nothing is name-classified any more.
- **Show Moodle's content, restyled.** Section summaries, labels, banners and tile photos are Moodle HTML. They are moved into our layout (sanitised, as `lib/sanitize.ts` already does), not re-written.
- **Language follows Moodle.** The default is the page's `<html lang>`. The option becomes "Follow Moodle / Eesti / English".

## Work packages

### A. Course page fidelity (owner: agent A) — `src/data/*`, `src/ui/views/Course.tsx`, `src/ui/components/{TopicList,ResourceRow,ItemRow}.tsx`, `src/state/course.ts`, `src/actions/course.ts`, `src/styles/course/*`
1. Subsections: resolve by `cm.delegatesectionid` (4.5 state field). Fall back to the section with `component === 'mod_subsection'` whose title equals the cm name. Render each subsection as a nested, titled group card inside its parent topic, with its own summary and progress.
2. Section 0: when it has a custom title, a summary or cms, it becomes the first topic under Moodle's own title (e.g. "House Rules"), not a hidden info panel.
3. Section summaries and labels are rendered as sanitised Moodle HTML (images included) above and between rows. Tile photos become the topic header image and the topic list thumbnail.
4. Replace the Everything/Lectures/Labs tabs with the course's own secondary nav, read from Moodle's DOM: Course, Participants, Grades, Competencies, more. Each keeps Moodle's label and URL. Course stays in-app; the others are hard links styled as tabs.
5. Row eyebrows show Moodle's localised module name (from the activity's `.accesshide` / `activityname` type text or the module icon `alt`), not LECTURE/LAB. Delete `inTab`/tab classification; keep `classify` only for icon/thumb choice and verbs.
6. Tests: unit tests for subsection resolution (4.5-shaped fixture: `itemid ≠ cm.id`), section 0 promotion and secondary-nav scrape from `captures/pages/course_view__id-37829.html`.

### B. Shell, navigation and Workspace (owner: agent B) — `src/content/*`, `src/ui/shell/*`, `src/ui/components/Hero.tsx`, `src/ui/views/{Workspace,MyCourses}.tsx`, `src/fx/*`, `src/styles/shell/*`, `src/styles/gate.css`, `src/lib/settings.ts`, `src/i18n/*`, `src/options/*`
1. **Language:** the default is `uiLanguage: 'auto'`, which follows `<html lang>` (et or en). Add a `moodleStrings` module that calls `core_get_strings` once per language with a fixed key map and caches it for 7 days. `t()` prefers Moodle's string for mapped keys. Mapped keys: dashboard, mycourses, calendar, grades, notifications, messages, profile, preferences, privatefiles, participants, search, login, logout, home, settings.
2. **No blank between pages:**
   - (a) The gate background comes from the cached theme, written to the page origin's `localStorage` by our script. It is read synchronously at `document_start`, so a dark user never sees white.
   - (b) Render from the SWR cache immediately and don't block first paint on network data.
   - (c) Soft navigation between app views (course to course, Workspace, My courses, grades, notifications). Intercept same-origin clicks, `history.pushState`, swap the view in place, and handle `popstate`. Pages Moodle must run itself (skin routes) stay hard loads.
   - (d) Warm hard loads with `<link rel=prefetch>` on link hover.
   - (e) Hard loads keep the header and sidebar painted, via a cached shell snapshot, until the new view mounts.
3. **Sidebar:** add My courses (`/my/courses.php`), Calendar, Messages (with unread count), Grades and Preferences as first-class rows, with labels from Moodle. Remove the duplicate settings entry: the sidebar keeps one Settings item, which opens KEX quick settings with a link to Moodle preferences. The user menu keeps profile, language and log out.
4. **Workspace (/my/):**
   - Deadlines are grouped by course under course headings.
   - The course chip filters the Workspace in place (a URL param, no navigation), and "All" clears it.
   - My courses (/my/courses.php) is the full course grid. The Workspace shows a compact "Courses" strip that links there, so the two pages no longer overlap.
5. **Hero:** drop the eyebrow and crumb duplication. The hero shows the course title and a meta row in its place: teachers (from the course contacts, Moodle data), course progress %, next deadline, and the course's own quick links.
6. **Faculty themes:** the school comes from the first letter of the course code (TalTech convention).
   - I = Information Technology: cyan/violet ribbons.
   - E = Engineering: amber/copper, a sharper ribbon.
   - Y = Science: green/teal, a slower wave.
   - T = Business: indigo/gold.
   - V or M = Estonian Maritime Academy: navy/sea-blue, a horizontal swell.
   - Anything else = default.
   Each school sets a palette, a ribbon seed and shape parameters, and the course accent colour. This is a toggle in options ("Colour courses by school", default on).

### C. Real-markup lab and skin coverage (owner: agent C) — `tools/lab/*`, `/home/claude/moodle-lab*`, `src/styles/skin/*`, `src/actions/skin*.ts`, `src/content/skin*.ts`, `src/ui/views/{Login,SkinChrome}.tsx`, `test/e2e-firefox/*`
1. Stand up a second lab on **Moodle 4.5** (`erseco/alpine-moodle` 4.5 tag) on :8081, with the `et` language pack installed and the user's language set to et. Seed format_tiles and the user's six courses. Include a topics course whose section 0 is titled "House Rules", and a course with `mod_subsection`.
2. Recon pass in real Firefox (Selenium) across both labs, light and dark. Cover:
   - the logged-out front page and header login button;
   - every user-menu destination;
   - preferences and its sub-forms;
   - course "More" menu pages: participants, grades, competencies, badges, reports, course settings;
   - action-menu and dropdown popovers; calendar; messages drawer; private files;
   - the forum discussion, assignment, quiz, page, URL, folder, book and choice activities.
   Screenshot each into `artifacts/round2/` and list every unstyled control.
3. Fix the skin for everything the recon finds, with Bootstrap 4 *and* 5 selectors. This includes dropdown menus, `.action-menu`, `.moremenu`, modals, the guest header and login button, `.secondary-navigation` and form controls.
4. Extend the Firefox smoke to the 4.5 lab.

## Order and integration
- A, B and C run in parallel on separate files. Shared files (`src/styles/index.css`, `src/i18n/*`) are owned by B. A and C send B the new string keys and CSS imports they need in their final report, and the lead merges them.
- Commit to the local `staging` branch. Each agent commits only its own files, with `git add <paths>`.
- After merge: `npm run build`, vitest, the Firefox smoke on both labs and the visual diff (iteration3 thresholds must still pass). Then sync `dist/firefox` to the PC.
