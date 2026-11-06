// Store images into store/assets/: 1280x800 screenshots in English and Estonian for both stores, and Chrome's 440x280 promo
// tile. Made from the captured pages (test/harness/capsite.mjs) with the account holder's name swapped for a made-up one, so no
// real person shows in a public listing. Needs `npm run build:dev` and the captures. Run: node scripts/store-shots.mjs
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, open, USER_ID } from '../test/harness/capsite.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'store/assets');
await mkdir(out, { recursive: true });

/** The signed-in name, read from Moodle's own "logged in as" link, becomes a placeholder everywhere on the page. */
function anonymise(html) {
  const real = new RegExp(`user/profile\\.php\\?id=${USER_ID}"[^>]*>([^<]+)</a>`).exec(html)?.[1]?.trim();
  if (!real) return html;
  const [first, ...rest] = real.split(/\s+/);
  let result = html.split(real).join('Mari Maasikas');
  if (first) result = result.split(first).join('Mari');
  for (const part of rest) result = result.split(part).join('Maasikas');
  return result;
}

/** Captures carry no images: each one becomes a soft tile instead of a flat block, and pictures in topic summaries and notes are left out. */
const TILE = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100" viewBox="0 0 160 100" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6f5ce0"/><stop offset=".55" stop-color="#3f6fd8"/><stop offset="1" stop-color="#1ea7c9"/></linearGradient></defs><rect width="160" height="100" fill="url(#g)"/></svg>';
const NO_SUMMARY_PICTURES = '#kex-root :is(.kex-tsec__about, .kex-tsec__summary, .kex-row__note) :is(img, figure, picture) { display: none !important; }';
const openTopic = (n) => async (page) => {
  await page.locator('.kex-outline__item').nth(n).click();
  await page.waitForTimeout(1200);
};

const SHOTS = [
  { file: 'courses', page: 'mycourses' },
  { file: 'course', page: 'course-37582' },
  { file: 'course-dark', page: 'course-37582', theme: 'dark', then: openTopic(1) },
  { file: 'dossier', page: 'mycourses', then: async (page) => { await page.locator('.kex-sidebar a[href*="view=dossier"]').first().click(); await page.waitForTimeout(2200); } },
  { file: 'palette', page: 'course-37582', then: async (page) => { await page.keyboard.press('Control+k'); await page.waitForTimeout(700); await page.keyboard.type('lab', { delay: 60 }); await page.waitForTimeout(700); } },
];

const browser = await launch();
try {
  for (const lang of ['en', 'et']) {
    for (const shot of SHOTS) {
      const page = await open(browser, shot.page, {
        theme: shot.theme ?? 'light',
        viewport: { width: 1280, height: 800 },
        settings: { uiLanguage: lang, achievementToasts: false, wheel: false },
        html: anonymise,
        imageSvg: TILE,
        wait: 3000,
      });
      await page.addStyleTag({ content: NO_SUMMARY_PICTURES });
      await shot.then?.(page);
      await page.mouse.move(0, 799);
      await page.screenshot({ path: path.join(out, `screenshot-${lang}-${shot.file}.png`) });
      await page.context().close();
      console.log(`store/assets/screenshot-${lang}-${shot.file}.png`);
    }
  }

  // Chrome's small promo tile: the icon, the name and one line, on the hero's colours.
  const icon = (await readFile(path.join(root, 'assets/icon-128.png'))).toString('base64');
  const tile = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  await tile.setContent(`<!doctype html><html><body style="margin:0;width:440px;height:280px;display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box;
    background:radial-gradient(120% 140% at 85% 10%,#5b3fd0 0%,#2a1a7a 45%,#120a40 100%);font-family:system-ui,'Segoe UI',sans-serif;color:#fff">
    <img src="data:image/png;base64,${icon}" width="96" height="96" style="flex:none;filter:drop-shadow(0 8px 18px rgba(0,0,0,.35))">
    <div><div style="font-size:30px;font-weight:700;letter-spacing:-.01em;line-height:1.1">Moodle KEX</div>
    <div style="margin-top:10px;font-size:16px;line-height:1.35;color:#d9d2ff">A fast, keyboard-first<br>TalTech Moodle</div></div></body></html>`);
  await tile.screenshot({ path: path.join(out, 'promo-small-440x280.png') });
  console.log('store/assets/promo-small-440x280.png');
} finally {
  await browser.close();
}
