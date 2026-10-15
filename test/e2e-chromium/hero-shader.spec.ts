import { test, expect } from './fixtures';
import { COURSE_ITI, waitForCourse } from '../harness/kex';

/** M2: hero shader behaviour. Software WebGL2 so the shader runs in headless Chromium (heavy, hence its own file). */
test.use({ launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });

const COURSE = `/course/view.php?id=${COURSE_ITI}`;

test.describe('hero shader', () => {
  const live = { 'kex:settings': { enabled: true, effects: 'animated', motion: 'full', theme: 'light' } };

  test.describe('animated', () => {
    test.use({ seed: live });

    test('stops offscreen and on visibilitychange, resumes after', async ({ page }) => {
      // A short window, so the course page can scroll the hero out of view.
      await page.setViewportSize({ width: 1585, height: 300 });
      await page.goto(`${COURSE}#topic-6`);
      await waitForCourse(page);
      const canvas = page.locator('.kex-hero__canvas');
      await expect(canvas).toHaveAttribute('data-fx', 'running');

      await page.evaluate(() => window.scrollTo(0, 700));
      await expect(canvas).toHaveAttribute('data-fx', 'paused');
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(canvas).toHaveAttribute('data-fx', 'running');

      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(canvas).toHaveAttribute('data-fx', 'paused');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(canvas).toHaveAttribute('data-fx', 'running');
    });

    test('a lost WebGL context falls back to the image without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${COURSE}#topic-6`);
      await waitForCourse(page);
      const canvas = page.locator('.kex-hero__canvas');
      await expect(canvas).toHaveAttribute('data-fx', 'running');
      await page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('.kex-hero__canvas')!;
        c.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
      });
      await expect(canvas).toHaveAttribute('data-fx', 'fallback');
      await expect(page.locator('[data-kex-test="hero"]')).toHaveAttribute('data-mode', 'fallback');
      await page.waitForTimeout(300);
      expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    });
  });

  test.describe('reduced motion', () => {
    test.use({ seed: { 'kex:settings': { enabled: true, effects: 'animated', motion: 'reduced', theme: 'light' } } });

    test('renders one static frame and nothing animates', async ({ page }) => {
      await page.goto(`${COURSE}#topic-6`);
      await waitForCourse(page);
      await expect(page.locator('.kex-hero__canvas')).toHaveAttribute('data-fx', 'static');
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a as CSSAnimation).animationName ?? a.constructor.name));
      expect(running).toEqual([]);
      // Slide-up pieces sit at their final place.
      const moved = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.kex-su-item')].filter((e) => getComputedStyle(e).transform !== 'none').length);
      expect(moved).toBe(0);
    });
  });

  test.describe('effects off', () => {
    test.use({ seed: { 'kex:settings': { enabled: true, effects: 'off', motion: 'full', theme: 'light' } } });

    test('shows the fallback image instead of the canvas', async ({ page }) => {
      await page.goto(`${COURSE}#topic-6`);
      await waitForCourse(page);
      await expect(page.locator('.kex-hero__canvas')).toHaveAttribute('data-fx', 'fallback');
      await expect(page.locator('[data-kex-test="hero"]')).toHaveAttribute('data-mode', 'fallback');
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector('[data-kex-test="hero"]')!).backgroundImage);
      expect(bg).toContain('hero-fallback');
      const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('.kex-hero__canvas')!).display);
      expect(hidden).toBe('none');
    });
  });
});

