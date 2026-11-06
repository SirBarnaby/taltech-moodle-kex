# Publishing TalTech Moodle KEX

Everything needed to put the add-on on the Firefox and Chrome stores. Nothing here uploads or signs anything; you do the uploads,
with your own accounts.

| File | What it is |
|---|---|
| `listing.md` | Names, descriptions (English and Estonian), categories, screenshot captions |
| `privacy-policy.md` | The privacy policy, English and Estonian |
| `permissions.md` | Answers for Chrome's "Privacy practices" tab and Mozilla's review notes |
| `BUILD.md` | Build steps for Mozilla's reviewers (it goes inside the source zip) |
| `assets/` | 1280x800 screenshots (en, et) and Chrome's 440x280 promo tile; remake them with `node scripts/store-shots.mjs` |

## 1. Make the packages

On a clean, committed `staging` (or `main`):

```sh
npm ci
npm run pack:stores
```

This builds both browsers, lints the Firefox build, and writes three files to `dist/store/`:

- `taltech-moodle-kex-<version>-firefox.zip`: upload to Firefox
- `taltech-moodle-kex-<version>-chrome.zip`: upload to Chrome (also works for Microsoft Edge Add-ons)
- `taltech-moodle-kex-<version>-source.zip`: Mozilla's source upload

It then unpacks the source zip in a temporary folder, installs and builds it there, and checks the result matches both packages
byte for byte, which is what a reviewer will do. It stops if source files have uncommitted changes, because the source zip is
made from the last commit.

The version comes from `version` in `package.json`. Each store refuses a version it has seen before, so raise it for every upload.
Mozilla counts unlisted signings too: if `npm run sign` ever signed 1.0.0, the first store upload needs 1.0.1 or higher.

## 2. Before the first upload (one time)

- **Privacy policy link.** Chrome needs a public web address for `privacy-policy.md`. Options: make the GitHub repository public
  and link the file, turn on GitHub Pages, or put the text in a public gist. Firefox takes the text pasted into a form field.
- **Name.** The name uses "TalTech" and "Moodle", which both belong to others. The description says the add-on is an independent
  project, but a reviewer may still ask. If one objects, "KEX for TalTech Moodle" is a safer fallback.
- **Support contact.** Both stores show a support address or link publicly. Decide which one to use.

## 3. Firefox: addons.mozilla.org

1. Sign in at <https://addons.mozilla.org/developers/> (the same free account used for signing).
2. **Submit a New Add-on** > **On this site** (listed). Choose "Unlisted" instead if only people with the file should have it.
3. Upload `taltech-moodle-kex-<version>-firefox.zip`. Untick Firefox for Android (see `permissions.md`).
4. When asked whether the code is generated or minified, answer **Yes** and upload `taltech-moodle-kex-<version>-source.zip`.
5. Fill in the listing from `listing.md`: summary, description, categories, and the support details. Then add the screenshots and
   paste the privacy policy text. Add the Estonian texts under the listing's language switcher.
6. Paste the reviewer notes from `permissions.md`, then submit. Listed add-ons are reviewed by a person. That usually takes from a
   few days to a few weeks.

The add-on id `taltech-moodle-kex@kex.local` is fixed by the first upload, and future versions must keep it.

## 4. Chrome: Chrome Web Store

1. Register at <https://chrome.google.com/webstore/devconsole>. There is a one-time US$5 fee, and Google requires 2-step
   verification and a verified contact email.
2. **New item** > upload `taltech-moodle-kex-<version>-chrome.zip`.
3. **Store listing:** description, category, language, `assets/icon-128.png` from the repo root as the store icon, the
   screenshots, and `promo-small-440x280.png`. Add Estonian as a second language with its own texts and screenshots.
4. **Privacy practices:** paste the single purpose and permission justifications from `permissions.md`, set the data answers, and
   add the privacy policy link.
5. **Distribution:** "Public", or "Unlisted" to share it by link only. You can limit regions, for example to Estonia.
6. **Submit for review.** That usually takes from a few days to a couple of weeks; narrow host permissions like this add-on's help.

Microsoft Edge Add-ons (<https://partner.microsoft.com/dashboard/microsoftedge>) is free and takes the same Chrome zip and texts.

## 5. Every later release

1. Raise `version` in `package.json` and commit.
2. Run `npm run verify:release` (Firefox checks) and `npm run test:chrome` (Chrome checks).
3. Run `npm run pack:stores`.
4. Upload the new zips. On Firefox, upload the new source zip with each version too.
