import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, LAB } from './fixtures';
import { iter3Seed, root } from '../harness/kex';

/** M5 acceptance (implementation-plan): Login, Notifications, Grades overview. Runs against the lab. */

function resetNotifications(): void {
  execSync('docker cp tools/lab/m3_reset.php moodle-lab-moodle-1:/tmp/m3_reset.php && docker exec -u nobody moodle-lab-moodle-1 php /tmp/m3_reset.php', { stdio: 'ignore' });
}

const guest = { cookies: [], origins: [] };

test.describe('login (stock Moodle 5 form)', () => {
  test.use({ storageState: guest, seed: iter3Seed({ theme: 'dark' }) });

  test('username and password sign in through our view', async ({ page }) => {
    await page.goto('/login/index.php');
    await page.waitForSelector('#kex-root [data-kex-test="login"]');
    await expect(page.locator('html')).toHaveAttribute('data-kex', 'app');
    // No identity providers on stock Moodle: the form is shown directly and is Moodle's own (token kept).
    await expect(page.locator('#kex-root form#login input[name="logintoken"]')).toHaveCount(1);
    await expect(page.locator('[data-kex-test="login-more"]')).toHaveCount(0);
    await page.fill('#kex-root #username', 'student');
    await page.fill('#kex-root #password', 'Student#2026');
    await Promise.all([page.waitForURL(/\/my\//), page.keyboard.press('Enter')]);
    await page.waitForSelector('#kex-root [data-kex-test="workspace"]');
  });

  test('a wrong password shows Moodle\'s error as our alert', async ({ page }) => {
    await page.goto('/login/index.php');
    await page.waitForSelector('#kex-root form#login');
    await page.fill('#kex-root #username', 'student');
    await page.fill('#kex-root #password', 'nope');
    await Promise.all([page.waitForURL(/login\/index\.php/), page.click('#kex-root #loginbtn')]);
    await expect(page.locator('[data-kex-test="login-error"]')).toBeVisible();
  });
});

test.describe('login (TalTech markup, captures/pages/login_index.html)', () => {
  test.use({ storageState: guest, seed: iter3Seed({ theme: 'dark' }) });
  const html = readFileSync(path.join(root, 'captures/pages/login_index.html'), 'utf8');

  async function open(page: Page, last?: string): Promise<string[]> {
    const hits: string[] = [];
    await page.route(`${LAB}/login/index.php**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await page.route('https://moodle.taltech.ee/**', (route) => {
      const u = route.request().url();
      if (route.request().resourceType() === 'document') {
        hits.push(u);
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>idp</title>' });
      }
      return route.abort();
    });
    if (last) await page.addInitScript(`localStorage.setItem('kex.lastIdp', ${JSON.stringify(last)})`);
    await page.goto('/login/index.php');
    await page.waitForSelector('#kex-root [data-kex-test="login"]');
    return hits;
  }

  test('four providers, the form behind "More sign-in options", languages and help', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-kex-test="login-idp"]')).toHaveCount(4);
    await expect(page.locator('[data-kex-test="login-idp"][data-primary="true"]')).toHaveCount(1);
    await expect(page.locator('#kex-root form#login')).toBeHidden();
    await page.keyboard.press('m');
    await expect(page.locator('#kex-root form#login')).toBeVisible();
    await page.keyboard.press('m');
    await expect(page.locator('#kex-root form#login')).toBeHidden();
    await expect(page.locator('[data-kex-test="login-help"]')).toBeVisible();
  });

  test('Enter follows Uni-ID by default and the last used provider afterwards; digits pick one', async ({ page }) => {
    await open(page);
    const idps = await page.locator('[data-kex-test="login-idp"]').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    const primary = await page.locator('[data-kex-test="login-idp"][data-primary="true"]').evaluate((e) => (e as HTMLAnchorElement).href);
    await Promise.all([page.waitForURL((u) => u.href === primary), page.keyboard.press('Enter')]);
    // The choice is remembered on the login page's own origin.
    await page.goBack();
    await page.waitForSelector('#kex-root [data-kex-test="login"]');
    expect(await page.evaluate(() => localStorage.getItem('kex.lastIdp'))).toBe(primary);

    const other = idps.find((h) => h !== primary) as string;
    const p2 = await page.context().newPage();
    await (await import('../harness/kex')).installKex(p2, iter3Seed({ theme: 'dark' }));
    await p2.addInitScript(`localStorage.setItem('kex.lastIdp', ${JSON.stringify(other)})`);
    await p2.route(`${LAB}/login/index.php**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await p2.route('https://moodle.taltech.ee/**', (route) => (route.request().resourceType() === 'document' ? route.fulfill({ status: 200, contentType: 'text/html', body: '<title>idp</title>' }) : route.abort()));
    await p2.goto('/login/index.php');
    await p2.waitForSelector('#kex-root [data-kex-test="login"]');
    await expect(p2.locator('[data-kex-test="login-idp"][data-primary="true"]')).toHaveAttribute('href', other);
    await Promise.all([p2.waitForURL((u) => u.href === other), p2.keyboard.press('Enter')]);
    const third = idps[2] as string;
    const p3 = await page.context().newPage();
    await (await import('../harness/kex')).installKex(p3, iter3Seed({ theme: 'dark' }));
    await p3.route(`${LAB}/login/index.php**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await p3.route('https://moodle.taltech.ee/**', (route) => (route.request().resourceType() === 'document' ? route.fulfill({ status: 200, contentType: 'text/html', body: '<title>idp</title>' }) : route.abort()));
    await p3.goto('/login/index.php');
    await p3.waitForSelector('#kex-root [data-kex-test="login"]');
    await Promise.all([p3.waitForURL((u) => u.href === third), p3.keyboard.press('3')]);
  });
});

test.describe('grades overview', () => {
  test.use({ seed: iter3Seed({ theme: 'light' }) });

  test('rows with mono grades, tabs by hash and keys, Enter opens the user report', async ({ page }) => {
    await page.goto('/grade/report/overview/index.php');
    await page.waitForSelector('#kex-root [data-kex-test="grades"] [data-kex-test="gr-row-1"]');
    await page.waitForFunction(() => document.documentElement.dataset.kexData === 'idle');
    const rows = page.locator('[data-kex-test="gr-rows"] > li');
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
    const font = await page.locator('[data-kex-test="gr-grade"]').first().evaluate((e) => getComputedStyle(e).fontFamily);
    expect(font).toContain('JetBrains');
    const h = await rows.first().evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBe(56);
    await page.keyboard.press('2');
    await expect(page).toHaveURL(/#all$/);
    await page.keyboard.press('1');
    await page.keyboard.press('j');
    await expect(rows.nth(1)).toBeFocused();
    await Promise.all([page.waitForURL(/\/course\/user\.php|\/grade\/report\/user\//), page.keyboard.press('Enter')]);
    // The user report is a skin page with the band labelled by the course code.
    await page.waitForSelector('#kex-root [data-kex-test="chrome"], #kex-root .kex-band');
    await expect(page.locator('.kex-band__label, [data-kex-test="band-label"]').first()).toContainText('GRADES');
  });
});

test.describe('notifications', () => {
  test.use({ seed: iter3Seed({ theme: 'light' }) });
  test.beforeAll(resetNotifications);
  test.afterAll(resetNotifications);

  test('two columns, j/k, m and Shift+M update the sidebar badge without a reload', async ({ page }) => {
    await page.goto('/message/output/popup/notifications.php');
    await page.waitForSelector('#kex-root [data-kex-test="notifications"] [data-kex-test="nf-row-1"]');
    await page.waitForFunction(() => document.documentElement.dataset.kexData === 'idle');
    const badge = page.locator('[data-kex-test="sb-unread"]');
    await expect(badge).toBeVisible();
    const before = Number(await badge.textContent());
    expect(before).toBeGreaterThan(2);
    await expect(page.locator('.kex-band__label, [data-kex-test="band"]').first()).toContainText(`${before} UNREAD`);
    await expect(page.locator('[data-kex-test="nf-detail"]')).toBeVisible();
    const listW = await page.locator('[data-kex-test="nf-list"]').evaluate((e) => e.getBoundingClientRect().width);
    expect(listW).toBeGreaterThan(370);
    expect(listW).toBeLessThan(400);

    // j moves the selection and the detail follows.
    const title1 = await page.locator('[data-kex-test="nf-detail"] h2').textContent();
    await page.keyboard.press('j');
    await expect(page.locator('[data-kex-test="nf-row-2"]')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => page.locator('[data-kex-test="nf-detail"] h2').textContent()).not.toBe(title1);

    // m marks the selected one read; the badge and the band count drop in step.
    await page.keyboard.press('m');
    await expect(badge).toHaveText(String(before - 1));
    await expect(page.locator('[data-kex-test="nf-row-2"]')).not.toHaveClass(/kex-nfrow--unread/);
    await expect.poll(() => page.evaluate(async () => {
      const cfg = (window as unknown as { M: { cfg: { sesskey: string } } }).M.cfg;
      const r = await fetch(`/lib/ajax/service.php?sesskey=${cfg.sesskey}&info=x`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ index: 0, methodname: 'message_popup_get_unread_popup_notification_count', args: { useridto: 3 } }]) });
      return ((await r.json()) as { data: number }[])[0]?.data;
    })).toBe(before - 1);

    // Shift+M marks everything read.
    await page.keyboard.press('Shift+M');
    await expect(badge).toHaveCount(0);
    await expect(page.locator('[data-kex-test="nf-readall"]')).toBeDisabled();
    await expect(page.locator('.kex-nfrow--unread')).toHaveCount(0);
    expect(page.url()).toContain('/message/output/popup/notifications.php');
  });

  test('Enter opens the notification target and marks it read', async ({ page }) => {
    await page.goto('/message/output/popup/notifications.php');
    await page.waitForSelector('#kex-root [data-kex-test="nf-row-1"]');
    await page.waitForFunction(() => document.documentElement.dataset.kexData === 'idle');
    const href = await page.locator('[data-kex-test="nf-open"]').getAttribute('href');
    expect(href).toBeTruthy();
    await Promise.all([page.waitForURL((u) => u.href === href), page.keyboard.press('Enter')]);
  });
});
