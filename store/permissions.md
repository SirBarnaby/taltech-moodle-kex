# Permissions and data: answers for the store forms

## Chrome Web Store: "Privacy practices" tab

**Single purpose**

> Redesigns the TalTech Moodle site (moodle.taltech.ee) into a faster, keyboard-first interface for students.

**Permission justifications**

| Permission | Justification to paste |
|---|---|
| `storage` | Keeps the user's settings (theme, language, animations), their pinned materials and course order, and a short-lived cache of course structure so pages open quickly. Stored only on the user's computer. |
| Host permission `https://moodle.taltech.ee/*` | The add-on's only job is to redraw the pages of this one site. Its content script runs there, and it calls Moodle's own web services on the same site with the user's existing session to show their courses, deadlines and grades. |

**Remote code:** "No, I am not using remote code." Everything runs from the package; there is no `eval` and no script loaded from
the web.

**Data usage.** The form asks which kinds of user data the extension collects. The add-on reads course pages and course data
from moodle.taltech.ee (the user's courses, deadlines and grades) to display them, and keeps a cache on the device. It never sends
any of it anywhere except back to moodle.taltech.ee. Recommended answers:

- Tick **Website content** and **Personally identifiable information**. The add-on handles the user's name and course data from
  Moodle on the device. Disclosing it is the safe side: the form treats "handles" broadly.
- Leave everything else unticked (health, financial, authentication, personal communications, location, web history, user
  activity).
- Tick all three certifications. The data is not sold or transferred to third parties, not used for anything unrelated to the
  single purpose, and not used for creditworthiness or lending.

**Privacy policy URL:** the public link to `store/privacy-policy.md`.

## Firefox (addons.mozilla.org)

- **Data collection:** the manifest declares `data_collection_permissions: { required: ["none"] }`. The add-on transmits nothing
  to the developer or third parties, which is what Mozilla means by data collection.
- **Source code:** required, because the code is bundled. Upload `dist/store/taltech-moodle-kex-<version>-source.zip`. The build
  steps are in `store/BUILD.md` inside it.
- **Notes to reviewer** (paste):

  > The add-on only works on moodle.taltech.ee, which needs a TalTech university account, so it cannot be tried without one. It
  > redraws that site's pages and calls Moodle's own web services (/lib/ajax/service.php) on the same site with the user's session.
  > It makes no other network requests, has no analytics and loads no remote code. Build: Node 22, `npm ci --ignore-scripts`, then
  > `node scripts/build.mjs`; the output in dist/firefox matches the uploaded package byte for byte (see store/BUILD.md).

- **Privacy policy:** paste the English text of `store/privacy-policy.md` into the listing's privacy policy field.
- **Firefox for Android:** leave it unticked. The manifest allows Android, but the add-on has only been tested on desktop.

## Permissions the add-on does not ask for

No tabs, history, cookies, webRequest, downloads, identity or `<all_urls>`. It cannot see any site other than moodle.taltech.ee.
