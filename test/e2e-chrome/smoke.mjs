// The Chrome build, installed as a real extension in Chromium, on the captured moodle.taltech.ee pages (test/harness/capsite.mjs
// serves the site and answers Moodle's web services). Checks that the content script, stylesheet, bundled fonts, background
// service worker, storage, popup and options page all work under Chrome's MV3 rules.
//
//   npm run build:chrome && node test/e2e-chrome/smoke.mjs [--shots dir]
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromiumType, GL_ARGS, launch, open } from '../harness/capsite.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ext = path.join(root, 'dist/chrome');
if (!existsSync(path.join(ext, 'manifest.json'))) throw new Error('Run npm run build:chrome first');
const args = process.argv.slice(2);
const shots = args.includes('--shots') ? path.resolve(args[args.indexOf('--shots') + 1]) : null;
if (shots) await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

const profile = await mkdtemp(path.join(tmpdir(), 'kex-chrome-'));
const chromium = await chromiumType();
const ctx = await chromium.launchPersistentContext(profile, {
  headless: true,
  executablePath: process.env.KEX_CHROMIUM || undefined,
  viewport: { width: 1600, height: 1000 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...GL_ARGS],
});
// Course states are read from the captures in a plain browser (a persistent context cannot open side contexts).
const parser = await launch();
const errors = [];
try {
  const worker = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(worker.url()).host;
  check('background service worker starts', Boolean(id), id);
  const stored = await worker.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const s = (await chrome.storage.local.get('kex:settings'))['kex:settings'];
      if (s) return s;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  });
  check('settings written on install (storage)', Boolean(stored && typeof stored === 'object'));

  for (const name of ['mycourses', 'course-37582', 'participants']) {
    const page = await open(parser, name, { context: ctx, extension: true, goto: false });
    // Only the add-on's own errors: the captured pages run Moodle's inline scripts without Moodle's script files, and those fail.
    page.on('console', (m) => { if (m.type() === 'error' && (m.location().url.startsWith('chrome-extension://') || m.text().includes('chrome-extension://'))) errors.push(`${name}: ${m.text()}`); });
    const [route] = { mycourses: ['/my/courses.php'], 'course-37582': ['/course/view.php?id=37582'], participants: ['/user/index.php?id=37582'] }[name];
    await page.goto(`https://moodle.taltech.ee${route}`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => ({
      kex: document.documentElement.dataset.kex ?? null,
      root: document.querySelector('#kex-root')?.childElementCount ?? 0,
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
      font: getComputedStyle(document.querySelector('#kex-root') ?? document.body).fontFamily,
    }));
    check(`${name}: KEX takes over the page`, Boolean(info.kex) && info.root > 0, `data-kex=${info.kex}, ${info.root} children`);
    check(`${name}: bundled fonts load from the extension`, info.fonts.some((f) => /Inter/.test(f)), info.fonts.join(', ') || 'none loaded');
    check(`${name}: Moodle web services answered`, page.calls.length > 0, `${page.calls.length} calls`);
    if (shots) await page.screenshot({ path: path.join(shots, `chrome-${name}.png`) });
    if (name === 'mycourses') {
      await page.locator('.kex-sidebar a[href*="view=dossier"]').first().click();
      await page.waitForTimeout(2000);
      check('in-page navigation to the Dossier', await page.evaluate(() => location.search.includes('view=dossier') && Boolean(document.querySelector('.kex-feed'))));
    }
    await page.close();
  }

  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForTimeout(800);
  check('popup renders', (await popup.evaluate(() => document.body.innerText.trim().length)) > 0);
  const opened = ctx.waitForEvent('page', { predicate: (p) => p.url().includes('options.html'), timeout: 5000 }).then(() => true, () => false);
  await popup.locator('button').filter({ hasText: /settings|seaded/i }).first().click().catch(() => undefined);
  check('popup opens the options page', await opened);
  const options = await ctx.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await options.waitForTimeout(800);
  check('options page renders', (await options.evaluate(() => document.querySelectorAll('input, button, [role="switch"]').length)) > 3);
  if (shots) await options.screenshot({ path: path.join(shots, 'chrome-options.png') });
  check('no extension errors in the console', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await ctx.close();
  await parser.close();
  await rm(profile, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} Chrome checks passed`);
process.exit(failed ? 1 : 0);
