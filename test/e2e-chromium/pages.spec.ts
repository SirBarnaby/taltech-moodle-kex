import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, LAB, waitForShell, installKex } from './fixtures';
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

/** Skin+ areas (page-designs §8-§16): label, title, the specific restyle hooks, and axe in both themes. */
const SKIN_PAGES: { path: string; label: RegExp; title?: string; check: (page: Page) => Promise<void> }[] = [
  {
    path: '/course/user.php?mode=grade&id=2&user=3',
    label: /^GRADES \/ ITI8801$/,
    title: 'Cloud & DevOps',
    check: async (page) => {
      await expect(page.locator('table.user-grade tbody tr .item').first()).toBeVisible();
      const align = await page.locator('table.user-grade td.column-range').first().evaluate((e) => getComputedStyle(e).textAlign);
      expect(align).toBe('right');
      const font = await page.locator('table.user-grade td.column-percentage').first().evaluate((e) => getComputedStyle(e).fontFamily);
      expect(font).toContain('JetBrains');
      const total = await page.locator('table.user-grade th.baggt').first().evaluate((e) => getComputedStyle(e).borderTopWidth);
      expect(parseFloat(total)).toBeGreaterThanOrEqual(2);
    },
  },
  {
    path: '/calendar/view.php?view=month',
    label: /^CALENDAR \/ [A-Z]+ \d{4}$/,
    check: async (page) => {
      await expect(page.locator('[data-kex-test="cal-tabs"] [role="tab"]')).toHaveCount(3);
      await expect(page.locator('[data-region="view-selector"]').first()).toBeHidden();
      const today = await page.locator('table.calendarmonth td.today .day-number-circle >> nth=0').evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(today).not.toBe('rgba(0, 0, 0, 0)');
      // The tab presses Moodle's own dropdown item: the view changes without a page load.
      await page.locator('[data-kex-test="cal-tabs"] [data-tab="upcoming"]').click();
      await expect(page.locator('[data-kex-test="cal-tabs"] [data-tab="upcoming"]')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-kex-test="band-label"]')).toContainText('UPCOMING');
    },
  },
  {
    path: '/message/index.php?id=4',
    label: /^MESSAGES$/,
    check: async (page) => {
      await page.waitForSelector('.message-app .message[data-region="message"]');
      const hidden = await page.locator('.message-app [data-region="retry-send"]').first().evaluate((e) => getComputedStyle(e).display);
      expect(hidden, 'Moodle hides the retry button with .hidden; the skin must not bring it back').toBe('none');
      const bg = await page.locator('.message-app .message.received').first().evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    },
  },
  {
    path: '/user/profile.php',
    label: /^PROFILE$/,
    check: async (page) => {
      const cols = await page.locator('.profile_tree').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
      expect(cols).toBe(2);
    },
  },
  {
    path: '/user/preferences.php',
    label: /^PREFERENCES$/,
    title: 'Preferences',
    check: async (page) => {
      const row = await page.locator('#page-user-preferences .card-text li a').first().evaluate((e) => ({ h: e.getBoundingClientRect().height, after: getComputedStyle(e, '::after').content }));
      expect(row.h).toBeGreaterThanOrEqual(44);
      expect(row.after).toContain('\u203A');
    },
  },
  {
    path: '/user/index.php?id=2',
    label: /^PARTICIPANTS \/ ITI8801$/,
    check: async (page) => {
      await expect(page.locator('#participants .kex-col-roles .kex-role').first()).toBeVisible();
      const av = await page.locator('#participants :is(td, th).c1 :is(.userinitials, img.userpicture)').first().evaluate((e) => e.getBoundingClientRect().width);
      expect(av).toBe(28);
    },
  },
  {
    path: '/badges/mybadges.php',
    label: /^BADGES$/,
    title: 'Badges',
    check: async (page) => {
      const w = await page.locator('ul.badges > li').first().evaluate((e) => e.getBoundingClientRect().width);
      expect(w).toBe(180);
    },
  },
  {
    path: '/course/index.php?categoryid=2',
    label: /^CATALOGUE$/,
    check: async () => undefined,
  },
  {
    path: '/course/search.php?search=cloud',
    label: /^SEARCH \/ "CLOUD"$/,
    title: 'Search',
    check: async (page) => {
      const code = await page.locator('.coursebox .coursename .kex-coursecode').first().textContent();
      expect(code).toBe('ITI8801');
      // The code left the Moodle link text; the link still points at the course.
      await expect(page.locator('.coursebox .coursename a').first()).toHaveAttribute('href', /course\/view\.php\?id=2/);
    },
  },
];

test.describe('skin+ pages', () => {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(theme, () => {
      test.use({ seed: iter3Seed({ theme, debug: { freezeTime: 7.3 } }) });
      for (const sp of SKIN_PAGES) {
        test(`${sp.path}`, async ({ page }) => {
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          await page.goto(sp.path);
          await waitForShell(page);
          await page.waitForSelector('[data-kex-test="band"]');
          await expect(page.locator('html')).toHaveAttribute('data-kex-theme', theme);
          await expect(page.locator('[data-kex-test="band-label"]')).toHaveText(sp.label);
          if (sp.title) await expect(page.locator('[data-kex-test="band-title"]')).toContainText(sp.title);
          await sp.check(page);
          expect(errors, 'no uncaught errors').toEqual([]);
        });
      }
    });
  }

  test('axe: no serious or critical violations from KEX CSS (light and dark)', async ({ browser, studentState }) => {
    test.setTimeout(400_000);
    const bad: string[] = [];
    for (const theme of ['light', 'dark'] as const) {
      const ctx = await browser.newContext({ storageState: studentState, viewport: { width: 1585, height: 992 } });
      const on = await ctx.newPage();
      await installKex(on, iter3Seed({ theme, debug: { freezeTime: 7.3 } }));
      const off = await ctx.newPage();
      const run = async (p: Page): Promise<Map<string, string>> => {
        const res = await new AxeBuilder({ page: p }).analyze();
        const m = new Map<string, string>();
        for (const v of res.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
          for (const n of v.nodes) m.set(`${v.id}|${n.target.join(' ').replace(/[0-9a-f]{16,}/g, '#')}`, `${v.id}: ${n.target.join(' ')} ${n.any.map((a) => a.message).join(';').slice(0, 140)}`);
        }
        return m;
      };
      for (const sp of SKIN_PAGES) {
        await on.goto(sp.path);
        await waitForShell(on);
        await on.waitForTimeout(900);
        await off.goto(sp.path);
        await off.waitForTimeout(900);
        const [a, b] = [await run(on), await run(off)];
        for (const [k, v] of a) if (!b.has(k)) bad.push(`${theme} ${sp.path} ${v}`);
      }
      await ctx.close();
    }
    expect(bad).toEqual([]);
  });
});

test.describe('participants (TalTech markup, captures/pages/user_index__id-37582.html)', () => {
  test.use({ seed: iter3Seed({ theme: 'light', debug: { freezeTime: 7.3 } }) });
  test('the Estonian capture is restyled: roles as pills, 28 px avatars, band label', async ({ page }) => {
    const html = readFileSync(path.join(root, 'captures/pages/user_index__id-37582.html'), 'utf8');
    await page.route(`${LAB}/user/index.php**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await page.route('https://moodle.taltech.ee/**', (route) => route.abort());
    await page.goto('/user/index.php?id=37582');
    await page.waitForSelector('[data-kex-test="band"]');
    await expect(page.locator('html')).toHaveAttribute('data-kex', 'skin');
    await expect(page.locator('[data-kex-test="band-label"]')).toHaveText(/^(PARTICIPANTS|OSALEJAD)/);
    await page.waitForSelector('#participants .kex-col-roles .kex-role');
    expect(await page.locator('#participants tbody td.kex-col-roles .kex-role').count()).toBeGreaterThan(5);
    const w = await page.locator('#participants :is(td, th).c1 :is(img.userpicture, .userinitials)').first().evaluate((e) => e.getBoundingClientRect().width);
    expect(w).toBe(28);
  });
});
