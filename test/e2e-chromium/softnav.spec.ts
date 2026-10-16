import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { COURSE_ITI, seedWithPins } from '../harness/kex';

/** Round 2 package B: soft navigation, shell snapshot, Workspace course filter, sidebar rows. Runs against the lab (English, html lang="en"). */

const mark = (page: Page) => page.evaluate(() => ((window as unknown as { __kexMark: number }).__kexMark = 1));
const marked = (page: Page) => page.evaluate(() => (window as unknown as { __kexMark?: number }).__kexMark === 1);

async function openWorkspace(page: Page, query = ''): Promise<void> {
  await page.goto(`/my/${query}`);
  await page.waitForSelector('#kex-root [data-kex-test="workspace"]');
  await page.waitForFunction(() => document.documentElement.dataset.kexData === 'idle');
}

test.describe('soft navigation', () => {
  test.use({ seed: seedWithPins([], { theme: 'light', debug: { freezeTime: 7.3 } }) });

  test('sidebar rows open app views without a reload, back and forward swap in place', async ({ page }) => {
    await openWorkspace(page);
    await mark(page);
    await page.evaluate(() => document.querySelector('.kex-sidebar')?.setAttribute('data-probe', 'same-node'));

    await page.locator('[data-kex-test="sb-mycourses"]').click();
    await expect(page).toHaveURL(/\/my\/courses\.php$/);
    await expect(page.locator('[data-kex-test="mycourses"]')).toBeVisible();
    await expect(page.locator('[data-kex-test="workspace"]')).toHaveCount(0);
    expect(await marked(page), 'no page load').toBe(true);
    await expect(page.locator('.kex-sidebar')).toHaveAttribute('data-probe', 'same-node');
    await expect(page.locator('[data-kex-test="sb-mycourses"]')).toHaveAttribute('aria-current', 'page');

    await page.locator('.kex-sb__course[data-course-id]').first().click();
    await expect(page).toHaveURL(/\/course\/view\.php\?id=\d+/);
    await expect(page.locator('[data-kex-test="course"]')).toBeVisible();
    expect(await marked(page), 'course view opened in place').toBe(true);

    await page.goBack();
    await expect(page).toHaveURL(/\/my\/courses\.php$/);
    await expect(page.locator('[data-kex-test="mycourses"]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('[data-kex-test="workspace"]')).toBeVisible();
    await page.goForward();
    await expect(page.locator('[data-kex-test="mycourses"]')).toBeVisible();
    expect(await marked(page), 'history traversal stays in the page').toBe(true);
  });

  test('course to course swaps the whole view and follows the school of the course code', async ({ page }) => {
    await page.goto(`/course/view.php?id=${COURSE_ITI}`);
    await page.waitForSelector('#kex-root [data-kex-test="course"]');
    await page.waitForFunction(() => document.documentElement.dataset.kexData === 'idle');
    await mark(page);
    await expect(page.locator('html')).toHaveAttribute('data-kex-school', 'it');
    const other = page.locator('.kex-sb__course[data-course-id]:not(.kex-sb__course--active)').first();
    const code = await other.locator('.kex-sb__code').first().textContent();
    await other.click();
    await expect(page.locator('[data-kex-test="course"]')).toHaveAttribute('data-kex-course', /^(?!2$)\d+$/);
    expect(await marked(page)).toBe(true);
    const school = (code ?? '').trim().startsWith('E') ? 'eng' : (code ?? '').trim().startsWith('M') ? 'sea' : 'it';
    await expect(page.locator('html')).toHaveAttribute('data-kex-school', school);
  });

  test('pages Moodle runs itself are normal loads (calendar)', async ({ page }) => {
    await openWorkspace(page);
    await mark(page);
    await page.locator('[data-kex-test="sb-calendar"]').click();
    await expect(page).toHaveURL(/\/calendar\/view\.php/);
    await page.waitForLoadState('load');
    expect(await marked(page), 'a hard load resets the window').toBe(false);
  });

  test('the first sidebar rows: Moodle labels, messages badge, one Settings that links to Moodle preferences', async ({ page }) => {
    await openWorkspace(page);
    for (const id of ['sb-mycourses', 'sb-calendar', 'sb-messages', 'sb-grades', 'sb-preferences']) await expect(page.locator(`[data-kex-test="${id}"]`)).toBeVisible();
    // Moodle's own words for the new rows; the Workspace keeps KEX's own name.
    await expect(page.locator('[data-kex-test="sb-mycourses"] .kex-sb__rowlabel')).toHaveText('My courses');
    await expect(page.locator('[data-kex-test="sb-workspace"] .kex-sb__rowlabel')).toHaveText('Workspace');
    await expect(page.locator('[data-kex-test="sb-settings"]')).toHaveCount(1);
    await page.locator('[data-kex-test="sb-settings"]').click();
    await expect(page.locator('[data-kex-test="quick-settings"] [data-kex-test="qs-moodle-prefs"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('[data-kex-test="sb-user"]').click();
    const labels = await page.locator('[data-kex-test="user-menu"] [role="menuitem"]').allTextContents();
    expect(labels.length).toBeLessThanOrEqual(2 + 6);
    expect(labels.join('|')).not.toMatch(/Grades|Calendar|Preferences|Private files/);
  });
});

test.describe('Workspace course filter', () => {
  test.use({ seed: seedWithPins([], { theme: 'light', debug: { freezeTime: 7.3 } }) });

  test('the course card filters in place (URL parameter), All resets, deadlines sit under course headings', async ({ page }) => {
    await openWorkspace(page);
    await expect(page.locator('[data-kex-test="feed-group"]').first()).toBeVisible();
    const before = await page.locator('[data-kex-test="feed-rows"] > li[data-kex-item]').count();
    await mark(page);
    const card = page.locator('[data-kex-test="ws-course"]').first();
    const id = await card.getAttribute('data-kex-wc');
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/my/\\?course=${id}$`));
    expect(await marked(page), 'no navigation').toBe(true);
    await expect(page.locator('[data-kex-test="ws-filter"]')).toBeVisible();
    const groups = await page.locator('[data-kex-test="feed-group"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-course-id')));
    expect(groups.every((g) => g === id)).toBe(true);
    await page.locator('[data-kex-test="ws-course-all"]').click();
    await expect(page).toHaveURL(/\/my\/$/);
    await expect(page.locator('[data-kex-test="ws-filter"]')).toHaveCount(0);
    expect(await page.locator('[data-kex-test="feed-rows"] > li[data-kex-item]').count()).toBe(before);
    await page.goto(`/my/?course=${id}`);
    await page.waitForSelector('[data-kex-test="ws-filter"]');
    await expect(page.locator('[data-kex-test="ws-course"][aria-current="true"]')).toHaveAttribute('data-kex-wc', id ?? '');
  });

  test('the COURSES heading is the way to My courses', async ({ page }) => {
    await openWorkspace(page);
    await mark(page);
    await page.locator('[data-kex-test="ws-courses-link"]').click();
    await expect(page.locator('[data-kex-test="mycourses"]')).toBeVisible();
    expect(await marked(page)).toBe(true);
  });
});

test.describe('shell snapshot', () => {
  test.use({ seed: seedWithPins([], { theme: 'dark', debug: { freezeTime: 7.3 } }) });

  test('a slow hard load keeps the sidebar and header painted, dark, before the page arrives', async ({ page }) => {
    await openWorkspace(page);
    // The snapshot is written once the page settled (or on pagehide).
    await page.waitForFunction(() => !!window.localStorage.getItem('kex.shell'), undefined, { timeout: 8000 });
    await page.route('**/course/view.php*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(`/course/view.php?id=${COURSE_ITI}`, { waitUntil: 'commit' });
    const snap = page.locator('#kex-root[data-kex-snapshot]');
    await expect(snap.locator('.kex-sidebar')).toBeVisible({ timeout: 1200 });
    await expect(snap.locator('.kex-header')).toBeVisible();
    // The course entry is already the active one, and the page background is the dark theme's, not white.
    await expect(snap.locator('.kex-sb__course--active')).toHaveCount(1);
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(bg).toBe('rgb(15, 11, 31)');
    await page.waitForSelector('#kex-root:not([data-kex-snapshot]) [data-kex-test="course"]');
    await expect(page.locator('[data-kex-snapshot]')).toHaveCount(0);
  });
});
