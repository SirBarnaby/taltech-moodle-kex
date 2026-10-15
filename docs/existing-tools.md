# Existing tools: what exists and why we still build

| Tool | What it does | Why it is not enough |
|---|---|---|
| CompactMoodle (userstyles.world/style/11906) | User CSS that shrinks icons and spacing | Cosmetic only: no data, no keyboard, no cross-course view; breaks on theme changes |
| Moodle dark-mode add-ons on AMO (2 found) | Invert or recolor Moodle | Unmaintained since 2023–24; generic Boost colors; no layout change |
| Moodle Buddy (github.com/marcelreppi/moodle-buddy) | Bulk-downloads course files; detects new files | Complementary, not a redesign. **Coexists**: in KEX app mode Moodle's original DOM stays in the page (hidden), so Buddy's scrapers still find it. Add a coexistence smoke test (M6). |
| MoodleFlow (github.com/Tresillo2017/moodleflow) | Separate web app over the Moodle web-service API | Needs a WS token and server settings TalTech would have to enable; not the moodle.taltech.ee origin; not a browser extension |
| Moodle Mobile app (official) | Native app via TalTech's mobile service | Phone-first; no desktop power-user UI |
| Stylus plus a custom style | Any CSS | Cannot fetch data (deadlines, completion, search index), so cannot implement the Workspace, the palette or pins |
| Moodle's own features | Timeline block, course index drawer, course search block | Exist, but are scattered and slow (see current-design.md) |

**Conclusion.** Nothing combines cross-course data, a keyboard-first navigation model and a complete visual redesign without server changes. A Firefox extension can, because:
- it runs on the moodle.taltech.ee origin with the user's own session;
- it can call Moodle's AJAX web services that are enabled for logged-in users (verified list in architecture.md §8.3);
- it can restyle every page in place.

We build **TalTech Moodle KEX**:
- client-side only;
- no server settings, tokens or third-party services;
- Moodle Buddy can run alongside it.
