# Current design: moodle.taltech.ee today

Sources:
- `how_the_website_looks_like_now/*.png`: 6 screenshots, 1854×1080, Firefox on Windows.
- `captures/pages/*.html`: rendered page HTML (DOM) after JS has run.
- `captures/css/theme_styles_php_taltech4_boost_1791885836_1788332547_all.css`: TalTech's full theme CSS, 2 MB.

## Platform facts (verified in the captures)

| Fact | Evidence | Why it matters |
|---|---|---|
| Moodle 4.5 line | `M.cfg.apibase = "https://moodle.taltech.ee/r.php/api"` (router introduced in 4.5); `lib/jquery/jquery-3.7.1` | Design for 4.5; stay compatible with 4.1–5.x |
| Bootstrap 4 markup | `data-toggle=`, `.sr-only`, `.mr-*`/`.ml-auto`, zero `data-bs-*`; some BS5 utilities (`ms-1`, `me-2`) mixed in | Lab (5.3) uses BS5 (`data-bs-toggle`, `.visually-hidden`); selectors must accept both |
| Theme `taltech4_boost` (Boost child) | `M.cfg.theme`, CSS URL | Boost drawers layout: `#page.drawers` is the scroll container |
| `M.cfg` in `<head>` | `sesskey`, `userId: 333286`, `courseId`, `contextid`, `language: "et"`, `usertimezone: "Euroopa/Tallinn"` (localized, not IANA) | sesskey and user id available before `<body>` exists |
| Language | Site default `et`; some courses force `en` (`lang-en` on ITB8833, MMO5770) | Moodle UI strings arrive in mixed languages |
| Course formats | `format-topics` (ITB8833), `format-tiles` (IAS0230 photo tiles; MMO5770 `format-tiles-subtiles`) | Must normalize formats into one topics UI |
| Body ids | `page-my-index` (both `/my/` and `/my/courses.php`, the latter has class `page-mycourses`), `page-course-view-tiles`, `page-course-view-topics`, `page-course-view-participants` (that is `user/index.php`!), `page-mod-forum-view`, `page-login-index` | Route by path first, body id second |
| Body classes | `pagelayout-*`, `course-<id>`, `context-<id>`, `cmid-<id>`, `cm-type-<mod>`, `format-*`, `category-*`, `jsenabled` | Cheap page metadata |
| Dashboard blocks | `advnotifications`, `searchcourses`, `recentlyaccessedcourses`, `timeline`, `myoverview`, `calendar_month`, `news_items` (site news, last post 2025), 2× `html` | Dashboard is a long stack of generic blocks |
| Course page blocks | `completion_progress`, `news_items`, `activity_results`, `calendar_month`, `calendar_upcoming` | Hidden in the right block drawer |
| Current-course filter | myoverview grouping = `customfield`, `data-customfieldname="is_archived"`, value `-1` ("Arhiveerimata"); sort `ul.timeaccess desc`; paging 12 | The user's six current courses: 37582, 38175, 37981, 38420, 37829, 37791 |
| Enrolment history | Calendar course filter lists about 30 courses from 2022 to 2026 | The sidebar must show only current courses |
| TalTech custom chrome | `nav.tt-level1` utility bar (`.tt-level1__link`: Veeb, ÕIS → ois2.ttu.ee, Moodle, E-mail → mail.ttu.ee, Abi); `#topbar-username` | Source for the sidebar's ÕIS and Email links and the user name |
| Login | Custom TalTech page: `.potentialidplist .potentialidp a` (TalTech Uni-ID `/auth/oidc/?source=loginpage`, ID-kaart, Mobiil-ID, Smart-ID via `/auth/tara/login.php?scp=…`); hidden `form#login` behind `#show-more-login-options`; `#lang-dropdown`; FAQ `#faq-btn`; EU cookie popup `.eupopup` | Login is SSO-first |

## Page inventory (what the student sees)

1. **Login** (`/login/index.php`). Left about 70%: a full-bleed neon-tubes photo. Right: a purple (#342c61) panel with a cyan (#51bfd3) divider, white TalTech logo, "Logi sisse", four white-outlined pill buttons in a 2×2 grid, and a "Rohkem sisselogimise võimalusi ▾" disclosure. "ABI" tab and "EESTI (ET)" language menu.
2. **Dashboard "Töölaud"** (`/my/`). Greeting, a cyan info alert (FAQ link), a "Kursuste otsing" search card, a "Viimati külastatud kursused" carousel (2 large image cards), then the "Ajajoon" timeline far below the fold, then "Kursuste ülevaade".
3. **My courses** (`/my/courses.php`). A single myoverview block: grouping dropdown, list rows with 120×80 course image, pink course link, department, and "15% valmis".
4. **Course page, topics/weeks** (ITI8801, coursepage-1). Extrabold title "ITI8801 Cloud Architectures and DevOps (2026 autumn)". Secondary tabs Kursus / Osalejad / Hinded / Pädevused (pink underline). Collapsible grey section bars. Activity cards with 66px colored icon tiles (pink forums, purple files and URLs), an uppercase grey type ("FOORUM", "URL", "FAIL"), and a separate "PDF" line.
5. **Course page, tiles** (IAS0230, var1/var2). A banner label image, a welcome text, and section-0 activities. Then a 5-column grid of photo tiles (≈310×230) with purple title chips, "Edenemine: 0%", and an "Üldine edenemine %" ring. Tiles open their content in a popup or detail view.
6. **Forum view** (Announcements). Breadcrumb, a "Forum" kicker over the h1, a secondary nav ("Don't track unread posts"), a search box, and the discussion table (Discussion / Started by / Last post / Replies).
7. **Participants** (`user/index.php`). Filter UI and a participants table.
8. **Drawers on every page.** Pink round handles (#e4067e) on the left (course index) and right (blocks).

## Visual system today

- **Utility bar.** White, 35px; links with cyan (#4dbed2) ↗ arrows; the active "MOODLE" item in pink.
- **Navbar.** 57px, #342b60. White TalTech wordmark, then Kataloog / Töölaud / Minu kursused, a bell with a red count (34), a chat icon, the name, and an avatar.
- **Page.** Background #ebeaef. The content column is centred and about 930px wide (`limitedwidth`), so about half of a 1854px screen is unused. Cards are white with no visible radius.
- **Type.** Proxima Nova Regular, Bold, Extrabold and Black (OTF from the theme); page titles use Extrabold. Bootstrap blue (#0f6cbf, #1177d1) still leaks into links and primaries.
- **Accent colors.** Purple #342b60, pink #e4067e, cyan #4dbed2. The Bootstrap palette remains: red #ca3120, green #357a32.
- **Footer.** Purple, with terms and a mobile-app link.

## Pain points (factual)

1. **Width wasted.** The content is about 930px on a 1854px display; the dashboard needs 3+ screen-heights of scrolling to reach the timeline.
2. **Deadlines buried.** The timeline sits below course search and the recent-course carousel; the "34 unread" notifications pile up in a popover.
3. **No cross-course search.** The search block only matches course names. There is no way to find "Kubernetes slides" without opening the course.
4. **Inconsistent courses.** Topics, weeks and tiles formats each navigate differently. Tiles hide materials behind a click and a modal; the course index is a collapsed drawer.
5. **Low information density.** Each activity is a 66px-tall card; the file type appears twice ("FAIL" then "PDF"); dates and completion are scattered.
6. **No keyboard model.** No shortcuts, no list navigation, no command palette.
7. **URL and file links open 1000×600 popups** (`onclick="window.open(…)"`).
8. **Long names.** Course names carry codes and semester suffixes ("MMO5770 MMO5500 Management and Leadership (2026 sügis)") and are truncated on cards.
9. **Mixed languages.** Estonian and English appear in one view ("Märgi tehtuks" next to English course content).
10. **No dark theme, no reduced-motion handling, and heavy pages.** The dashboard DOM is about 400 KB plus 2 MB of CSS.
11. **Completion is inconsistent.** Some activities show a manual "Märgi tehtuks" button; others are tracked automatically with no visible status.
