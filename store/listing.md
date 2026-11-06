# Store listing texts

Copy these into the store forms. English is the default listing; add Estonian as a second language in both stores. Character
limits are noted where a store has one.

## Name

- **Both stores:** TalTech Moodle KEX (from the manifest; Chrome allows up to 75 characters)

## Short description

The manifest description, used by Chrome as the summary (132 characters at most) and by Firefox as the default summary:

> A fast, keyboard-first redesign of moodle.taltech.ee. Runs entirely in your browser and sends nothing anywhere.

**Estonian** (for the Estonian listing summary):

> Kiire ja klaviatuurisõbralik moodle.taltech.ee uus kujundus. Töötab ainult sinu brauseris ega saada midagi kuhugi.

## Full description

### English

TalTech Moodle KEX gives moodle.taltech.ee a fast, modern interface built for studying. Moodle itself is not changed: every action
still goes to Moodle's own pages, with your own login.

What you get:

- **My courses** as a card grid with progress, filters for current, starred, upcoming and past courses, and a quick search.
- **Course pages** as clear topic cards, with a topic list on the left, Mark as done, and one-key pinning (press P on any material).
- **Course tabs** (Course, Participants, Grades, Competencies) right under the course name.
- **A side reader** that opens PDFs, pages and links next to the topic list, so you never lose your place.
- **The Dossier**: your deadlines and recent changes across all courses on one page.
- **A command palette** (Ctrl+K) to jump to any course, topic, material or page.
- **Pinned materials**, labs as a board, achievements, and light and dark themes.
- **Keyboard first**: press ? anywhere to see every shortcut.

Privacy: the add-on runs only on moodle.taltech.ee. It has no analytics, loads no remote code, and sends nothing to anyone. Your
settings and pins stay on your own computer.

TalTech Moodle KEX is an independent student project. It is not made, endorsed or supported by Tallinn University of Technology
(TalTech) or by Moodle. You need your own TalTech account to use it.

### Estonian

TalTech Moodle KEX annab moodle.taltech.ee-le kiire ja kaasaegse liidese, mis on mõeldud õppimiseks. Moodle'it ennast ei muudeta:
iga tegevus läheb endiselt Moodle'i enda lehtedele ja sinu enda sisselogimisega.

Mida saad:

- **Minu kursused** kaardiruudustikuna koos edenemisega, filtritega praeguste, tärniga, tulevaste ja möödunud kursuste jaoks ning
  kiirotsinguga.
- **Kursuse lehed** selgete teemakaartidena: vasakul teemade loend, „Märgi tehtuks“ ja kinnitamine ühe klahviga (vajuta
  materjalil P).
- **Kursuse sakid** (Kursus, Osalejad, Hinded, Pädevused) otse kursuse nime all.
- **Külglugeja**, mis avab PDF-id, lehed ja lingid teemade loendi kõrval, nii et sa ei kaota kunagi oma kohta.
- **Dossier**: kõigi kursuste tähtajad ja viimased muudatused ühel lehel.
- **Käsupalett** (Ctrl+K), et hüpata mis tahes kursuse, teema, materjali või lehe juurde.
- **Kinnitatud materjalid**, laborid tahvlina, saavutused ning hele ja tume teema.
- **Klaviatuur eelkõige**: vajuta kus tahes ?, et näha kõiki otseteid.

Privaatsus: lisa töötab ainult moodle.taltech.ee lehtedel. Sellel pole analüütikat, see ei laadi kaugkoodi ega saada midagi
kellelegi. Sinu seaded ja kinnitused jäävad sinu enda arvutisse.

TalTech Moodle KEX on sõltumatu tudengiprojekt. Seda ei ole teinud, heaks kiitnud ega toeta Tallinna Tehnikaülikool (TalTech)
ega Moodle. Kasutamiseks on vaja oma TalTechi kontot.

## Categories and tags

- **Firefox (AMO):** Appearance, and Other. Tags: moodle, taltech, education, keyboard, dark mode.
- **Chrome Web Store:** Productivity > Education.

## Images (store/assets/)

Every image is made by `node scripts/store-shots.mjs` from the saved test pages, with the account holder's name replaced by a
made-up one ("Mari Maasikas"), so no real person appears.

| File | Size | Use |
|---|---|---|
| `screenshot-en-*.png` (5) | 1280x800 | Screenshots for the English listing (both stores take 1280x800) |
| `screenshot-et-*.png` (5) | 1280x800 | Screenshots for the Estonian listing |
| `promo-small-440x280.png` | 440x280 | Chrome's small promo tile (required) |
| `../assets/icon-128.png` | 128x128 | Chrome's store icon. Firefox uses the icon inside the package |

Suggested captions, in screenshot order:

1. courses: "My courses: cards, progress, filters and search" / "Minu kursused: kaardid, edenemine, filtrid ja otsing"
2. course: "A course page: topics on the left, materials in cards" / "Kursuse leht: teemad vasakul, materjalid kaartidel"
3. course-dark: "Dark theme, with labs grouped by lab" / "Tume teema, laborid laborite kaupa"
4. dossier: "The Dossier: this week's deadlines across all courses" / "Dossier: selle nädala tähtajad kõigist kursustest"
5. palette: "Ctrl+K jumps to any course, topic or material" / "Ctrl+K viib iga kursuse, teema või materjali juurde"

## Support details

- **Homepage / support:** the GitHub repository, if it is public, or an email address you are happy to show publicly.
- **Privacy policy URL:** a public link to `store/privacy-policy.md` (see store/README.md).
