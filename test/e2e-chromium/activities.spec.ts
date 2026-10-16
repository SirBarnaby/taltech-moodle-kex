import { execSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, waitForShell, installKex } from './fixtures';
import { iter3Seed } from '../harness/kex';

/**
 * M4 acceptance (implementation-plan): the native flows of resource, url, page, assign, quiz and forum complete with KEX on; no KEX console
 * errors and Moodle's own JS errors unchanged versus KEX off; axe finds nothing attributable to KEX CSS in either theme; Alt+Shift+O on a
 * quiz attempt shows pure Moodle and restores KEX. Runs against the lab (docker-reset between runs by tools/lab/m4_reset.php).
 */

const REPORT_CM = 154; // Report: cloud migration plan (file + online text)
const QUIZ_CM = 155; // Quiz: Containers basics (3 questions)
const FORUM_DISCUSS = 1; // How do I expose a service from kind?

function resetLab(): void {
  execSync('docker cp tools/lab/m4_reset.php moodle-lab-moodle-1:/tmp/m4_reset.php && docker exec -u nobody moodle-lab-moodle-1 php /tmp/m4_reset.php', { stdio: 'ignore' });
}

interface Seen {
  kex: string[];
  errors: string[];
}

/** Console and page errors of a page. `kex` collects what KEX itself logs ("[KEX]" warnings and errors from our code). */
function watch(page: Page): Seen {
  const seen: Seen = { kex: [], errors: [] };
  page.on('pageerror', (e) => {
    const msg = e.message.slice(0, 160);
    (/kex|content\.js/i.test(e.stack ?? '') ? seen.kex : seen.errors).push(`pageerror: ${msg}`);
  });
  page.on('console', (m) => {
    const text = m.text();
    if (/\[KEX\]/.test(text) && (m.type() === 'error' || m.type() === 'warning')) seen.kex.push(text.slice(0, 200));
    else if (m.type() === 'error') seen.errors.push(`console: ${text.replace(/https?:\/\/\S+/g, '<url>').slice(0, 160)}`);
  });
  return seen;
}

const chrome = (page: Page) => page.locator('[data-kex-test="chrome"]');
async function ready(page: Page): Promise<void> {
  await waitForShell(page);
  await page.waitForFunction(() => document.documentElement.dataset.kexChrome !== undefined || document.documentElement.dataset.kexFocus !== undefined);
}

test.describe.configure({ mode: 'serial' });

test.describe('activity pages with KEX on', () => {
  test.use({ seed: iter3Seed({ theme: 'light', debug: { freezeTime: 7.3 } }) });
  test.beforeAll(resetLab);
  test.afterAll(resetLab);

  test('resource: the viewer or card and Download', async ({ page }) => {
    const seen = watch(page);
    await page.goto('/mod/resource/view.php?id=162'); // display "open in new window": Moodle's click-to-open page
    await ready(page);
    await expect(chrome(page)).toBeVisible();
    await expect(page.locator('[data-kex-test="band-label"]')).toContainText('TOPIC');
    // Docx has no preview: the download card; its link forces a download.
    await expect(page.locator('[data-kex-test="filecard"]')).toBeVisible();
    await expect(page.locator('[data-kex-test="filecard-download"]')).toHaveAttribute('href', /forcedownload=1/);
    await expect(page.locator('.resourceworkaround')).toBeHidden();
    expect(seen.kex).toEqual([]);
    await page.goto('/mod/resource/view.php?id=161'); // embedded PDF: Moodle's own object, full height
    await ready(page);
    await expect(page.locator('[data-kex-test="chrome-download"]')).toBeVisible();
    const h = await page.locator('#resourceobject, .resourcecontent object, .resourcecontent iframe').first().evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(600);
  });

  test('url: the card shows the host, c copies, Open targets a new tab', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const seen = watch(page);
    await page.goto('/mod/url/view.php?id=2');
    await ready(page);
    await expect(page.locator('[data-kex-test="urlcard-host"]')).toHaveText(/wikipedia\.org/i);
    await expect(page.locator('[data-kex-test="urlcard-open"]')).toHaveAttribute('target', '_blank');
    await page.locator('body').click({ position: { x: 900, y: 600 } });
    await page.keyboard.press('c');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^https:\/\/en\.wikipedia\.org/);
    expect(seen.kex).toEqual([]);
  });

  test('page: article and the previous / next bar', async ({ page }) => {
    const seen = watch(page);
    await page.goto('/mod/page/view.php?id=3');
    await ready(page);
    await expect(page.locator('[data-kex-test="prevnext"]')).toBeVisible();
    const here = page.url();
    await page.keyboard.press(']');
    await expect(page).not.toHaveURL(here);
    await ready(page);
    await page.keyboard.press('[');
    await expect(page).toHaveURL(here);
    expect(seen.kex).toEqual([]);
  });

  test('assign: view, upload a file, Ctrl+Enter saves, status pill shows', async ({ page }) => {
    const seen = watch(page);
    await page.goto(`/mod/assign/view.php?id=${REPORT_CM}`);
    await ready(page);
    await expect(page.locator('[data-kex-test="band-title"]')).toContainText('Report: cloud migration plan');
    await expect(page.locator('.submissionstatustable .kex-pill').first()).toBeVisible();
    await page.getByRole('button', { name: 'Add submission' }).or(page.getByRole('link', { name: 'Add submission' })).first().click();
    await page.waitForURL(/action=editsubmission/);
    await ready(page);
    // filemanager: upload through Moodle's own file picker
    await page.locator('.fp-btn-add a, .fp-btn-add button').first().click();
    await page.locator('.fp-repo-area .fp-repo', { hasText: 'Upload a file' }).locator('a').click();
    await page.locator('.fp-upload-form input[type="file"]').first().setInputFiles({ name: 'kex-report.txt', mimeType: 'text/plain', buffer: Buffer.from('KEX e2e upload') });
    await page.locator('.fp-upload-btn').click();
    await expect(page.locator('.fp-filename').filter({ hasText: 'kex-report.txt' }).first()).toBeVisible();
    // the editor lives in an iframe (TinyMCE): Ctrl+Enter inside it submits too
    const editor = page.frameLocator('iframe[id$="_ifr"]').locator('body');
    await editor.click();
    await page.keyboard.type('KEX e2e submission text');
    await page.keyboard.press('Control+Enter');
    await page.waitForURL(/view\.php\?id=154/);
    await ready(page);
    await expect(page.locator('.submissionstatustable')).toContainText('kex-report.txt');
    await expect(page.locator('.submissionstatustable .kex-pill').first()).toContainText(/Draft|Submitted/);
    expect(seen.kex).toEqual([]);
  });

  test('quiz: view, attempt in focus mode, answer, submit, review; Alt+Shift+O shows pure Moodle', async ({ page }) => {
    const seen = watch(page);
    await page.goto(`/mod/quiz/view.php?id=${QUIZ_CM}`);
    await ready(page);
    await expect(chrome(page)).toBeVisible();
    await page.getByRole('button', { name: /Attempt quiz/ }).click();
    const start = page.locator('#id_submitbutton, .modal-footer button:has-text("Start attempt")');
    await start.first().click();
    await page.waitForURL(/\/attempt\.php/);
    await ready(page);
    // focus mode: rail sidebar, no band, the nav block as a right rail, the timer as a pill
    const attr = (n: string) => page.evaluate((k) => document.documentElement.getAttribute(k), n);
    expect(await attr('data-kex-focus')).toBe('true');
    expect(await attr('data-kex-sidebar')).toBe('rail');
    await expect(chrome(page)).toHaveCount(0);
    const nav = page.locator('#mod_quiz_navblock');
    await expect(nav).toBeVisible();
    expect((await nav.boundingBox())?.width).toBeGreaterThan(200);
    await expect(page.locator('#quiz-timer')).toBeVisible();
    expect(await page.locator('.qn_buttons a.qnbutton').first().evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(32);
    // hotkeys are off except Ctrl+K and Alt+Shift+O
    await page.locator('body').click({ position: { x: 900, y: 700 } });
    await page.keyboard.press('t');
    expect(await attr('data-kex-theme')).toBe('light');
    // Alt+Shift+O: pure Moodle (the blocks drawer is Moodle's again), then back
    await page.keyboard.press('Alt+Shift+O');
    await expect.poll(() => attr('data-kex')).toBe('off');
    await expect(page.locator('nav.navbar').first()).toBeVisible();
    await page.keyboard.press('Alt+Shift+O');
    await expect.poll(() => attr('data-kex')).toBe('skin');
    await expect(nav).toBeVisible();
    // answer: Q1 radio, Q2 true, Q3 text
    await page.getByLabel('containerd').check();
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.waitForURL(/page=1/);
    await ready(page);
    await page.getByLabel('True', { exact: true }).check();
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.waitForURL(/page=2/);
    await ready(page);
    await page.locator('input[type="text"][id*="answer"]').first().fill('Dockerfile');
    await page.getByRole('link', { name: /Finish attempt/ }).first().click();
    await page.waitForURL(/summary\.php/);
    await ready(page);
    await expect(page.locator('#mod_quiz_navblock')).toBeVisible();
    await page.getByRole('button', { name: 'Submit all and finish' }).first().click();
    const confirm = page.locator('.modal.show .modal-footer button:has-text("Submit all and finish")');
    if (await confirm.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)) await confirm.click();
    await page.waitForURL(/review\.php/);
    await ready(page);
    await expect(page.locator('.quizreviewsummary')).toContainText('10.00');
    await expect(page.locator('.que.correct').first()).toBeVisible();
    await expect(chrome(page)).toBeVisible();
    expect(seen.kex).toEqual([]);
  });

  test('forum: list, discussion, post a reply', async ({ page }) => {
    const seen = watch(page);
    await page.goto('/mod/forum/view.php?id=34');
    await ready(page);
    expect(await page.locator('table.discussion-list tbody tr').first().evaluate((e) => Math.round(e.getBoundingClientRect().height))).toBeGreaterThanOrEqual(54);
    await page.locator('table.discussion-list th.topic a', { hasText: 'How do I expose' }).click();
    await page.waitForURL(/discuss\.php/);
    await ready(page);
    await expect(page.locator('.forumpost').first()).toBeVisible();
    await page.locator(`article#p1 a:has-text("Reply")`).first().click();
    const box = page.locator('[data-region="inpage-reply"] textarea, [data-content="inpage-reply-content"] textarea, form.mform textarea').first();
    await box.fill('KEX e2e reply: NodePort worked, thanks.');
    await page.getByRole('button', { name: /Post to forum/ }).first().click();
    await expect(page.locator('.forumpost', { hasText: 'KEX e2e reply' }).first()).toBeVisible({ timeout: 15_000 });
    expect(seen.kex).toEqual([]);
  });
});

/** Moodle's own JS errors must not change with KEX on: the same pages with and without the extension. */
test.describe('console parity', () => {
  test.use({ seed: iter3Seed({ theme: 'light', debug: { freezeTime: 7.3 } }) });
  const PAGES = [
    '/mod/resource/view.php?id=161', '/mod/url/view.php?id=2', '/mod/page/view.php?id=3', '/mod/assign/view.php?id=15', '/mod/quiz/view.php?id=8',
    '/mod/forum/view.php?id=34', `/mod/forum/discuss.php?d=${FORUM_DISCUSS}`, '/mod/folder/view.php?id=158', '/mod/book/view.php?id=159', '/mod/choice/view.php?id=160',
  ];
  test('KEX adds no console errors and removes none', async ({ page, context }) => {
    const on = watch(page);
    const plain = await context.newPage();
    const off = watch(plain);
    for (const p of PAGES) {
      await page.goto(p);
      await ready(page);
      await page.waitForTimeout(500);
      await plain.goto(p);
      await plain.waitForLoadState('load');
      await plain.waitForTimeout(500);
    }
    expect(on.kex, 'errors logged by KEX').toEqual([]);
    expect([...new Set(on.errors)].sort(), 'Moodle errors with KEX on equal those with KEX off').toEqual([...new Set(off.errors)].sort());
  });
});

/** axe on skin pages: only violations that exist with KEX on and not in plain Moodle count (those come from our CSS). */
test.describe('axe on skin pages', () => {
  const PAGES = [
    '/mod/assign/view.php?id=12', '/mod/forum/view.php?id=34', `/mod/forum/discuss.php?d=${FORUM_DISCUSS}`, '/mod/url/view.php?id=2', '/mod/page/view.php?id=3',
    '/mod/folder/view.php?id=158', '/mod/book/view.php?id=159', '/mod/quiz/view.php?id=8', '/mod/assign/view.php?id=99999',
  ];
  async function violations(page: Page): Promise<Map<string, string>> {
    const res = await new AxeBuilder({ page }).analyze();
    const m = new Map<string, string>();
    for (const v of res.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
      for (const n of v.nodes) m.set(`${v.id}|${n.target.join(' ')}`, `${v.id}: ${n.target.join(' ')} ${n.any.map((a) => a.message).join(';').slice(0, 140)}`);
    }
    return m;
  }
  for (const theme of ['light', 'dark'] as const) {
    test(`no serious or critical violations from KEX CSS (${theme})`, async ({ browser, studentState }) => {
      test.setTimeout(300_000);
      const seed = iter3Seed({ theme, debug: { freezeTime: 7.3 } });
      const ctx = await browser.newContext({ storageState: studentState, viewport: { width: 1585, height: 992 } });
      const on = await ctx.newPage();
      await installKex(on, seed);
      const off = await ctx.newPage();
      const bad: string[] = [];
      for (const p of PAGES) {
        await on.goto(p);
        await waitForShell(on);
        await on.waitForTimeout(700);
        await off.goto(p);
        await off.waitForTimeout(700);
        const [a, b] = [await violations(on), await violations(off)];
        for (const [k, v] of a) if (!b.has(k)) bad.push(`${p} ${v}`);
      }
      await ctx.close();
      expect(bad).toEqual([]);
    });
  }
});
