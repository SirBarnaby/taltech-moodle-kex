import { test, expect, waitForShell } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const ROUTES = [
  { path: '/my/', crumbs: [/^Workspace$/] },
  { path: '/course/view.php?id=2', crumbs: [/My courses/, /ITI8801/] },
  { path: '/mod/forum/view.php?id=33', crumbs: [/My courses/, /ITI8801/, /General/, /Announcements/] },
  { path: '/user/profile.php', crumbs: [/Marten Saluste/] },
];

const CODES = ['EMT0140', 'IAS0230', 'IEE2630', 'ITB8833', 'ITI8801', 'MMO5770'];

test.describe('shell on lab pages', () => {
  for (const route of ROUTES) {
    test(`sidebar, breadcrumb, navbar: ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await waitForShell(page);

      const codes = await page.locator('.kex-sb__course .kex-sb__code:not(.kex-sb__code--rail)').allTextContents();
      expect(codes.map((c) => c.trim()).sort()).toEqual(CODES);

      const active = page.locator('[data-kex-test=sb-active-course]');
      if (route.path.includes('course/view') || route.path.includes('mod/forum')) {
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('ITI8801');
      } else {
        await expect(active).toHaveCount(0);
      }

      const crumbs = (await page.locator('[data-kex-test=breadcrumb] .kex-crumbs__item').allTextContents()).map((s) => s.trim()).filter(Boolean);
      expect(crumbs).toHaveLength(route.crumbs.length);
      route.crumbs.forEach((re, i) => expect(crumbs[i]).toMatch(re));

      const navVisible = await page.evaluate(() => {
        const nb = document.querySelector('nav.navbar, .navbar.fixed-top');
        if (!nb) return false;
        const s = getComputedStyle(nb);
        const b = nb.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && b.height > 0 && b.bottom > 0;
      });
      expect(navVisible).toBe(false);
    });
  }

  test('header compresses 67 -> 52 without changing scrollHeight', async ({ page }) => {
    await page.goto('/course/view.php?id=2');
    await waitForShell(page);
    const measure = () =>
      page.evaluate(() => ({
        h: document.querySelector('[data-kex-test=header]')!.getBoundingClientRect().height,
        sh: document.documentElement.scrollHeight,
        y: window.scrollY,
      }));
    const top = await measure();
    expect(Math.abs(top.h - 67)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(600);
    const scrolled = await measure();
    expect(scrolled.y).toBeGreaterThanOrEqual(300 - 1);
    expect(Math.abs(scrolled.h - 52)).toBeLessThanOrEqual(1);
    expect(scrolled.sh).toBe(top.sh);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    const back = await measure();
    expect(Math.abs(back.h - 67)).toBeLessThanOrEqual(1);
    expect(back.sh).toBe(top.sh);
  });

  test('palette: Ctrl+K, "iti", Enter, Esc restores focus', async ({ page }) => {
    await page.goto('/my/');
    await waitForShell(page);
    await page.locator('[data-kex-test=search]').focus();
    await page.keyboard.press('Control+k');
    const input = page.locator('[data-kex-test=palette] input');
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-kex-test=palette]')).toHaveCount(0);
    await expect(page.locator('[data-kex-test=search]')).toBeFocused();

    await page.keyboard.press('Control+k');
    await expect(input).toBeFocused();
    await page.keyboard.type('iti');
    await expect(page.locator('[data-kex-test=palette] [role=option]').first()).toContainText('ITI8801');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/course\/view\.php\?id=2/);
  });

  test('theme: `t` flips data-kex-theme and survives a reload without a light flash', async ({ page }) => {
    await page.addInitScript(() => {
      // Sample the root background on every frame until the shell is ready (runs after the extension's own init scripts).
      const w = window as unknown as { __frames: { theme: string | undefined; bg: string }[] };
      w.__frames = [];
      const tick = () => {
        const html = document.documentElement;
        if (html) w.__frames.push({ theme: html.dataset.kexTheme, bg: getComputedStyle(html).backgroundColor });
        if (!html || html.dataset.kexShell !== 'ready') requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto('/my/');
    await waitForShell(page);
    const before = await page.evaluate(() => document.documentElement.dataset.kexTheme);
    expect(before).toBe('light');
    await page.locator('body').click({ position: { x: 800, y: 500 } });
    await page.keyboard.press('t');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.kexTheme)).toBe('dark');

    await page.reload();
    await waitForShell(page);
    expect(await page.evaluate(() => document.documentElement.dataset.kexTheme)).toBe('dark');
    const frames = await page.evaluate(() => (window as unknown as { __frames: { theme: string; bg: string }[] }).__frames);
    expect(frames.length).toBeGreaterThan(0);
    const lum = (bg: string) => {
      const m = bg.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255];
      return (0.2126 * m[0]! + 0.7152 * m[1]! + 0.0722 * m[2]!) / 255;
    };
    const light = frames.filter((f) => lum(f.bg) > 0.6 && f.bg !== 'rgba(0, 0, 0, 0)');
    expect(light, `light frames during dark reload: ${JSON.stringify(light.slice(0, 3))}`).toHaveLength(0);
    // The attribute must already be set by the first sampled frame (boot mirror read before body).
    expect(frames[0]!.theme).toBe('dark');
  });

  test('keyboard: ? opens help, Ctrl+B toggles the rail, Alt+Shift+O toggles KEX off', async ({ page }) => {
    await page.goto('/my/');
    await waitForShell(page);
    await page.locator('body').click({ position: { x: 800, y: 500 } });
    await page.keyboard.press('?');
    await expect(page.locator('[data-kex-test=help]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-kex-test=help]')).toHaveCount(0);

    const mode = () => page.evaluate(() => document.documentElement.dataset.kexSidebar);
    expect(await mode()).toBe('full');
    await page.keyboard.press('Control+b');
    await expect.poll(mode).toBe('rail');
    await page.keyboard.press('Control+b');
    await expect.poll(mode).toBe('full');

    await page.keyboard.press('Alt+Shift+O');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.kex)).toBe('off');
    await expect(page.locator('#kex-offpill')).toBeVisible();
    await page.keyboard.press('Alt+Shift+O');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.kex)).toMatch(/skin|app/);
  });

  test('sidebar breakpoints: drawer below 760, rail below 1100', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto('/my/');
    await waitForShell(page);
    expect(await page.evaluate(() => document.documentElement.dataset.kexSidebar)).toBe('rail');
    await page.setViewportSize({ width: 700, height: 800 });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.kexSidebar)).toBe('drawer');
  });

  test('F2 renames a course (alias) in the sidebar', async ({ page }) => {
    await page.goto('/my/');
    await waitForShell(page);
    const item = page.locator('.kex-sb__course', { hasText: 'ITI8801' }).first();
    await item.focus();
    await page.keyboard.press('F2');
    const input = page.locator('.kex-sb__course--editing input');
    await expect(input).toBeFocused();
    await input.fill('Cloud');
    await page.keyboard.press('Enter');
    await expect(page.locator('.kex-sb__course', { hasText: 'ITI8801' }).first()).toContainText('Cloud');
  });

  test('axe: shell has no serious or critical violations (light and dark)', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.goto('/course/view.php?id=2');
      await waitForShell(page);
      await page.evaluate((t) => {
        document.documentElement.dataset.kexTheme = t;
      }, theme);
      const res = await new AxeBuilder({ page }).include('#kex-root').analyze();
      const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), `${theme} theme`).toEqual([]);
    }
    // Palette open is part of the shell too.
    await page.goto('/my/');
    await waitForShell(page);
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[data-kex-test=palette]');
    const res = await new AxeBuilder({ page }).include('#kex-root').analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => v.id + ' ' + v.nodes.map((n) => n.target.join(' ') + ' ' + n.any.map((a) => a.message).join(';')).join(' | '))).toEqual([]);
  });

  test('screenshots for the milestone report', async ({ page }) => {
    mkdirSync('artifacts/m1', { recursive: true });
    for (const [p, name] of [['/my/', 'my'], ['/course/view.php?id=2', 'course-iti8801']] as const) {
      await page.goto(p);
      await waitForShell(page);
      if (name === 'my') await page.waitForSelector('.dashboard-card', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `artifacts/m1/${name}.png` });
    }
  });
});
