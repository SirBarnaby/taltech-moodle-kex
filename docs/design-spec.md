# Design spec: literal reproduction of `ai_generated_enhanced_drafts/iteration3.png`

The reference frame is iteration3.png at **1585×992 CSS px** (DPR 1). All coordinates are absolute in that frame unless marked "rel".
- Colors were sampled from the PNG with PIL (averages for fills; top-10% ink for text).
- Text sizes come from measured cap heights: Inter cap ≈ 0.727 em.
- Where the mock is internally inconsistent (AI image), this spec normalizes and says so.

## 1. Fonts
| Role | Family (bundled) | Fallback |
|---|---|---|
| Display (hero title, H1, topic title) | `"Inter Tight Variable"` | `"Inter Variable", system-ui, sans-serif` |
| UI | `"Inter Variable"` | `system-ui, "Segoe UI", sans-serif` |
| Mono caps labels, codes | `"JetBrains Mono Variable"` | `ui-monospace, "Cascadia Mono", Menlo, monospace` |

Why these: the glyph evidence from the PNG is:
- single-storey g, double-storey a, flat-cut t: Inter family;
- display letter-spacing much tighter than Inter: Inter Tight;
- the mono labels have a slab-serifed `I`, a plain oval `0`, and monospaced pitch.

Numbers in lists and dates use `font-variant-numeric: tabular-nums`.

## 2. Tokens

### 2.1 Light theme (the mock)
```css
--kex-bg: #fbfbfd;              /* main content background */
--kex-header-bg: #fcfcfd;
--kex-text: #06043d;            /* headings, titles (sampled #020234, #01002f, #04033f) */
--kex-text-2: #241e60;          /* topic names, breadcrumb (#231d5d, #262065, #302967) */
--kex-text-3: #5f598c;          /* subtitles, codes (#595288, #666092, #676193) */
--kex-text-4: #8f8ab3;          /* breadcrumb slash */
--kex-mono-strong: #2e2470;     /* PINNED, TOPICS (#2c1f78, #30276b) */
--kex-mono: #494280;            /* TOPIC 06 */
--kex-mono-soft: #7771a0;       /* LECTURE / PDF, 3 RESOURCES (#59528b) */
--kex-violet: #1a0f8f;          /* active tab text (#0f0793), active topic (#180c8a, #08046b) */
--kex-violet-2: #3625ad;        /* active arrow */
--kex-accent: #c114fe;          /* tab underline */
--kex-accent-bar: linear-gradient(180deg, #c753f0, #b300f5 50%, #c233f5); /* active topic left bar */
--kex-magenta: #a10982;         /* active pin icon */
--kex-primary: #201055;         /* filled button */
--kex-primary-hover: #2e1a78;
--kex-on-primary: #f7f6fa;
--kex-outline: #3a3171;         /* outlined button border, 1.5px */
--kex-outline-text: #0a0847;
--kex-border: #e3e3f0;          /* row separators (#e2e3ef, #e4e6f1, #e8e8f2) */
--kex-border-card: #dddded;     /* pinned container */
--kex-border-strong: #d0cadb;   /* header bottom */
--kex-divider-v: #d5d3ea;       /* topics/detail divider */
--kex-tint: #efe6fd;            /* active topic background */
--kex-tint-border: #e0dcf3;
--kex-hover: #f5f1fe;
--kex-search-bg: #f2edfd; --kex-search-border: #ddd8f2; --kex-search-text: #37219d; --kex-search-icon: #150773;
--kex-kbd-bg: #e5e0fb; --kex-kbd-border: #d8d3f7; --kex-kbd-text: #2c1890;
--kex-iconbtn-bg: #ebebf9; --kex-iconbtn-border: #e0e2f1; --kex-iconbtn-fg: #0a0538;
--kex-actions: #43397a;         /* Preview / Pin text; icon #160d5b */
--kex-actions-divider: #e8eaf4;
--kex-focus: #c114fe;
```

### 2.2 Sidebar (same in both themes)
```css
--kex-sb-bg:
  radial-gradient(120% 38% at 100% 0%, rgba(88,58,140,.28) 0%, rgba(88,58,140,0) 60%),
  linear-gradient(180deg, #1f1339 0%, #1b1034 9%, #18102f 22%, #160f2c 40%, #150f2b 70%, #140f29 100%);
--kex-sb-text: #f2f1f8;    --kex-sb-text-2: #e7e6f1;
--kex-sb-mono: #a5a3c5;    /* course codes */
--kex-sb-mono-active: #ac8ac9;
--kex-sb-label: #a39bc0;   /* COURSES / AUTUMN 2026 */
--kex-sb-divider: #3a2e62;
--kex-sb-logo-divider: #583f89;
--kex-sb-hover: rgba(255,255,255,.045);
--kex-sb-avatar-bg: #4f4b70; --kex-sb-avatar-ring: rgba(255,255,255,.55);
```

### 2.3 Hero
```css
--kex-hero-bg: linear-gradient(90deg, #251443 0%, #1f133e 25%, #1d1238 45%, #24164a 62%, #2a1153 100%);
--kex-hero-text: #ffffff; --kex-hero-label: #c6c1d9; --kex-hero-link: #e6e4ef;
--kex-hero-link-underline: rgba(255,255,255,.16);
--kex-hero-gradient-text: linear-gradient(90deg, #b9a4ff 0%, #cea3f9 12%, #eba4f8 30%, #f8aaf3 50%, #f8a8ef 100%);
--kex-hero-cross: rgba(150,100,210,.55); --kex-hero-cross-bright: rgba(200,165,235,.75);
--kex-hero-fallback: url("assets/hero-fallback.webp") right center / cover no-repeat, var(--kex-hero-bg);
```

### 2.4 Thumbnails
| Variant | Background | Border | Stroke/ink |
|---|---|---|---|
| doc (lecture/reading/material) | `linear-gradient(160deg, #efeafe, #e3e0fa)` | 1px #d1cef1 | #5239d3 (diagram), number #2c2470 |
| code (practical/assignment) | `linear-gradient(160deg, #fef1fd, #fbe7f5)` | 1px #f1d3ec | #55107c |
| video (recording) | static shader frame, or `linear-gradient(135deg, #170d3e, #2d0d5a)` | none | play ring #ffffff |
| quiz | doc background | as doc | `?` glyph grid #5239d3 |
| link | doc background | as doc | globe/link glyph |
| forum | doc background | as doc | two speech bubbles |
| folder | doc background | as doc | folder glyph |

### 2.5 Dark theme (content area; sidebar and hero unchanged)
```css
--kex-bg: #0f0b1f; --kex-header-bg: rgba(15,11,31,.86);
--kex-text: #efedfa; --kex-text-2: #d9d6ee; --kex-text-3: #a7a2c6; --kex-text-4: #6f6a92;
--kex-mono-strong: #c9c1f2; --kex-mono: #b3abd8; --kex-mono-soft: #9a93c4;
--kex-violet: #d6c8ff; --kex-violet-2: #c7b6ff; --kex-accent: #d35cff; --kex-magenta: #ff6ed3;
--kex-primary: #efeafe; --kex-primary-hover: #ffffff; --kex-on-primary: #1a1040;
--kex-outline: #7d73b8; --kex-outline-text: #efedfa;
--kex-border: #251e3f; --kex-border-card: #2c2549; --kex-border-strong: #2e2650; --kex-divider-v: #2c2549;
--kex-tint: rgba(193,20,254,.13); --kex-tint-border: rgba(193,20,254,.28); --kex-hover: rgba(255,255,255,.04);
--kex-search-bg: #1a1430; --kex-search-border: #2e2650; --kex-search-text: #b8afe6; --kex-search-icon: #d8d0ff;
--kex-kbd-bg: #251d45; --kex-kbd-border: #3a3166; --kex-kbd-text: #d8d0ff;
--kex-iconbtn-bg: #1a1532; --kex-iconbtn-border: #2e2650; --kex-iconbtn-fg: #ecebf7;
--kex-actions: #c3bde6; --kex-actions-divider: #2c2549; --kex-focus: #f0a6f8;
```

Further dark-theme rules:
- **Thumbnails:** doc `linear-gradient(160deg,#211a40,#1a1536)` border #2f2752 stroke #a99bff; code `linear-gradient(160deg,#2a1433,#21102b)` border #3d2048 stroke #ff8ee6.
- **Sidebar:** gains `box-shadow: 1px 0 0 rgba(255,255,255,.06)`.
- **Header:** uses `backdrop-filter: saturate(140%) blur(14px)` permanently.

### 2.6 Geometry tokens
```css
--kex-sb-w: clamp(232px, 15.52vw, 300px);   /* 246 @1585 */
--kex-pad: clamp(24px, 1.77vw, 40px);       /* 28 @1585 */
--kex-header-h: 67px; --kex-header-h-compact: 52px;
--kex-hero-h: clamp(232px, 15.96vw, 340px); /* 253 @1585 */
--kex-topics-w: clamp(300px, 20.7vw, 400px);/* 328 @1585 */
--kex-r-xs: 2px; --kex-r-s: 3px; --kex-r-m: 4px; --kex-r-l: 6px; --kex-r-xl: 10px;
--kex-ease: cubic-bezier(.2,.8,.2,1); --kex-ease-slide: cubic-bezier(0.625,0.05,0,1);
z-index: header 40, sidebar 50, popover 60, sheet 65, palette 70, toast 80, off-pill 90.
```

### 2.7 Shadows
| Use | Value |
|---|---|
| Palette | `0 24px 64px -16px rgba(20,10,60,.35), 0 0 0 1px rgba(32,16,85,.08)` |
| Popover | `0 12px 32px -8px rgba(20,10,60,.28)` |
| Compact header | `0 6px 24px -12px rgba(32,16,85,.18)` |
| Preview sheet | `-24px 0 64px -24px rgba(20,10,60,.35)` |

Nothing else has a shadow. The mock is flat: hairlines only.

## 3. Type scale
| Token | Family | Size/line | Weight | Tracking | Used for (measured) |
|---|---|---|---|---|---|
| `hero` | display | 64/64 | 300 | −0.035em | "Cloud Architectures" (cap 136→183, width 557) |
| `h1` | display | 42/48 | 650 | −0.035em | "Learning materials" (cap 454→485) |
| `h2` | display | 44/48 | 700 | −0.045em | topic title "Kubernetes" (cap 546→578, width 212) |
| `row-title` | ui | 20/26 | 600 | −0.01em | "Kubernetes — lecture slides" |
| `card-title` | ui | 16/20 | 600 | −0.005em | pinned card title |
| `list` | ui | 18/24 | 400 (600 active) | −0.005em | topic rows, sidebar course names |
| `body-l` | ui | 17/24 | 400 | 0 | topic subtitle, tabs (active 600) |
| `body` | ui | 16/22 | 400 | 0 | sidebar nav, search placeholder, row subtitle, user name |
| `body-s` | ui | 15/20 | 400 | 0 | breadcrumb, hero links, footer links, Edit |
| `small` | ui | 14/18 | 400 | 0 | Preview/Pin actions, pinned course code |
| `btn` | ui | 18/20 | 600 | 0 | Open ↗ / Watch ↗ |
| `mono-wide` | mono | 12/16 | 500 | 0.14em | PINNED, TOPICS, hero label |
| `mono` | mono | 12/16 | 500 | 0.08em | TOPIC 06 |
| `mono-side` | mono | 11/14 | 500 | 0.14em | COURSES / AUTUMN 2026 |
| `mono-s` | mono | 11/14 | 500 | 0.04em | LECTURE / PDF, sidebar codes |
| `mono-s-wide` | mono | 11/14 | 500 | 0.09em | 3 RESOURCES |

All mono labels are uppercase. Slashes in labels have one space each side ("ITI8801 / AUTUMN 2026").

## 4. Layout at 1585×992
```
x: 0 ─ sidebar ─ 246 │ 274 (pad 28) ─────────────── content ─────────────── 1557 (pad 28) │ 1585
y: 0–67 header (fixed; 66 + 1px border) · 67–320 hero · 320→ content
```

### 4.1 Sidebar (x 0–246, full height, fixed, `--kex-sb-bg`)
| Element | Geometry | Style |
|---|---|---|
| Logo wordmark | x 27, y 24, 91×52 | Moodle's own logo image (`.navbar-brand img.logo`), scaled to height 52. Fallback: "TAL"/"TECH" in Inter Tight 900, 30/26, white |
| Logo divider | x 130, y 31–75 | 1px `--kex-sb-logo-divider` |
| "moodle" | x 143, baseline 62 | ui 400 19px, #fff, lowercase |
| Divider 1 | y 107, x 20–225 | 1px `--kex-sb-divider` |
| Nav "Workspace" | row y 114–164 (center 139) | icon Lucide `house` 18px at x 28 (stroke 1.75, `--kex-sb-text`); label x 68, `body` 16px |
| Nav "Pinned materials" | row y 164–213 (center 188) | icon Lucide `book-marked` 18px |
| Divider 2 | y 229 | |
| Section label | x 24, cap top 257 | `mono-side`, `--kex-sb-label`, text `COURSES / AUTUMN 2026` |
| Course list | from y 287 | items as below |
| Divider 3 | y 756 | sits after the list; the list area scrolls internally if longer (scrollbar hidden until hover, 4px) |
| Footer links | rows 40px from y 776: ÕIS (center 796), Email (834), Settings (877) | icon 15px at x 31 (`square-arrow-out-up-right` for ÕIS and Email, `settings` for Settings); label x 69, `body-s`, `--kex-sb-text-2`; external arrow `arrow-up-right` 12px placed 12px after the label |
| User chip | avatar 44px circle at x 27, center y 936 | bg `--kex-sb-avatar-bg`, 1px ring `--kex-sb-avatar-ring`, initials ui 500 16px #f7f8fc (or Moodle avatar image if not the default); name x 85 `body` #f0eef5; chevron `chevron-right` 12px at x 213; bottom padding 35 |

Nav row and footer row hover: background `--kex-sb-hover`, 2px radius, inset 12px horizontally.

**Course item.**
- Padding: top 17, left 38, right 16, bottom 14.
- Code: `mono-s`, `--kex-sb-mono`, cap top at +17.
- Name: `list` 18/22, `--kex-sb-text`, top at +36, max 2 lines (ellipsis).
- Height: 71 for one line, 93 for two.
- Measured tops: ITI8801 287, EMT0140 358, IAS0230 429, MMO5770 500 (two lines), ITB8833 593, IEE2630 664.

**Active course item** (x 0–246, y 287–355):
- `background:` `linear-gradient(180deg, rgba(255,255,255,.07) 0%, rgba(0,0,0,.16) 100%), linear-gradient(90deg, #6d1087 0%, #57156e 13%, #3d1b5f 40%, #482874 60%, #523882 85%, #392772 100%)`.
- Top hairline 1px `rgba(150,100,205,.6)`; bottom hairline 1px `rgba(160,30,150,.55)`.
- Left marker (`::before`): x 0–9 solid #7a0e90, and x 9–13 a 4px bar #fdf6fe with `box-shadow: 0 0 10px 1px rgba(232,120,240,.65)`.
- Code `--kex-sb-mono-active`; name #f9f5fc.

### 4.2 Header (fixed; x 246–1585; y 0–67)
- Background `--kex-header-bg`, border-bottom 1px `--kex-border-strong`. Content box padding 0 28px; items vertically centered at y 33.
- **Breadcrumb** (left 274):
  - home icon: Lucide `house` filled, 18×17, #120a47 (`--kex-text`);
  - gap 18, then the crumbs in `body-s`. Links `--kex-text-2` (#302967); the current crumb `--kex-text-2` weight 500;
  - separator "/" `--kex-text-4` with 15px gaps.
  - Measured: home 274–291, "My courses" 310–382, "/" 397–402, "ITI8801" 417–461.
- **Search trigger** (button, opens the palette):
  - x 1214–1481 (268×44), top 11, radius `--kex-r-l`, bg `--kex-search-bg`, 1px `--kex-search-border`;
  - icon `search` 18px `--kex-search-icon` at left 19;
  - placeholder "Search anything", `body` 16px `--kex-search-text`, at x+54;
  - kbd group right-aligned 16px from the edge: "Ctrl" chip 40×27 and "K" chip 24×27 joined (shared 1px border), bg `--kex-kbd-bg`, border `--kex-kbd-border`, radius 4 on the outer corners, ui 500 14px `--kex-kbd-text`, centered vertically (top 19).
- **Theme toggle:** x 1518–1559 (42×44), top 11, radius 6, bg `--kex-iconbtn-bg`, 1px `--kex-iconbtn-border`. Icon `sun` 20px `--kex-iconbtn-fg` in light theme, `moon` in dark. Gap from search: 36.
- **Compact state** (§8.2).

### 4.3 Hero (x 246–1585, y 67–320, height 253)
- Background `--kex-hero-bg` plus a `<canvas>` (absolute, inset 0) running the ribbons shader. The ribbon mass occupies x > 860; the left fade keeps x < ~860 dark. Bottom edge: 1px inset `rgba(12,6,44,.9)`.
- **Crosshairs** (25×25 "+", 1px lines):
  - #1: center rel (626, 40) = abs (872, 107), `--kex-hero-cross`, center pixel brighter;
  - #2: center rel (1217, 221) = abs (1463, 288), `--kex-hero-cross-bright`.
  - Positions in % of hero width (46.75%, 90.9%) and px from top and bottom (40 top; 32 bottom).
- **Label:** x 275, cap top 101, `mono-wide`, `--kex-hero-label`, "ITI8801 / AUTUMN 2026".
- **Title:** x 274, `hero` type.
  - Line 1 "Cloud Architectures": #fff, cap top 136, baseline 183.
  - Line 2 "& DevOps": gradient text `--kex-hero-gradient-text`, baseline 247.
  - Measured glyph inks: "&" #cea3f9 → "D" #eba4f8 → rest #f8aaf3.
  - Max width 62% of hero. Shrink-to-fit to at most 2 lines down to 44px.
- **Links row:** baseline 292, x 277. "Course info", "Recordings", "Grades", each followed by an `arrow-up-right` 11px icon (gap 11).
  - Link gap 34. `body-s` 15px `--kex-hero-link`.
  - Underline 1px `--kex-hero-link-underline`, `text-underline-offset: 6px`; on hover the underline becomes `rgba(255,255,255,.7)`.
  - Measured extents: 277–352 / arrow 364–373; 408–479 / 495–504; 540–585 / 602–610.

### 4.4 PINNED row
- Label "PINNED" at x 275, cap top 338 (line box 334–347), `mono-wide`, `--kex-mono-strong`.
- **Container:** x 274–1476, y 347–421 (1202×74 incl. 1px border `--kex-border-card`), radius `--kex-r-xs`. Three equal cells separated by 1px `--kex-border-card` dividers (mock: 701 and 1071; normalized to equal widths).
  - The first cell (the highlighted pin, i.e. the first pin from the current course) has background `linear-gradient(90deg, rgba(255,255,255,0) 32%, #f6f1fd 55%, #ebe2fd 78%, #e7d9fd 86%, #fbeefd 100%)`.
- **Cell layout** (normalized from cells 2 and 3):
  - document icon Lucide `file-text` 24×30 at cell-x + 28, color `--kex-text`, stroke 1.75;
  - pin icon (filled thumbtack, Lucide `pin` with `fill=currentColor`) 12×18 at cell-x + 84, top 368: `--kex-magenta` in the highlighted cell, `--kex-text` otherwise;
  - title at cell-x + 128 (`card-title`, `--kex-text`, cap top 370), course code below (`small` 14px, `--kex-text-3`, cap top 392);
  - arrow `arrow-right` 14px at cell right − 29, vertical center 385, `--kex-violet-2` (#4d41a1 sampled).
- **Edit link:** right column x 1500–1551: pencil icon `pencil` 15px (#2b246d) at x 1500, top 347; text "Edit" `body-s` at x 1527, cap top 349. Gap 24 from the container.
- **Hover** on a non-highlighted cell: the highlight gradient fades in at 50% opacity; the arrow moves +3px. Focus: 2px inset focus ring.
- **Empty cells** (fewer than 3 pins): dashed 1px `--kex-border-card` inner box inset 10px, text `small` `--kex-text-3`: "Press P on any material to pin it".

### 4.5 "Learning materials" + tabs
- H1 "Learning materials" at x 275, cap top 454 (`h1`, `--kex-text`).
- Tabs right-aligned, ending at x 1557: "Everything" (text 1285–1364), "Lectures" (1411–1468), "Labs" (1512–1542). Gap ≈ 46. `body-l` 17px; active `--kex-violet` 600; inactive #413979 400 (dark: `--kex-text-3`).
- **Active underline:** 3px solid `--kex-accent`, x from text-left − 9 to text-right + 9 (1276–1374), y 493–496, sitting directly on the divider.
- **Divider:** y 497, 1px #e8e8f2, x 274–1557.
- Underline animation on tab change: slide `left`/`width` 220ms `--kex-ease`.

### 4.6 Two-column body
```
grid-template-columns: var(--kex-topics-w) 1fr;
column-gap: 63px;   (topics 274–602, divider at 631, detail 665–1557)
```
- The vertical divider is a 1px `--kex-divider-v` pseudo-element at topics-right + 29, from y 520 to the end of the detail list (mock 520–960).
- The topics column is `position: sticky; top: calc(var(--kex-header-h-compact) + 24px)`.

### 4.7 TOPICS list
- Label "TOPICS" x 275, cap top 527, `mono-wide`, `--kex-mono-strong`.
- Rows start at y 546, height 52, bottom border 1px `--kex-border` (#e4e6f1). Row tops: 546, 598, 650, 702, 754, 806.
- Number at x 293 (left padding 19), `list` 18px tabular, `--kex-text-2`, zero-padded 2 digits (section number).
- Title at x 341 (number column 48), `list`, `--kex-text-2`, single line with ellipsis.
- For a tiles-format course: insert a 40×28 tile thumbnail (radius 3, `object-fit: cover`) between number and title (title shifts to x 389).
- **Active row** (06, y 807–859):
  - background `--kex-tint` with a soft right glow: `linear-gradient(90deg, #f1e8fd 0%, #efe6fd 60%, #fbeffd 75%, #f3e4fd 90%, #ece2fc 100%)`;
  - top and bottom border 1px `--kex-tint-border`;
  - left bar 4px `--kex-accent-bar` at x 274–277;
  - number and title `--kex-violet`, weight 600;
  - arrow `arrow-right` 14px at x 569 `--kex-violet-2`.
- **Hover** (inactive): background `--kex-hover`; the arrow fades in from opacity 0, translateX(−4px).
- **Dimmed** (no match for the current tab): text opacity .45; still selectable.
- **Restricted:** a `lock` icon 13px after the title, text opacity .6.

### 4.8 Topic detail
- "TOPIC 06" x 666, cap top 522, `mono`, `--kex-mono`.
- Counter "3 RESOURCES" right-aligned to 1557, cap top 527, `mono-s-wide`, `--kex-mono-soft`. Singular "1 RESOURCE".
- Title x 667, cap top 546, `h2`, `--kex-text`.
- Subtitle x 666, cap top 589, `body-l` 17px, `--kex-text-3` (generated, happy-path §6.9).
- Optional "About this topic" (section summary): collapsed by default, `small` link with a `chevron-down`, 12px below the subtitle.
- The resource list starts at y 620.

### 4.9 Resource row
- Separator 1px `--kex-border` (#e2e3ef) at the bottom. Padding 11px 0 12px.
- Min-height 116 (row 1: 620–736). Items center-aligned vertically except the thumb (top).
- **Thumb:** x 665, 134×92, radius `--kex-r-m`, variant per kind (§2.4, §5).
- **Text column** at x 836 (thumb + 37):
  - label `mono-s` `--kex-mono-soft` (cap top row-top + 19);
  - title `row-title` `--kex-text` (cap top + 42);
  - optional subtitle `body` `--kex-text-3` (row 2: "Practice 6");
  - actions row (`small`, `--kex-actions`, icons 16px #160d5b): "Preview" (`eye`) | divider 1×20 `--kex-actions-divider` | "Pin" (filled `pin`; text "Unpin" when pinned) | divider | "Done" (`circle-check`, only for manual-completion activities; "Done ✓" in `--kex-violet` when complete).
  - Gaps: icon→text 14, item→divider 26. Measured row 1: eye 836, "Preview" 866, divider 940, pin 973, "Pin" 996.
- **Button:** right-aligned, x 1410–1558, 148×44, radius `--kex-r-s`, vertically centered. Label `btn`, `arrow-up-right` 14px with gap 10.
  - Filled: bg `--kex-primary`, text `--kex-on-primary`.
  - Outlined: 1.5px `--kex-outline`, text `--kex-outline-text`, transparent bg; hover bg `--kex-hover`.
  - Filled hover: `--kex-primary-hover`.
- **Note row** (label module): no thumb; sanitized HTML at x 836, `body` `--kex-text-3`; images max-height 120px.
- **Restricted row:** opacity .55, label "LOCKED", availability text as the subtitle, button disabled ("Locked", `lock` icon).
- **Row hover:** background `--kex-hover` (full row, extending 12px left and right). Focus: 2px `--kex-focus` outline, offset 2, radius 4.
- **Mock deviation, accepted:** the mock omits the action line on the recording row. KEX shows "Pin" on every row for consistency.

## 5. Thumbnails (SVG components, 134×92 viewBox)

**doc**
- Number "06" (section number) at (16, 25): JetBrains Mono 500 15px #2c2470.
- Diagram:
  - box A 22×16 at (64, 30);
  - boxes B (40, 58) and C (88, 58), 22×16;
  - connectors A-bottom → B-top and A-bottom → C-top as orthogonal polylines;
  - three short dashes at x 14–30, y 58/66/74.
  - All strokes 1.5 #5239d3, no fill.
- Variant by format:
  - SLIDES: the same, plus a 2px bar under box A;
  - DOC/TEXT: 5 text lines instead of the diagram.

**code:** "</>" at (16, 26), ui 500 16px #55107c. Four lines at x 36–106, y 44/54/64/74 (widths 70/56/62/38), 1.5px #55107c, with short dashes at x 16–24 aligned to each line.

**video:**
- A shader frame (seed = cmid) or a gradient fallback.
- Centered play button: 51px circle, 2px #fff ring, inner fill `rgba(255,255,255,.08)`, white filled triangle 14×16 offset +2px x.

**quiz / link / forum / folder / assignment:** doc background with a single 28px Lucide glyph (`circle-help` / `link` / `messages-square` / `folder` / `upload`) centered in #5239d3 (assignment uses code colors).

## 6. Iconography
- Lucide via `lucide-preact`, stroke 1.75, `currentColor`.

| Size | Used for |
|---|---|
| 18px | nav, search, home |
| 16px | row actions |
| 14px | arrows |
| 20px | theme |
| 15px | footer, Edit |

- Filled variants (`fill="currentColor"`): breadcrumb home, pins.

## 7. Components outside the mock (same language)
- **Popover (Quick settings, user menu):**
  - dark panel #1b1334, 1px #3a2e62, radius 10, padding 8, width 300;
  - rows 40px `body-s` #f2f1f8, row hover `rgba(255,255,255,.06)`;
  - section labels `mono-side` `--kex-sb-label`;
  - anchored to the sidebar item, opening to the right (x 246 + 8).
- **Switch:**
  - track 36×20 radius 10;
  - off: #3a2e62 (popover) or #d8d3f0 (light page);
  - on: `linear-gradient(90deg, #b300f5, #e4067e)`;
  - knob 16px white with `0 1px 2px rgba(0,0,0,.3)`; 160ms.
- **Segmented control:** 32px tall, 1px border, radius 6, selected segment bg `--kex-tint`, text `--kex-violet` 600.
- **Palette:**
  - fixed, top 18vh, width min(680px, 92vw), radius 10;
  - bg `--kex-header-bg`, 1px `--kex-search-border`, palette shadow;
  - input row 56px: `search` 20px + input ui 18px + `Esc` kbd chip;
  - group headers `mono-s` `--kex-mono-soft`, padding 12 16 6;
  - rows 44px: left 24px slot (icon or mono code), title `body` (match highlight bg `--kex-tint`, color `--kex-violet`), right meta `mono-s` (course code · KIND);
  - selected row: bg `--kex-tint`, 3px `--kex-accent` left bar;
  - footer 32px `small` `--kex-text-3`: "↑↓ navigate · ↵ open · Ctrl ↵ new tab · Alt P pin · Esc close";
  - backdrop `rgba(10,6,30,.35)`, `blur(2px)`.
- **Preview sheet:**
  - fixed right, top 0, bottom 0, width min(56vw, 960px), bg `--kex-bg`, left border 1px `--kex-border-strong`, sheet shadow;
  - head 72px: label `mono-s`, title `row-title`, actions [Pin] [Download] [Open ↗ (filled)] [× close IconButton];
  - body: iframe 100% for PDF and image, a sanitized article (max-width 720, ui 16/26) for pages, a link card for URLs;
  - enter: translateX(24px) and opacity 0→1, 180ms.
- **Toast:** bottom-center, 40px tall pill, bg #201055 (dark: #efeafe with dark text), ui 14px, optional action button (underlined), 3s (6s with Undo).
- **Skeletons:** blocks `--kex-border` (light) or #241a43 (sidebar), opacity pulse .55↔1 at 1.2s. With reduced motion, a static .7.
- **Empty state:** `mono-wide` kicker ("NOTHING HERE YET") + 20px `row-title` + `body` text `--kex-text-3` + one outlined button. Left-aligned in the detail column.
- **Error state:** kicker "ERROR / NETWORK" (or errorcode) in `--kex-magenta`, message, [Retry] outlined + "Open Moodle's page" link.
- **Off-pill:** see architecture §13. Bg #201055, text #f7f6fa `small`, kbd chip style inverted.
- **Focus ring everywhere:** `outline: 2px solid var(--kex-focus); outline-offset: 2px`. Inside the dark sidebar: `#f0a6f8`.

## 8. Motion

### 8.1 Slide Up Text uses
| Element | split | stagger | duration | delay | trigger |
|---|---|---|---|---|---|
| Hero title (both lines) | words | 0.06 | 0.7 | 0.05 | mount |
| Hero label | none (fade 200ms) | | | | mount |
| Topic title | characters | 0.018 | 0.45 | 0 | each topic change |
| Topic subtitle | words | 0.02 | 0.4 | 0.08 | each topic change |
| "Learning materials" | words | 0.08 | 0.6 | 0 | inView, once |
| Compact-header title | words | 0.03 | 0.35 | 0 | when shown |
| Workspace hero line 2 (summary) | words | 0.05 | 0.6 | 0.15 | mount and on change |

All use ease `cubic-bezier(0.625,0.05,0,1)`, `from:'first'`.

Resource rows on topic or tab change: opacity 0→1 and translateY(8px)→0, 220ms `--kex-ease`, stagger 40ms (max 8 rows animated; the rest appear instantly).

### 8.2 Header compression (exact)
| | Expanded (`scrollY ≤ 8`) | Compact (`scrollY > 24`; hysteresis) |
|---|---|---|
| Bar height | 67 (66 + border) | 52 (51 + border) |
| Background | `--kex-header-bg` opaque | `color-mix(in srgb, var(--kex-header-bg) 82%, transparent)` + `backdrop-filter: saturate(140%) blur(14px)` |
| Bottom | 1px `--kex-border-strong` | 1px `--kex-border` + compact shadow |
| Breadcrumb | 15px | 14px |
| Search | 268×44, top 11 | 240×36, top 8; kbd chips 22px tall |
| Theme btn | 42×44 | 36×36 |
| Compact title | hidden | see below |

- Transition: 180ms `--kex-ease` on height, padding, font-size and background.
- The header is `position: fixed`. A fixed 67px spacer is in flow, so compression never shifts content.
- **Compact title:**
  - shown when the hero title leaves the viewport (IntersectionObserver on the hero `<h1>`, `rootMargin: -52px 0 0 0`);
  - appears after the breadcrumb, behind a vertical 1px×20px `--kex-border-strong` divider with 16px margins;
  - content: a mono chip (course code, `mono-s`, padding 2 6, 1px `--kex-border`, radius 3), then the course title in display 600 16px `--kex-text`, slide-up words;
  - when the topic `<h2>` also leaves the viewport, the title swaps to `TOPIC 06` (mono chip) + "Kubernetes".
- Reduced motion: all instant.

### 8.3 Other motion
| What | Motion |
|---|---|
| Tab underline | slide 220ms |
| Pin added | the new cell scales 0.96→1 and fades 200ms; replaced cells crossfade |
| Done toggle | check icon draw (stroke-dashoffset) 240ms |
| Sidebar active change on navigation | none (page load) |
| Rail ↔ full | width 200ms |
| Palette | opacity + scale .98→1, 120ms |
| Popovers | opacity + translateY(4px), 120ms |

With reduced motion: no transforms; opacity changes ≤ 100ms are allowed.

## 9. Shader (WebGL2 ribbons): starting point, tune with visual diff
Vertex: one full-screen triangle. Uniforms: `uRes`, `uTime`, `uPointer` (eased −1..1), `uIntensity` (1 hero, .4 page band, 1.15 login), `uLeftFade` (.46 hero, 0 login).
```glsl
#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uPointer; uniform float uIntensity; uniform float uLeftFade;
out vec4 o;
const vec3 BG0=vec3(.145,.078,.263), BG1=vec3(.114,.071,.220), BG2=vec3(.165,.067,.325);
const vec3 MAG=vec3(.988,.431,.827), PNK=vec3(.827,.239,.902), LAV=vec3(.643,.525,.918), VIO=vec3(.392,.322,.831), HOT=vec3(.878,.769,.910);
float g(float d,float w){return exp(-d*d/(w*w));}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float ar=uRes.x/uRes.y; float x=(uv.x-0.45)*ar; float t=uTime*0.07;
  vec3 col=mix(mix(BG0,BG1,smoothstep(0.,.45,uv.x)),BG2,smoothstep(.55,1.,uv.x)); col*=.92+.08*uv.y;
  vec3 glow=vec3(0.);
  for(int r=0;r<4;r++){ float fr=float(r);
    vec3 c = r==0?MAG:(r==1?LAV:(r==2?PNK:VIO));
    float base=-.10+.16*fr, slope=.42-.06*fr, freq=2.2+.6*fr;
    for(int s=0;s<18;s++){ float fs=float(s)/17.-.5;
      float spread=.10+.05*sin(x*1.7+t*1.3+fr);
      float y=base+slope*x+.10*sin(x*freq+t*(1.+.2*fr)+fr*1.9)+.04*sin(x*freq*2.7-t*1.6+fr*.7)+fs*spread+.02*uPointer.y;
      float d=abs(uv.y-y);
      glow+=c*(g(d,.0016+.0012*abs(fs))*.55+g(d,.03)*.04)*(1.-smoothstep(.30,.5,abs(fs)));
    }
  }
  glow+=HOT*smoothstep(.9,2.2,dot(glow,vec3(.333)))*.6;
  col+=glow*smoothstep(uLeftFade-.04,uLeftFade+.20,uv.x)*uIntensity;
  o=vec4(1.-exp(-col*1.15),1.);
}
```

Targets from the PNG (hero-relative %):
- ribbons start at ≈ 46% width;
- the brightest white-hot band runs from about (52%, bottom) to (100%, top);
- magenta core near (77%, 48%) ≈ #fc6ed3;
- lavender (#a486ea) and violet (#6452d4) secondary ribbons;
- fine parallel hairline strands visible inside the ribbons;
- left 45% stays #1d1238–#251443.

Animation: slow drift (`uTime*0.07`); the pointer adds ±2% vertical parallax.

## 10. Visual acceptance against iteration3
DOM geometry targets at a 1585×992 viewport, light theme, effects frozen. Elements carry `data-kex-test` attributes. Tolerance ±3px unless noted.

| Test id | x | y | w | h |
|---|---|---|---|---|
| `sidebar` | 0 | 0 | 246 | 992 |
| `header` | 246 | 0 | 1339 | 67 (±1) |
| `hero` | 246 | 67 | 1339 | 253 |
| `search` | 1214 | 11 | 268 | 44 |
| `theme-toggle` | 1518 | 11 | 42 | 44 |
| `sb-active-course` | 0 | 287 | 246 | 68 (±4) |
| `pinned` | 274 | 347 | 1202 | 74 |
| `pinned-edit` | 1500 | 347 | ≈52 | ≈16 (±4) |
| `tab-underline` | 1276 | 493 | 98 | 3 (±6 on x, w) |
| `topics-row-1` | 274 | 546 | 328 | 52 |
| `topics-row-6` (active) | 274 | 806 | 328 | 53 |
| `detail-title` | 665 | ≈536 | | (±5) |
| `row-1-thumb` | 665 | 631 | 134 | 92 |
| `row-1-button` | 1410 | 655 | 148 | 44 |
| `row-2-button` | 1410 | 772 | 148 | 44 (±6 on y) |
| `row-3-thumb` | 665 | 869 | 134 | 92 (±8 on y) |

Pixel diff thresholds per region (pixelmatch threshold 0.15; % of region pixels differing):

| Region | Max % |
|---|---|
| sidebar | 12 |
| header | 8 |
| hero text area x 246–860 | 10 |
| hero ribbons x 860–1585 | 45 (informational) |
| pinned | 15 |
| materials header | 12 |
| topics | 15 |
| detail | 18 |

## 11. Responsive
| Width | Behaviour |
|---|---|
| ≥ 2560 | Content inner max-width 1720px, left-aligned after the sidebar. Hero stays full-bleed and its text column scales with the clamps above. |
| 1280–2559 | Fluid via the clamps. Hero title `clamp(52px, 4.04vw, 92px)`. h1/h2 scale `clamp(36px, 2.65vw, 52px)`. |
| 1100–1279 | Topics 300px. Buttons 128×40. Search 220px. |
| 760–1099 | **Rail sidebar** 72px (below). |
| < 760 | **Drawer** (below). |

**Rail sidebar (760–1099), 72px:**
- logo image at width 40;
- nav icons only (tooltip on hover/focus, 300ms delay);
- courses as two-line mono codes ("ITI" / "8801") in 56px items; active item keeps the left marker and gradient;
- footer icons; avatar only.
- `Ctrl+B` expands it to 246px as an overlay with the same shadow as popovers.

**Drawer (< 760):**
- sidebar hidden; a hamburger IconButton (36px) at the header's left opens it as a drawer (focus trap, Esc).
- Header: hamburger · breadcrumb (last two crumbs) · search IconButton · theme.
- Hero 200px, title 40px.
- Topics become a horizontal scroll strip of 36px pills (`01 What is cloud?`, active pill with tint and bar on the bottom), sticky under the header.
- Resource rows: thumb 96×66; button full-width below the text.
- PINNED row: horizontal scroll of 280px cells.
