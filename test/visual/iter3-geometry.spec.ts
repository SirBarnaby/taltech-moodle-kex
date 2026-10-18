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

/**
 * The sidebar auto-hides: idle, it takes no layout width (`--kex-sb-w` is 0), so the header, hero and content start at x = 0 and
 * span the viewport. Right-anchored items (search, theme toggle, row buttons, the course navigation) keep the mock's x; left-anchored
 * ones move left by the mock's 246 px sidebar.
 */
const TARGETS: Target[] = [
  { id: 'header', x: 0, y: 0, w: 1585, h: 67, tolH: 1 },
  { id: 'hero', x: 0, y: 67, w: 1585, h: 253 },
  { id: 'search', x: 1214, y: 11, w: 268, h: 44 },
  { id: 'theme-toggle', x: 1518, y: 11, w: 42, h: 44 },
  // Content padding is clamp(24px, 1.77vw, 40px) = 28 px, so the pinned box is 1585 - 2 * 28 - 24 - 57 wide.
  { id: 'pinned', x: 28, y: 347, w: 1448, h: 74 },
  { id: 'pinned-edit', x: 1500, y: 347, w: 52, h: 16, tolW: 4, tolH: 4 },
  // The underline sits under the active entry of the course's own navigation ("Course"), right-aligned in the materials header.
  { id: 'tab-underline', x: 1013, y: 493, w: 72, h: 3, tolX: 6, tolW: 6 },
  { id: 'topics-row-1', x: 28, y: 546, w: 328, h: 52 },
  { id: 'topics-row-6', x: 28, y: 806, w: 328, h: 53 },
  { id: 'detail-title', x: 419, y: 536, tolY: 5 },
  // Rows start 24 px higher than in the mock: the invented subtitle line under the topic title is gone.
  { id: 'row-1-thumb', x: 419, y: 607, w: 134, h: 92 },
  { id: 'row-1-button', x: 1410, y: 631, w: 148, h: 44 },
  { id: 'row-2-button', x: 1410, y: 752, w: 148, h: 44, tolY: 6 },
  { id: 'row-3-thumb', x: 419, y: 847, w: 134, h: 92, tolY: 8 },
];

/** Width of the peeked sidebar: clamp(204px, 13.2vw, 255px) at 1585 px. */
const SIDEBAR_PEEK_W = 209;

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

  test('idle, the sidebar takes no layout width and sits off-canvas; hovering the left edge peeks it at its full width', async ({ page }) => {
    await page.goto(`/course/view.php?id=${COURSE_ITI}#topic-6`);
    await waitForCourse(page);
    await page.mouse.move(1584, 991);
    const idle = await page.evaluate(() => {
      const sb = document.querySelector('[data-kex-test="sidebar"]')!.getBoundingClientRect();
      const header = document.querySelector('[data-kex-test="header"]')!.getBoundingClientRect();
      return { layout: getComputedStyle(document.documentElement).getPropertyValue('--kex-sb-w').trim(), right: sb.right, header: header.x };
    });
    expect(idle.layout).toBe('0px');
    expect(idle.right).toBeLessThanOrEqual(0);
    expect(idle.header).toBe(0);

    await page.mouse.move(2, 400);
    await expect(page.locator('[data-kex-test="sidebar"]')).toHaveAttribute('data-open', 'true');
    await page.waitForTimeout(300);
    const peek = await page.evaluate(() => {
      const r = document.querySelector('[data-kex-test="sidebar"]')!.getBoundingClientRect();
      return { x: r.x, w: r.width, h: r.height, header: document.querySelector('[data-kex-test="header"]')!.getBoundingClientRect().x };
    });
    expect(Math.abs(peek.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(peek.w - SIDEBAR_PEEK_W)).toBeLessThanOrEqual(2);
    expect(peek.h).toBe(992);
    // The page does not shift under a peeked sidebar.
    expect(peek.header).toBe(0);
  });

  test('the course page has no horizontal overflow and the topic from the hash is active', async ({ page }) => {
    await page.goto(`/course/view.php?id=${COURSE_ITI}#topic-6`);
    await waitForCourse(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator('[data-kex-topic="6"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-kex-test="detail-kicker"]')).toHaveText('TOPIC 06');
    await expect(page.locator('[data-kex-test="detail-count"]')).toHaveText('3 RESOURCES');
  });
});
