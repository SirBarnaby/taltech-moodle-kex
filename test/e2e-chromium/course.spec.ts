import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { COURSE_ITI, iter3Seed, seedWithPins, waitForCourse } from '../harness/kex';

/** M2 acceptance (implementation-plan): the course page on the lab (course 2, ITI8801, weeks format). */

const COURSE = `/course/view.php?id=${COURSE_ITI}`;
const active = (page: Page) => page.locator('[data-kex-topic][aria-current="true"]');

/** Wait until every topic's details are cached, so topic switches measure the cache path. */
async function settleCache(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.waitForLoadState('networkidle');
}

test.describe('topics', () => {
  test.use({ seed: iter3Seed() });

  test('j/k switch topics from cache in 16 ms, the hash follows, back and forward restore', async ({ page }) => {
    await page.goto(`${COURSE}#topic-6`);
    await waitForCourse(page);
    await settleCache(page);
    await page.locator('[data-kex-topic="6"]').focus();

    // Time from the topic-switch mark (set when the key handler runs) to the DOM update of the page.
    await page.evaluate(() => {
      const w = window as unknown as { __sw: number[] };
      w.__sw = [];
      let seen = 0;
      const root = document.querySelector('[data-kex-test="course"]')!;
      new MutationObserver(() => {
        const marks = performance.getEntriesByName('kex:topic-switch');
        if (marks.length > seen) {
          seen = marks.length;
          w.__sw.push(performance.now() - (marks[marks.length - 1]?.startTime ?? 0));
        }
      }).observe(root, { childList: true, subtree: true, characterData: true });
    });

    const visited: number[] = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('k');
      visited.push(i);
      await expect(page.locator('[data-kex-test="detail-kicker"]')).toHaveText(`TOPIC 0${5 - i}`);
      await page.waitForTimeout(800); // longer than the history coalescing window
    }
    const times = await page.evaluate(() => (window as unknown as { __sw: number[] }).__sw);
    expect(times.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...times), `switch times ${times.map((t) => t.toFixed(1)).join(', ')} ms`).toBeLessThanOrEqual(16);
    const marks = await page.evaluate(() => performance.getEntriesByName('kex:topic-switch').length);
    expect(marks).toBeGreaterThanOrEqual(3);

    expect(new URL(page.url()).hash).toBe('#topic-3');
    await page.goBack();
    await expect(page.locator('[data-kex-test="detail-kicker"]')).toHaveText('TOPIC 04');
    expect(new URL(page.url()).hash).toBe('#topic-4');
    await page.goBack();
    await expect(page.locator('[data-kex-test="detail-kicker"]')).toHaveText('TOPIC 05');
    await page.goForward();
    await expect(page.locator('[data-kex-test="detail-kicker"]')).toHaveText('TOPIC 04');
    await expect(active(page)).toHaveAttribute('data-kex-topic', '4');
  });

  test('a topic hash opens that topic and clicking a topic updates the hash', async ({ page }) => {
    await page.goto(`${COURSE}#topic-2`);
    await waitForCourse(page);
    await expect(page.locator('[data-kex-test="detail-title"] .kex-sr')).toHaveText('Cloud services');
    await page.locator('[data-kex-topic="4"]').click();
    await expect(page.locator('[data-kex-test="detail-kicker"]')).toHaveText('TOPIC 04');
    expect(new URL(page.url()).hash).toBe('#topic-4');
  });
});

test.describe('secondary navigation and Moodle\'s own words', () => {
  test.use({ seed: iter3Seed() });

  test('the course\'s own navigation (participants, grades, ...) is shown with Moodle\'s labels and URLs; no content tabs', async ({ page }) => {
    await page.goto(`${COURSE}#topic-1`);
    await waitForCourse(page);
    const nav = page.locator('[data-kex-test="course-nav"]');
    await expect(nav).toBeVisible();
    const links = await nav.locator('a').evaluateAll((els) => els.map((a) => ({ key: a.getAttribute('data-key'), text: a.textContent?.trim(), href: (a as HTMLAnchorElement).href, current: a.getAttribute('aria-current') })));
    expect(links.map((l) => l.key)).toEqual(expect.arrayContaining(['coursehome', 'participants', 'grades']));
    expect(links.find((l) => l.key === 'coursehome')?.current).toBe('page');
    expect(links.find((l) => l.key === 'participants')?.href).toContain(`/user/index.php?id=${COURSE_ITI}`);
    expect(links.find((l) => l.key === 'grades')?.href).toContain(`/grade/report/index.php?id=${COURSE_ITI}`);
    await expect(page.locator('#kex-main [role="tab"]')).toHaveCount(0);
  });

  test('1/2/3 no longer filter; every eyebrow is Moodle\'s module name, not an invented kind word', async ({ page }) => {
    await page.goto(`${COURSE}#topic-1`);
    await waitForCourse(page);
    const rows = page.locator('[data-kex-row]');
    await expect(rows).toHaveCount(4);
    await page.locator('[data-kex-topic="1"]').focus();
    for (const k of ['2', '3', '1']) {
      await page.keyboard.press(k);
      await expect(rows).toHaveCount(4);
    }
    const labels = await rows.evaluateAll((els) => els.map((e) => e.querySelector('.kex-row__label')?.textContent ?? ''));
    expect(labels.every((l) => l.length > 0 && !/^(LECTURE|PRACTICAL|RECORDING|READING|MATERIAL)\b/.test(l))).toBe(true);
  });
});

test.describe('preview and completion', () => {
  test.use({ seed: iter3Seed() });

  test('Space previews a PDF, j/k move between materials, Esc returns focus to the row', async ({ page }) => {
    await page.goto(`${COURSE}#topic-6`);
    await waitForCourse(page);
    await page.locator('[data-kex-row="21"]').focus();
    await page.keyboard.press('Space');
    const sheet = page.locator('[data-kex-test="preview"]');
    await expect(sheet).toBeVisible();
    const frame = page.locator('[data-kex-test="preview-frame"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /pluginfile\.php/);
    await expect(sheet).toContainText('Kubernetes');

    await page.keyboard.press('j');
    await expect(sheet).toContainText('Deploy a service');
    await expect(frame).toHaveAttribute('src', /pluginfile\.php/);
    await page.keyboard.press('k');
    await expect(sheet).toContainText('Kubernetes');

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('[data-kex-row="21"]')).toBeFocused();
  });

  test('x toggles completion on a manual activity and the state survives a reload (from the server)', async ({ page }) => {
    await page.goto(`${COURSE}#topic-5`);
    await waitForCourse(page);
    const row = page.locator('[data-kex-row="17"]');
    const done = row.getByRole('button', { name: /done/i });
    await expect(done).toBeVisible();
    const before = await done.getAttribute('aria-pressed');
    try {
      await row.focus();
      await page.keyboard.press('x');
      await expect(done).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
      await page.waitForTimeout(500);
      await page.reload();
      await waitForCourse(page);
      await expect(page.locator('[data-kex-row="17"]').getByRole('button', { name: /done/i })).toHaveAttribute(
        'aria-pressed',
        before === 'true' ? 'false' : 'true',
      );
    } finally {
      // Put the lab back.
      const now = page.locator('[data-kex-row="17"]').getByRole('button', { name: /done/i });
      if ((await now.getAttribute('aria-pressed')) !== before) {
        await page.locator('[data-kex-row="17"]').focus();
        await page.keyboard.press('x');
        await expect(now).toHaveAttribute('aria-pressed', before ?? 'false');
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('slide-up text', () => {
  test.use({ seed: iter3Seed() });

  test('hero words and topic title characters, with the full text once for screen readers', async ({ page }) => {
    await page.goto(`${COURSE}#topic-6`);
    await waitForCourse(page);
    // Hero: one piece per word; the visual copy is hidden from assistive tech, the full text is there once.
    expect(await page.locator('[data-kex-test="hero-title"] .kex-su-item').count()).toBe(4);
    expect(await page.locator('[data-kex-test="hero-title"] .kex-su[aria-hidden="true"]').count()).toBe(1);
    expect(await page.locator('[data-kex-test="hero-title"] .kex-sr').allTextContents()).toEqual(['Cloud Architectures & DevOps']);
    // Topic title: one piece per character.
    expect(await page.locator('[data-kex-test="detail-title"] .kex-su-item').count()).toBe('Kubernetes'.length);
    expect(await page.locator('[data-kex-test="detail-title"] .kex-sr').allTextContents()).toEqual(['Kubernetes']);

    await expect(page.locator('[data-kex-test="hero-title"]')).toMatchAriaSnapshot('- heading "Cloud Architectures & DevOps" [level=1]');
    await expect(page.locator('[data-kex-test="detail-title"]')).toMatchAriaSnapshot('- heading "Kubernetes" [level=3]');
  });

  test('axe finds no serious problems on the course page', async ({ page }) => {
    await page.goto(`${COURSE}#topic-6`);
    await waitForCourse(page);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => {
        document.documentElement.dataset.kexTheme = t;
      }, theme);
      await page.waitForTimeout(250);
      const res = await new AxeBuilder({ page }).include('#kex-root').analyze();
      const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), `${theme} theme`).toEqual([]);
    }
  });
});

test.describe('rows', () => {
  test.use({ seed: seedWithPins([]) });

  test('every row has a thumbnail (tiles-format courses get the section photo besides)', async ({ page }) => {
    await page.goto(`${COURSE}#topic-6`);
    await waitForCourse(page);
    const rows = await page.locator('[data-kex-row]').count();
    expect(rows).toBe(3);
    expect(await page.locator('[data-kex-row] .kex-thumb').count()).toBe(rows);
  });
});
