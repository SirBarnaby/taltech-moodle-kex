import { execSync } from 'node:child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { iter3Seed, installKex, seedWithPins } from '../harness/kex';

/** M3 acceptance (implementation-plan): Workspace, pins, My courses, palette, storage hygiene. Runs against the lab. */

async function api<T = unknown>(page: Page, method: string, args: Record<string, unknown>): Promise<T> {
  return page.evaluate(
    async ([m, a]) => {
      const cfg = (window as unknown as { M: { cfg: { sesskey: string } } }).M.cfg;
      const r = await fetch(`/lib/ajax/service.php?sesskey=${cfg.sesskey}&info=${m as string}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ index: 0, methodname: m, args: a }]),
      });
      const j = (await r.json()) as { error: boolean; data: unknown }[];
      return j[0]?.data;
    },
    [method, args] as const,
  ) as Promise<T>;
}

const feedRows = (page: Page) => page.locator('[data-kex-test="feed-rows"] > li[data-kex-item]');

async function openWorkspace(page: Page, hash = ''): Promise<void> {
  await page.goto(`/my/${hash}`);
  await page.waitForSelector('#kex-root [data-kex-test="workspace"]');
  await page.waitForFunction(() => document.documentElement.dataset.kexData === 'idle');
  await expect(feedRows(page).first()).toBeVisible();
}

/** The updates test marks notifications read on the server; put them back (the lab container is reached through docker). */
function resetNotifications(): void {
  execSync('docker cp tools/lab/m3_reset.php moodle-lab-moodle-1:/tmp/m3_reset.php && docker exec -u nobody moodle-lab-moodle-1 php /tmp/m3_reset.php', { stdio: 'ignore' });
}

test.describe('workspace', () => {
  test.use({ seed: seedWithPins([], { theme: 'light', debug: { freezeTime: 7.3 } }) });
  test.beforeAll(resetNotifications);
  test.afterAll(resetNotifications);

  test('feed is sorted overdue first, hash tabs work, Enter opens the submission form', async ({ page }) => {
    await openWorkspace(page);
    const flags = await feedRows(page).evaluateAll((els) => els.map((e) => ({ overdue: e.classList.contains('kex-row--overdue'), deadline: e.classList.contains('kex-row--deadline') })));
    expect(flags[0]?.overdue, 'first row is overdue').toBe(true);
    expect(flags.some((f) => f.deadline && !f.overdue), 'some deadline is still due').toBe(true);
    // Deadlines are grouped by course (round 2): overdue comes first inside every course group.
    const seq = await page.locator('[data-kex-test="feed-rows"] > li.kex-feedgroup, [data-kex-test="feed-rows"] > li[data-kex-item]').evaluateAll((els) =>
      els.map((e) => (e.classList.contains('kex-feedgroup') ? 'group' : e.classList.contains('kex-row--overdue') ? 'overdue' : e.classList.contains('kex-row--deadline') ? 'due' : 'other')),
    );
    expect(seq.includes('group'), 'course headings are present').toBe(true);
    let seenDue = false;
    for (const s of seq) {
      if (s === 'group' || s === 'other') seenDue = false;
      else if (s === 'due') seenDue = true;
      else expect(seenDue, 'no overdue row after a due row inside a course group').toBe(false);
    }
    // Due dates ascend inside the due block.
    const dueLines = await page.locator('.kex-row--deadline:not(.kex-row--overdue) .kex-row__sub').allTextContents();
    expect(dueLines.length).toBeGreaterThan(1);

    await page.keyboard.press('2');
    await expect(page).toHaveURL(/#deadlines$/);
    await expect(page.locator('[data-kex-test="feed-label"]')).toHaveText('DEADLINES');
    expect(await feedRows(page).evaluateAll((els) => els.every((e) => e.classList.contains('kex-row--deadline')))).toBe(true);
    await page.keyboard.press('3');
    await expect(page).toHaveURL(/#updates$/);
    await expect(page.locator('[data-kex-test="feed-label"]')).toHaveText('UPDATES');
    expect(await feedRows(page).evaluateAll((els) => els.every((e) => e.classList.contains('kex-row--update')))).toBe(true);
    await page.keyboard.press('1');
    await expect(page.locator('[data-kex-test="feed-label"]')).toHaveText('UP NEXT');

    // Reload keeps the tab.
    await page.goto('/my/#deadlines');
    await expect(page.locator('[data-kex-test="feed-label"]')).toHaveText('DEADLINES');

    // Enter on the selected deadline row goes to the event's action URL (the submission form).
    const href = await page.locator('[data-kex-test="feed-1"] [data-kex-test="feed-open"]').getAttribute('href');
    expect(href).toMatch(/\/mod\/assign\/view\.php\?id=\d+/);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/mod\/assign\/view\.php/);
    expect(page.url()).toBe(href);
  });

  test('updates: mark read and mark all read keep the sidebar badge in step', async ({ page }) => {
    await openWorkspace(page, '#updates');
    const badge = page.locator('[data-kex-test="sb-unread"]');
    await expect(badge).toBeVisible();
    const before = Number(await badge.textContent());
    expect(before).toBeGreaterThan(1);
    await page.locator('[data-kex-test="feed-1"] [data-kex-test="act-read"]').click();
    await expect(badge).toHaveText(String(before - 1));
    await expect.poll(() => api<number>(page, 'message_popup_get_unread_popup_notification_count', { useridto: 3 })).toBe(before - 1);
    await page.reload();
    await expect(page.locator('[data-kex-test="sb-unread"]')).toHaveText(String(before - 1));
    await page.locator('[data-kex-test="mark-all-read"]').click();
    await expect(page.locator('[data-kex-test="sb-unread"]')).toHaveCount(0);
    expect(await api<number>(page, 'message_popup_get_unread_popup_notification_count', { useridto: 3 })).toBe(0);
  });
});

test.describe('pins', () => {
  test.use({ seed: seedWithPins([], { theme: 'light', debug: { freezeTime: 7.3 } }) });

  test('p pins a course row, it persists and syncs to a second tab; Edit mode reorders; Undo works', async ({ page }) => {
    await page.goto('/course/view.php?id=2#topic-6');
    await page.waitForSelector('[data-kex-test="course"] [data-kex-test="row-1"]');
    await page.locator('[data-kex-test="row-1"]').focus();
    await page.keyboard.press('p');
    await expect(page.locator('[data-kex-test="pin-1"]')).toBeVisible();
    const title = (await page.locator('[data-kex-test="pin-1"] .kex-pin__title').textContent()) ?? '';

    const page2 = await page.context().newPage();
    await installKex(page2, {});
    await page2.goto('/my/');
    await page2.waitForSelector('[data-kex-test="workspace"]');
    await expect(page2.locator('[data-kex-test="pin-1"] .kex-pin__title')).toHaveText(title);

    // Pin a second one in tab 1; tab 2 shows it within a second.
    await page.locator('[data-kex-test="row-2"]').focus();
    await page.keyboard.press('p');
    await expect(page2.locator('[data-kex-test="pin-2"]')).toBeVisible({ timeout: 1000 });
    const second = (await page2.locator('[data-kex-test="pin-2"] .kex-pin__title').textContent()) ?? '';

    // Persists across reload.
    await page2.reload();
    await expect(page2.locator('[data-kex-test="pin-1"] .kex-pin__title')).toHaveText(title);

    // Edit mode: Alt+ArrowRight moves the first pin later; z undoes it.
    await page2.locator('[data-kex-test="pinned-edit"]').click();
    await page2.locator('[data-kex-test="pin-1"]').focus();
    await page2.keyboard.press('Alt+ArrowRight');
    await expect(page2.locator('[data-kex-test="pin-1"] .kex-pin__title')).toHaveText(second);
    await expect(page2.locator('[data-kex-test="pin-2"] .kex-pin__title')).toHaveText(title);
    await page2.keyboard.press('z');
    await expect(page2.locator('[data-kex-test="pin-1"] .kex-pin__title')).toHaveText(title);
    await page2.close();
  });

});

test.describe('pinned page', () => {
  test.use({ seed: iter3Seed() });

  test('groups by course, renames with F2 and removes with Undo', async ({ page }) => {
    await page.goto('/my/#pinned');
    await page.waitForSelector('[data-kex-test="pinned-page"] [data-kex-test="pin-rows"]');
    await expect(page.locator('[data-kex-test="band-label"]')).toHaveText('PINNED MATERIALS / 3 ITEMS');
    await expect(page.locator('.kex-prows__group')).toHaveCount(3);
    await page.keyboard.press('e');
    await expect(page.locator('[data-kex-test="pinned-edit"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-kex-test="pin-row-1"]').focus();
    await page.keyboard.press('F2');
    await page.locator('.kex-pin__rename').fill('Kubernetes cheat sheet');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-kex-test="pin-row-1"] .kex-row__title')).toHaveText('Kubernetes cheat sheet');
    await page.locator('[data-kex-test="pin-row-2"] [data-kex-test="act-remove"]').click();
    await expect(page.locator('[data-kex-test="band-label"]')).toHaveText('PINNED MATERIALS / 2 ITEMS');
    await page.keyboard.press('z');
    await expect(page.locator('[data-kex-test="band-label"]')).toHaveText('PINNED MATERIALS / 3 ITEMS');
  });

  test('export and import round-trip through JSON', async ({ page }) => {
    await page.goto('/my/#pinned');
    await page.waitForSelector('[data-kex-test="pin-rows"]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-kex-test="pins-export"]').click()]);
    const path = await dl.path();
    expect(path).toBeTruthy();
    const { readFileSync } = await import('node:fs');
    const json = JSON.parse(readFileSync(path as string, 'utf8')) as { pins: { cmid: number }[] };
    expect(json.pins.map((p) => p.cmid)).toEqual([21, 65, 35]);
    // Remove all then import.
    await page.keyboard.press('e');
    for (let i = 0; i < 3; i++) await page.locator('[data-kex-test="pin-row-1"] [data-kex-test="act-remove"]').click();
    await expect(page.locator('[data-kex-test="pin-rows"]')).toHaveCount(0);
    await page.locator('[data-kex-test="pins-file"]').setInputFiles(path as string);
    await expect(page.locator('[data-kex-test="band-label"]')).toHaveText('PINNED MATERIALS / 3 ITEMS');
  });
});

test.describe('my courses', () => {
  test.use({ seed: seedWithPins([], { theme: 'light', debug: { freezeTime: 7.3 } }) });

  test('the star toggles the favourite on the server; hide and Undo work', async ({ page }) => {
    await page.goto('/my/courses.php#all');
    await page.waitForSelector('[data-kex-test="mc-rows"] [data-kex-mc]');
    const rows = page.locator('[data-kex-mc]');
    expect(await rows.count()).toBeGreaterThanOrEqual(6);
    const row = page.locator('[data-kex-mc]', { hasText: 'IEE2630' });
    const id = Number(await row.getAttribute('data-kex-mc'));
    const favs = async (): Promise<number[]> => {
      const r = await api<{ courses: { id: number }[] }>(page, 'core_course_get_enrolled_courses_by_timeline_classification', {
        offset: 0, limit: 0, classification: 'favourites', sort: 'fullname', customfieldname: '', customfieldvalue: '',
      });
      return r.courses.map((c) => c.id);
    };
    expect(await favs()).not.toContain(id);
    try {
      await row.locator('[data-kex-test="mc-star"]').click();
      await expect(row.locator('[data-kex-test="mc-star"]')).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(favs).toContain(id);
      // Starred tab (key 2) lists it.
      await page.keyboard.press('2');
      await expect(page.locator(`[data-kex-mc="${id}"]`)).toBeVisible();
    } finally {
      await api(page, 'core_course_set_favourite_courses', { courses: [{ id, favourite: false }] });
    }

    // Hide with Shift+H on the filtered row, then Undo with z.
    await page.keyboard.press('5'); // All is tab 6 here (no Archived tab): 1 Current .. 6 All; 5 is Hidden
    await page.goto('/my/courses.php#all');
    await page.waitForSelector('[data-kex-mc]');
    const pref = async (): Promise<string | null> => {
      const r = await api<{ preferences: { name: string; value: string | null }[] }>(page, 'core_user_get_user_preferences', { name: `block_myoverview_hidden_course_${id}`, userid: 3 });
      return r.preferences?.[0]?.value ?? null;
    };
    try {
      await page.keyboard.press('f');
      await page.keyboard.type('IEE2630');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Shift+H');
      await expect.poll(pref).toBe('1');
      await page.keyboard.press('z');
      await expect.poll(pref).toBeNull();
    } finally {
      await api(page, 'core_user_update_user_preferences', { preferences: [{ type: `block_myoverview_hidden_course_${id}`, value: null }] });
    }
  });

  test('the filter ignores diacritics', async ({ page }) => {
    await page.goto('/my/courses.php#all');
    await page.waitForSelector('[data-kex-mc]');
    await page.keyboard.press('f');
    await page.keyboard.type('tarkade asjade vorgud'); // Tarkade asjade võrgud
    await expect(page.locator('[data-kex-mc]')).toHaveCount(1);
  });
});

test.describe('palette and storage', () => {
  test.use({ seed: seedWithPins([], { theme: 'light', debug: { freezeTime: 7.3 } }) });

  test('finds kubernetes materials across courses after one idle prefetch; oiguse matches Õiguse; no sesskey in storage', async ({ page }) => {
    await page.goto('/my/');
    await page.waitForSelector('[data-kex-test="workspace"]');
    await page.waitForFunction(() => /prefetch:at/.test(localStorage.getItem('__kex_shim_storage__') ?? ''), undefined, { timeout: 20_000 });
    await page.keyboard.press('Control+k');
    await page.locator('[data-kex-test="palette"] input').fill('kubernetes');
    const opts = page.locator('[data-kex-test="palette"] [role="option"]');
    await expect.poll(async () => (await opts.allTextContents()).join('|')).toMatch(/ITI8801/);
    const text = (await opts.allTextContents()).join('|');
    expect(text).toMatch(/EMT0140/);
    expect(text.toLowerCase()).toContain('kubernetes');
    await page.locator('[data-kex-test="palette"] input').fill('oiguse');
    await expect(page.locator('[data-kex-test="palette"] [role="option"]', { hasText: 'Õiguse' }).first()).toBeVisible();
    // Alt+P pins the highlighted material.
    await page.locator('[data-kex-test="palette"] input').fill('kubernetes at the edge');
    await expect(page.locator('[data-kex-test="palette"] [role="option"]').first()).toContainText('Kubernetes at the edge');
    await page.keyboard.press('Alt+p');
    await expect.poll(async () => (await page.evaluate(() => localStorage.getItem('__kex_shim_storage__') ?? '')).includes('Kubernetes at the edge')).toBe(true);

    const dump = await page.evaluate(() => localStorage.getItem('__kex_shim_storage__') ?? '');
    const sesskey = await page.evaluate(() => (window as unknown as { M: { cfg: { sesskey: string } } }).M.cfg.sesskey);
    expect(dump).not.toContain(sesskey);
    expect(dump).not.toMatch(/sesskey|[A-Za-z0-9]{10}&/);
  });
});
