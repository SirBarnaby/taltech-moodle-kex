# Happy path: how an IT power user moves through KEX

The persona:
- an IT student on a large monitor, keyboard-first;
- about 6 current courses, mixed Estonian/English, tiles and topics formats;
- wants three things fast: what's due, where the material is, and getting back to it.

## 1. Concepts

**Workspace** (`/my/`, sidebar item 1). The redesigned dashboard: one screen that answers "what needs me now?". It holds:
- **Hero:** greeting plus a one-line summary ("2 due this week").
- **Pinned row:** 3 pins.
- **"This week":** a two-column board.
  - Left column, **Courses:** the current courses with progress and their next deadline.
  - Right column, the **feed**, under tabs Everything / Deadlines / Updates. Everything merges:
    - (1) overdue items;
    - (2) items due in the next 7 days;
    - (3) "Continue": the 3 most recently opened materials (`block_recentlyaccesseditems`);
    - (4) unread updates (notifications, course announcements);
    - (5) items due in 8–14 days.

**Pinned materials** (sidebar item 2, `/my/#pinned`).
- **Pins** are user-chosen shortcuts to activities (course modules), across all courses.
- Stored locally in `browser.storage.local` under `kex:v1:{host}:{userId}:pins`. Per user, per browser, never synced.
- Max 50, ordered by the user. Each pin stores `cmid, courseId, courseCode, title (editable), modname, kind, format, url`.
- The **PINNED row** (Workspace and every course page) shows 3 cells: pins from the current course first (in pin order), then others in pin order.
- The full list lives on the Pinned page.
- If a pinned activity disappears (404 or no longer visible in the course state), the pin shows "Unavailable" with a Remove action.

**Topic.** A Moodle course section, normalized across topics, weeks and tiles formats. Section 0 is not a topic. It is "Course info", reached via the hero link or key `0`.

**Material (resource row).** Any non-label activity in a topic.

## 2. Journey A: open Moodle, see what's due (cold start)
1. Type `moodle.taltech.ee` (or use a bookmark to `/my/`).
2. **Not logged in → Login view.**
   - The last-used method is the filled primary button, focused (default "TalTech Uni-ID").
   - Press `Enter` to go through TalTech SSO; Moodle redirects back to `/my/`.
   - `1`–`4` pick Uni-ID / ID-kaart / Mobiil-ID / Smart-ID. `M` opens "More sign-in options" (username/password form, focus on username).
3. **Workspace renders immediately** from cache (sidebar, hero, pins, last known feed with a "Updated 3 min ago" mono stamp) and revalidates in about 1 batched request.
4. **Focus** lands on the first feed row. Nothing is auto-focused if the user already clicked or typed.
5. **Scan:**
   - overdue rows have a magenta date tile and a "OVERDUE" mono label;
   - due-soon rows show "in 2 days";
   - Continue rows show "Opened 2 h ago".
6. **Act on a row:**
   - `j`/`k` (or ↓/↑) move.
   - `Enter` opens the activity. Deadline rows open `action.url` (e.g. the submission form) when the action is actionable, else the activity.
   - `Ctrl+Enter` opens in a new tab.
   - `p` pins or unpins. `x` toggles done (manual-completion activities only).
   - `Space` previews (materials only).
7. **Tabs:** `1` Everything, `2` Deadlines, `3` Updates. URL hash mirrors the tab (`#deadlines`, `#updates`).

## 3. Journey B: jump to a course and a topic
1. `Alt+1`…`Alt+9` opens the nth sidebar course. Or `Ctrl+K`, type `kub`, and Enter on "Kubernetes · ITI8801 · Topic 06".
2. **Course page.**
   - Hero: "ITI8801 / AUTUMN 2026", "Cloud Architectures / & DevOps" (slide-up words).
   - PINNED row.
   - "Learning materials" with tabs, the TOPICS list, and the topic detail.
3. **Initial topic**, the first rule that applies:
   - (a) the URL: `#topic-N`, `section.php?id=`, or a Moodle `#section-N` anchor;
   - (b) the topic last opened in this course (stored in `ui:{courseId}`), if visited in the last 14 days;
   - (c) the section marked current by Moodle (`section.current` or `course.highlighted`);
   - (d) the section holding the nearest open deadline;
   - (e) the first topic with an incomplete tracked activity;
   - (f) topic 01.
4. **Focus starts on the active topic row.**
   - `j`/`k` or ↑/↓ change the topic; the detail updates instantly with the slide-up title and `#topic-N` replaced in the URL.
   - `→`, `l` or `Tab` move focus into the resource list. `←` or `h` go back.
   - `0` shows Course info (section 0). `g t` focuses the topics list.
5. **On a resource row:**
   - `Enter`: Open (same tab; URL modules open in a new tab by default).
   - `Space`: Preview sheet. Inside it, `j`/`k` go to the next or previous material, and `Esc` closes.
   - `p`: Pin. The cell animates into the PINNED row, and a toast "Pinned · Undo (z)" appears.
   - `x`: Done (manual completion). Optimistic, with toast and Undo.
   - `o`: Open in new tab. `c`: copy the link.
6. **Filter tabs:** `1` Everything, `2` Lectures, `3` Labs. Topics with no match for the filter are dimmed, not hidden.

## 4. Journey C: deadlines → submit an assignment
1. From anywhere: `g d` goes to Workspace `#deadlines`. On a course page, the Labs tab shows the course's assignments with due labels.
2. On "Lab 6: Kubernetes · ASSIGNMENT / DUE THU 15 OCT", `Enter` opens `mod/assign/view.php?id=…&action=editsubmission` (the event's action URL "Add submission").
3. **The assignment page is skin mode with ActivityChrome.**
   - Header band: `ITI8801 / TOPIC 06 / ASSIGNMENT`, title, due countdown, status.
   - Below it, Moodle's own submission form, restyled: file drop area, online text editor, Save / Cancel. Moodle's JS is untouched.
4. Drag the file into the file manager, then click "Save changes" (or `Ctrl+Enter` while focus is inside the form, which clicks Moodle's submit button).
5. Moodle redirects to the view page, which shows "Submitted for grading" in the restyled status card. The deadline disappears from Workspace on its next revalidation (5 min TTL; forced on return).

## 5. Journey D: announcements, grades, calendar
- **Announcements:** Workspace `3` (Updates) lists unread notifications.
  - Forum posts show `ANNOUNCEMENT / IAS0230` when `component=mod_forum` and the subject comes from a news forum, otherwise `FORUM / <code>`.
  - `Enter` opens `contexturl` (the discussion, skin mode, restyled posts). `m` marks read; `Shift+M` marks all read.
- **Grades:** `g r` goes to `/grade/report/overview/index.php` (app view: one row per course, grade right-aligned).
  - `Enter` opens that course's user report (skin, restyled table).
  - The course hero "Grades ↗" goes straight to the course report.
- **Calendar:** `g c` goes to `/calendar/view.php?view=month` (skin, restyled month grid). Deadlines are better read on Workspace.
- **Notifications page:** `g n`. Messages: `g m` (Moodle's messaging app, skin).

## 6. Classification rules (Everything / Lectures / Labs; kind and format labels)
Implemented in `src/data/classify.ts`. Inputs:
- `modname`;
- `name`;
- `iconKey` (from activity HTML: `f/pdf`, `f/mpeg`, … or a module name);
- the section `title`;
- `dates` (for assign/quiz due text).

Matching is case-insensitive and Unicode-aware. For word boundaries use `(?<![\p{L}\p{N}])` and `(?![\p{L}])`, because `\b` fails on õäöü.

**6.1 Regexes**
- `LECTURE_RE = /(lecture|loeng|slaid|slide|presentation|esitlus|ettekanne|konspekt)/iu`
- `LAB_RE = /(lab(?:or|s)?(?![\p{L}])|labor|praktikum|practic|harjutus|exercise|tutorial|workshop|seminar|homework|kodutöö|ülesanne|assignment|task|project|projekt)/iu`
- `RECORDING_RE = /(recording|salvestus|video|echo ?360|panopto|youtube|youtu\.be|vimeo|stream|veebinar|webinar)/iu`
- `READING_RE = /(reading|lugemis|article|artikkel|paper|chapter|peatükk|reference|raamat)/iu`
- `PREFIX_RE = /^((?:lecture|loeng|practi(?:ce|cal)|praktikum|lab|labor|harjutus|exercise|seminar|tutorial|week|nädal|recording|salvestus|quiz|test|homework|kodutöö)\s*#?\d+[a-z]?)\s*[:—–\-|.]\s+(.+)$/iu`

**6.2 Kind** (first match wins)

| # | Condition | Kind |
|---|---|---|
| 1 | `label` | `note` (rendered as a note row in Everything; never counted) |
| 2 | `assign`, `workshop` | `assignment` |
| 3 | `quiz` | `quiz` |
| 4 | `h5pactivity` | `practical` |
| 5 | `forum` | `discussion` |
| 6 | `feedback`, `choice`, `survey`, `questionnaire` | `survey` |
| 7 | `lti`, `bigbluebuttonbn`, `zoom` | `recording` if RECORDING_RE(name), else `tool` |
| 8 | `glossary`, `wiki`, `data` | `tool`; `attendance`, `scheduler`, others: `tool` |
| 9 | `resource`, `url`, `page`, `book`, `folder`, `imscp`, `lesson`, `scorm` (content modules) | first match below |

For content modules:
- a. RECORDING_RE(name), or the file format is VIDEO/AUDIO → `recording`
- b. PREFIX_RE prefix word ∈ {practice, practical, praktikum, lab, labor, harjutus, exercise, seminar, tutorial, homework, kodutöö}, or LAB_RE(name) → `practical`
- c. LECTURE_RE(name), or prefix word ∈ {lecture, loeng} → `lecture`
- d. READING_RE(name), or `book` → `reading`
- e. section title matches LAB_RE → `practical`; matches RECORDING_RE → `recording` (e.g. the IAS0230 tiles "Labs" and "Echo 360 Lecture Recordings…")
- f. otherwise → `material`

**6.3 Tabs**

| Tab | Kinds |
|---|---|
| Lectures | lecture, recording, reading, material |
| Labs | practical, assignment, quiz |
| Everything | all kinds, including discussion, survey, tool, note (notes are not counted in "N RESOURCES") |

**6.4 Format** (from `iconKey`)

| Format | Source |
|---|---|
| PDF | `f/pdf` |
| SLIDES | `f/powerpoint` |
| DOC | `f/document` |
| SHEET | `f/spreadsheet` |
| ZIP | `f/archive` |
| VIDEO | `f/video`, `f/mpeg`, `f/quicktime`, `f/avi`, `f/wmv`, `f/mp4`, or url/lti with kind recording |
| AUDIO | `f/audio`, `f/mp3`, `f/wav` |
| IMAGE | `f/image`, `f/jpeg`, `f/png`, `f/gif`, `f/bmp`, `f/svg` |
| TEXT | `f/text` |
| CODE | `f/sourcecode`, `f/html`, `f/markdown` |
| FILE | `f/unknown` or other `f/*` |
| LINK | url |
| PAGE | page |
| BOOK | book |
| FOLDER | folder |
| ASSIGNMENT | assign |
| QUIZ | quiz |
| FORUM | forum |
| H5P | h5pactivity |
| SURVEY | feedback / choice |
| TOOL | other |

**6.5 Mono label line** = `KIND_WORD / FORMAT_OR_STATUS`
- KIND_WORD: LECTURE, RECORDING, READING, MATERIAL, PRACTICAL, ASSIGNMENT, QUIZ, FORUM, SURVEY, TOOL.
- For `assignment` and `quiz`, the second part is the status from the calendar event:
  - `DUE THU 15 OCT`, or `OVERDUE` (magenta);
  - `CLOSES 22 OCT` for quizzes;
  - Moodle's date text uppercased if there is no event.

**6.6 Title and subtitle**
- If PREFIX_RE matches: title = group 2, subtitle = group 1 with its first letter capitalized ("Practice 6: Deploy a service" → "Deploy a service" / "Practice 6").
- Otherwise title = the full name, and subtitle is the first available of:
  - the due/close text;
  - `resourceDetails` (e.g. "2.1 MB PDF document");
  - the first sentence (≤ 90 chars) of the plain-text description;
  - nothing.

**6.7 Primary (filled) button.** Exactly one per topic list: the first row in the filtered list with a tracked, incomplete completion. If there is none, the first row. All other buttons are outlined.

**6.8 Button verb**

| Case | Verb |
|---|---|
| recording | Watch |
| assignment, open and not yet submitted | Submit |
| all others | Open |

Every button has the ↗ icon.

**6.9 Topic subtitle** (under the topic title)
- Collect the distinct kinds present, in this order: lecture → "Lecture", practical → "practical work", assignment → "assignment", quiz → "quiz", recording → "recording", reading → "reading", material → "materials", discussion → "discussion".
- Join with ", " and " and ", capitalizing only the first word. Example: "Lecture, practical work and recording".
- If the section has a summary, it appears below as a collapsible "About this topic" block. The subtitle stays generated.

## 7. Keyboard map (complete)
Global keys are inactive while typing in a form field, except `Ctrl+K` and `Esc`.

| Keys | Action | Scope |
|---|---|---|
| `Ctrl+K`, `/` | Command palette | global |
| `?` | Shortcut help | global |
| `g w` / `g p` / `g m` / `g d` / `g u` | Workspace / Pinned / My courses / Deadlines / Updates | global |
| `g c` / `g r` / `g n` / `g s` | Calendar / Grades / Notifications / Messages | global |
| `Alt+1…9` | Open nth sidebar course | global |
| `Alt+↑` / `Alt+↓` | Previous / next course (sidebar order) | global |
| `Ctrl+B` | Collapse/expand sidebar (rail ↔ full) | global |
| `t` | Toggle light/dark | global |
| `Alt+Shift+O` | Original page on/off | global |
| `Esc` | Close overlay / clear selection | global |
| `j`/`k`, `↓`/`↑` | Move in the focused list | lists |
| `h`/`l`, `←`/`→` | Topics ↔ resources | course |
| `1`/`2`/`3` | Tabs | course, workspace |
| `0` | Course info | course |
| `Enter` / `Ctrl+Enter` / `o` | Open / new tab / new tab | rows |
| `Space` | Preview | material rows |
| `p` | Pin/unpin | rows with a cm |
| `x` | Mark done/undone (manual completion) | rows |
| `c` | Copy link | rows |
| `z` | Undo the last pin or done (5 s) | global |
| `e` | Edit pins (on the PINNED row) | course, workspace |
| `F2` | Rename sidebar course alias / pin title | sidebar, pin edit |
| `m` / `Shift+M` | Mark notification read / all read | updates, notifications |

## 8. Edge paths that must feel finished
- **Session expired** (`invalidsesskey`): sticky banner under the header, "Your Moodle session expired. [Log in again]". Cached views stay readable.
- **Offline or network error:** cached data is shown with an "Offline · showing data from 14:32" mono stamp. Actions are disabled with a tooltip.
- **New semester:** courses not in `courseOrder` are appended. Archived courses drop out because the sidebar mirrors Moodle's own grouping.
- **Course with zero topics or a restricted topic:** empty state, or a dimmed row with a lock icon and the availability text.
- **Quiz attempt:** focus mode. Sidebar collapses to the rail, the hero is hidden, and the Moodle quiz navigation becomes a sticky right rail. KEX keyboard shortcuts are disabled on these pages except `Alt+Shift+O` and `Ctrl+K`.
