# Moodle page capture (development helper)

A throwaway Firefox add-on that saves the real structure of every moodle.taltech.ee
page you open, plus TalTech's theme CSS, so the redesign is built against the real
markup instead of a guess.

- Files land in `Downloads\taltech-moodle-capture\` (`pages\*.html`, `pages\*.json`, `css\*.css`).
- Session keys (`sesskey`) and login tokens are replaced with `REDACTED` before saving.
- Each distinct page is saved once per Firefox session. The toolbar badge counts pages;
  click the icon to pause or resume.

## Load it

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `tools\capture\manifest.json` from this repo.
3. Browse Moodle. Remove it from the same page when done (it also disappears when Firefox restarts).
