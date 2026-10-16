import { expect, test } from '../e2e-chromium/fixtures';
import { COURSE_ITI, iter3Seed, waitForCourse } from '../harness/kex';

/** Design-spec §10: DOM geometry of the course page at 1585x992, light theme, effects frozen. */

interface Target {
  id: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** Tolerance in px (default 3). */
  tol?: number;
  tolX?: number;
  tolY?: number;
  tolW?: number;
  tolH?: number;
}

const TARGETS: Target[] = [
  { id: 'sidebar', x: 0, y: 0, w: 246, h: 992 },
  { id: 'header', x: 246, y: 0, w: 1339, h: 67, tolH: 1 },
  { id: 'hero', x: 246, y: 67, w: 1339, h: 253 },
  { id: 'search', x: 1214, y: 11, w: 268, h: 44 },
  { id: 'theme-toggle', x: 1518, y: 11, w: 42, h: 44 },
  { id: 'sb-active-course', x: 0, y: 487, w: 246, h: 68, tolH: 4 },
  { id: 'pinned', x: 274, y: 347, w: 1202, h: 74 },
  { id: 'pinned-edit', x: 1500, y: 347, w: 52, h: 16, tolW: 4, tolH: 4 },
  { id: 'tab-underline', x: 1276, y: 493, w: 98, h: 3, tolX: 6, tolW: 6 },
  { id: 'topics-row-1', x: 274, y: 546, w: 328, h: 52 },
  { id: 'topics-row-6', x: 274, y: 806, w: 328, h: 53 },
  { id: 'detail-title', x: 665, y: 536, tolY: 5 },
  { id: 'row-1-thumb', x: 665, y: 631, w: 134, h: 92 },
  { id: 'row-1-button', x: 1410, y: 655, w: 148, h: 44 },
  { id: 'row-2-button', x: 1410, y: 772, w: 148, h: 44, tolY: 6 },
  { id: 'row-3-thumb', x: 665, y: 869, w: 134, h: 92, tolY: 8 },
];

test.describe('iteration3 geometry', () => {
  test.use({ seed: iter3Seed() });

  test('every element of the design-spec §10 table is in place', async ({ page }) => {
    await page.goto(`/course/view.php?id=${COURSE_ITI}#topic-6`);
    await waitForCourse(page);
    await page.mouse.move(1584, 991);
    const rects = await page.evaluate((ids) => {
      const out: Record<string, number[] | null> = {};
      for (const id of ids) {
        const el = document.querySelector(`[data-kex-test="${id}"]`);
        const r = el?.getBoundingClientRect();
        out[id] = r ? [r.x, r.y, r.width, r.height] : null;
      }
      return out;
    }, TARGETS.map((t) => t.id));

    const failures: string[] = [];
    for (const t of TARGETS) {
      const r = rects[t.id];
      if (!r) {
        failures.push(`${t.id}: not found`);
        continue;
      }
      const [x, y, w, h] = r as [number, number, number, number];
      const check = (name: string, got: number, want: number | undefined, tol: number | undefined): void => {
        if (want === undefined) return;
        if (Math.abs(got - want) > (tol ?? t.tol ?? 3)) failures.push(`${t.id}.${name}: ${got.toFixed(1)} (want ${want} ±${tol ?? t.tol ?? 3})`);
      };
      check('x', x, t.x, t.tolX);
      check('y', y, t.y, t.tolY);
      check('w', w, t.w, t.tolW);
      check('h', h, t.h, t.tolH);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('the course page has no horizontal overflow and the topic from the hash is active', async ({ page }) => {
    await page.goto(`/course/view.php?id=${COURSE_ITI}#topic-6`);
    await waitForCourse(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator('[data-kex-test="topics-row-6"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-kex-test="detail-kicker"]')).toHaveText('TOPIC 06');
    await expect(page.locator('[data-kex-test="detail-count"]')).toHaveText('3 RESOURCES');
  });
});
