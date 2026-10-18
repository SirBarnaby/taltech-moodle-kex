# Real-theme repro

The test Moodle labs run plain Boost, so bugs that come from TalTech's own theme CSS (for example `a:hover { background-color: transparent !important }`, or `body.pagelayout-login { width: calc(100% - 640px) }`) never show up there. This renders a captured real page with the captured real theme and the dev build of the add-on:

1. Build `login.html` and `theme.css` from `captures/` (strip external `<script src>` and `<link>` tags from the captured page, link `/theme.css`), serve the folder on `http://localhost:8099`.
2. `node tools/realtheme/login-shot.mjs dist/packages/kex-dev.xpi out.png` (needs the Selenium Firefox from `tools/lab`).
