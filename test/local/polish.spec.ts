import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DEFAULT_RIBBONS, ribbonsFor } from '../../src/lib/school';

const { PNG } = createRequire(import.meta.url)('pngjs');

const out = process.env.KEX_ARTIFACT_DIR || 'artifacts/local-review';
let buildId: string;
mkdirSync(out, { recursive: true });
test.beforeAll(async ({ request }) => {
  const response = await request.get('/__demo/meta');
  expect(response.ok()).toBe(true);
  const meta = await response.json();
  expect(meta.build.state).toBe('verified');
  expect(meta.variant).toBe('firefox');
  if (process.env.KEX_EXPECT_BUILD_ID) expect(meta.build.buildId).toBe(process.env.KEX_EXPECT_BUILD_ID);
  if (process.env.KEX_DEMO_RUN_ID) expect(meta.runId).toBe(process.env.KEX_DEMO_RUN_ID);
  buildId = meta.build.buildId;
  writeFileSync(`${out}/replay-build.json`, JSON.stringify(meta, null, 2));
});
test.beforeEach(async ({ page, baseURL }) => {
  // Captured remote images are not authenticated in this isolated profile. Keep the replay offline.
  await page.route((url) => /^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL!).origin, (r) => r.abort());
  // Freeze the calendar day without replacing native animation frames or timers.
  await page.addInitScript((fixtureTime) => {
    const NativeDate = Date;
    const offset = fixtureTime - NativeDate.now();
    const now = () => NativeDate.now() + offset;
    globalThis.Date = new Proxy(NativeDate, {
      construct(target, args, newTarget) { return Reflect.construct(target, args.length ? args : [now()], newTarget); },
      apply() { return new NativeDate(now()).toString(); },
      get(target, property, receiver) { return property === 'now' ? now : Reflect.get(target, property, receiver); },
    });
  }, Date.parse('2026-10-20T09:00:00Z'));
});
/**
 * Hold the shader's compile until `release.at` (ms after navigation) or until the page sets `window[release.flag]`. The renderer
 * polls KHR_parallel_shader_compile; a browser without it (software GL, as in headless runs) gets a stand-in, so the CSS
 * fallback stays up there too.
 */
async function holdShaderCompile(page: Page, release: { at?: number; flag?: string }) {
  await page.addInitScript(({ at, flag }) => {
    const done = () => (at !== undefined && performance.now() >= at) || (!!flag && !!(window as unknown as Record<string, unknown>)[flag]);
    const COMPLETION_STATUS_KHR = 0x91B1;
    const proto = WebGL2RenderingContext.prototype;
    const extension = proto.getExtension;
    const parameter = proto.getProgramParameter;
    proto.getExtension = function (this: WebGL2RenderingContext, name: string) {
      return extension.call(this, name) ?? (name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR } : null);
    } as typeof proto.getExtension;
    proto.getProgramParameter = function (this: WebGL2RenderingContext, program: WebGLProgram, pname: number) {
      return pname === COMPLETION_STATUS_KHR ? done() : parameter.call(this, program, pname);
    };
  }, release);
}

async function ready(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-kex', 'app');
  await expect(page.locator('html')).toHaveAttribute('data-kex-build', buildId);
  await page.evaluate(() => document.fonts.ready);
}

test('default arrival, home controls, editorial parity and explicit Dossier route', async ({ page }) => {
  await page.goto('/my/');
  await expect(page).toHaveURL(/\/my\/courses\.php/);
  await ready(page);
  await expect(page.locator('[data-kex-test="mc-row-1"]')).toBeVisible();
  // Moodle's announcements are notice cards; the reference blocks stay behind the disclosure.
  await expect(page.locator('[data-kex-test="site-notices"]')).toContainText('Korduma Kippuvad');
  await page.getByText('Ülikooli teated ja kasulikud lingid', { exact: true }).click();
  await expect(page.locator('.kex-moodle-info__grid')).toContainText('tehisintellekti');
  await page.getByText('Ülikooli teated ja kasulikud lingid', { exact: true }).click();
  await page.screenshot({ path: `${out}/home-desktop.png` });
  await page.locator('[data-kex-test="sidebar-toggle"]').click();
  await page.locator('[data-kex-test="sb-workspace"]').click();
  await expect(page).toHaveURL(/view=dossier/);
  await expect(page.locator('[data-kex-test="hero-label"]')).toContainText('NÄDAL 8');
  await expect(page.locator('[data-kex-test="breadcrumb"]')).toContainText('Dossier');
  await page.locator('[data-kex-test="sidebar-toggle"]').click();
  await page.locator('[data-kex-test="sb-brand"]').click();
  await expect(page).toHaveURL(/\/my\/courses\.php/);
});

for (const [width, height] of [[1440, 900], [960, 800], [390, 844]] as const) {
  test(`login composition and sharp backing canvas at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/login/index.php');
    await ready(page);
    await expect(page.locator('[data-kex-test="login-idp"]')).toHaveCount(4);
    await page.waitForFunction(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas');
      return c && ['running', 'static'].includes(c.dataset.fx ?? '') && c.width >= c.clientWidth;
    });
    await page.waitForFunction(() => document.documentElement.dataset.kexAnim === 'done');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await page.locator('.kex-login').boundingBox();
    expect(bounds?.width).toBe(width);
    await page.screenshot({ path: `${out}/login-${width}.png`, fullPage: true });
  });
}

test('delayed shader compilation keeps geometry and fades in a painted canvas', async ({ page }) => {
  await holdShaderCompile(page, { at: 1800 });
  await page.goto('/login/index.php');
  await ready(page);
  const initial = await page.locator('.kex-login__art').boundingBox();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.fx === 'running' || document.querySelector('canvas')?.dataset.fx === 'static');
  const final = await page.locator('.kex-login__art').boundingBox();
  expect(final).toEqual(initial);
  const canvas = await page.locator('canvas').evaluate((c: HTMLCanvasElement) => ({ width: c.width, cssWidth: c.clientWidth, display: getComputedStyle(c).display, transition: getComputedStyle(c).transitionProperty }));
  expect(canvas.display).toBe('block');
  expect(canvas.width).toBeGreaterThanOrEqual(canvas.cssWidth);
  expect(canvas.transition).toContain('opacity');
});

test('Dossier course filter, activity search and responsive density', async ({ page }) => {
  await page.goto('/my/?view=dossier');
  await ready(page);
  await expect(page.locator('[data-kex-test="ws-course"]')).toHaveCount(6);
  await page.getByRole('searchbox', { name: 'Filtreeri kursusi' }).fill('IAS0230');
  await expect(page.locator('[data-kex-test="ws-course"]')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Filtreeri kursusi' }).fill('');
  await page.getByRole('searchbox', { name: 'Otsi tegevusi' }).fill('no-such-activity');
  await expect(page.locator('[data-kex-test="feed-rows"]')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Otsi tegevusi' }).fill('');
  const left = await page.locator('.kex-wscourses').boundingBox();
  const right = await page.locator('.kex-feed').boundingBox();
  expect(right!.x).toBeGreaterThan(left!.x + left!.width);
  await page.screenshot({ path: `${out}/dossier-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.kex-hero__title').evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  const tile = await page.locator('.kex-thumb--date').first().boundingBox();
  const number = await page.locator('.kex-thumb__day').first().boundingBox();
  expect(number!.y).toBeGreaterThanOrEqual(tile!.y);
  expect(number!.y + number!.height).toBeLessThanOrEqual(tile!.y + tile!.height);
  await page.screenshot({ path: `${out}/dossier-mobile.png`, fullPage: true });
});

test('a topic click deep in the one-page course glides there: no frame jumps, no cover layer, the topic lands under the header', async ({ page }) => {
  await page.goto('/course/view.php?id=37582');
  await ready(page);
  await expect(page.locator('#kex-main')).toHaveAttribute('data-kex-ready', 'true');
  await expect(page.locator('.kex-outline [data-kex-topic]')).not.toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 750, behavior: 'instant' }));
  type Sample = { y: number; ghost: boolean };
  await page.evaluate(() => {
    const values: Sample[] = [];
    (window as unknown as { scrollSamples: Sample[] }).scrollSamples = values;
    const start = performance.now();
    const sample = () => {
      values.push({ y: scrollY, ghost: !!document.querySelector('.kex-transition-ghost') });
      if (performance.now() - start < 1200) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  // A real click on the outline: the pointer does not scroll the page first.
  const target = page.locator('.kex-outline [data-kex-topic]').nth(4);
  const n = await target.getAttribute('data-kex-topic');
  const box = await target.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForTimeout(1300);
  const samples = await page.evaluate(() => (window as unknown as { scrollSamples: Sample[] }).scrollSamples);
  writeFileSync(`${out}/course-scroll-samples.json`, JSON.stringify(samples));
  expect(samples.some((p) => p.ghost)).toBe(false);
  // A glide: it goes one way, in steps no larger than a fifth of the window.
  const steps = samples.slice(1).map((p, i) => p.y - samples[i]!.y).filter((d) => Math.abs(d) > 0.5);
  expect(steps.length).toBeGreaterThan(1);
  expect(steps.every((d) => Math.sign(d) === Math.sign(steps[0]!))).toBe(true);
  const vh = await page.evaluate(() => innerHeight);
  expect(Math.max(...steps.map(Math.abs))).toBeLessThanOrEqual(Math.max(80, vh * 0.18) + 1);
  const landed = await page.evaluate((num) => {
    const head = document.querySelector('.kex-header')!.getBoundingClientRect().bottom;
    const top = document.querySelector(`[data-kex-section="${num}"]`)!.getBoundingClientRect().top;
    const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    return { gap: top - head, atEnd };
  }, n);
  if (!landed.atEnd) expect(landed.gap).toBeCloseTo(12, -1);
  await expect(page.locator(`.kex-outline [data-kex-topic="${n}"]`)).toHaveAttribute('aria-current', 'true');
  // Rapid switching ends on the last topic asked for, with nothing left over.
  await page.locator('.kex-outline [data-kex-topic]').nth(1).click();
  await page.locator('.kex-outline [data-kex-topic]').nth(2).click();
  await page.waitForTimeout(900);
  await expect(page.locator('.kex-outline [data-kex-topic]').nth(2)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.kex-transition-ghost')).toHaveCount(0);
  await page.screenshot({ path: `${out}/course-topic.png` });
});

test('a large Dossier reveals activity batches without dropping items', async ({ page }) => {
  await page.route('**/lib/ajax/service.php?**', async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    const requests = route.request().postDataJSON() as { methodname: string }[];
    requests.forEach((request, i) => {
      if (request.methodname === 'core_calendar_get_action_events_by_timesort') {
        const original = rows[i].data.events;
        rows[i].data.events = Array.from({ length: 60 }, (_, n) => ({ ...original[n % original.length], id: n + 1 }));
      }
    });
    await route.fulfill({ response, json: rows });
  });
  await page.goto('/my/?view=dossier#deadlines');
  await ready(page);
  await expect(page.locator('[data-kex-item]')).toHaveCount(24);
  await page.getByRole('button', { name: /Näita rohkem/ }).click();
  await expect(page.locator('[data-kex-item]')).toHaveCount(48);
  await page.getByRole('button', { name: /Näita rohkem/ }).click();
  await expect(page.locator('[data-kex-item]')).toHaveCount(60);
  await expect(page.getByRole('button', { name: /Näita rohkem/ })).toHaveCount(0);
});

test('reduced motion, effects off and keyboard paths keep all content usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/my/?view=dossier');
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-kex-motion', 'reduced');
  await expect(page.locator('canvas')).toHaveAttribute('data-fx', 'static');
  await page.getByRole('tab', { name: 'Tähtajad', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.kex-transition-ghost')).toHaveCount(0);
  await page.evaluate(async () => {
    await (window as unknown as { browser: { storage: { local: { set: (v: unknown) => Promise<void> } } } }).browser.storage.local.set({ 'kex:settings': { enabled: true, effects: 'off', motion: 'reduced' } });
  });
  await expect(page.locator('canvas')).toHaveAttribute('data-fx', 'fallback');
  await page.screenshot({ path: `${out}/dossier-reduced-off.png` });
});

test('cold Back waits for delayed course content before restoring the viewport', async ({ page }) => {
  await page.goto('/course/view.php?id=37582#topic-0');
  await ready(page);
  await expect(page.locator('#kex-main')).toHaveAttribute('data-kex-ready', 'true');
  await page.evaluate(() => window.scrollTo(0, 650));
  const saved = await page.evaluate(() => scrollY);
  expect(saved).toBeGreaterThan(300);
  await page.locator('[data-kex-test="sidebar-toggle"]').click();
  await page.locator('.kex-sb__course[data-course-id="37829"]').first().click();
  await expect(page.locator('#kex-main')).toHaveAttribute('data-kex-course', '37829');
  await page.waitForFunction(() => !document.documentElement.dataset.kexInteraction);
  await page.route('**/course/view.php?id=37582*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goBack();
  await page.waitForFunction(() => !document.documentElement.dataset.kexInteraction && document.querySelector('#kex-main')?.getAttribute('data-kex-course') === '37582');
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(saved, -1);
  // The outline lights up the topic at the top of the window, whichever that is.
  await expect(page.locator('.kex-outline [data-kex-topic][aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('.kex-transition-ghost')).toHaveCount(0);
  await page.goForward();
  await expect(page.locator('#kex-main')).toHaveAttribute('data-kex-course', '37829');
  await page.waitForFunction(() => !document.documentElement.dataset.kexInteraction);
  await page.setViewportSize({ width: 960, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${out}/course-half-width.png`, fullPage: true });
});

test('effects pause during interaction and recover a lost context without changing phase or layout', async ({ page }) => {
  await page.addInitScript(() => {
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    const counts = { draws: 0, readbacks: 0 };
    (window as unknown as { fxCounts: typeof counts }).fxCounts = counts;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) { counts.draws++; return draw.apply(this, args); };
    const read = WebGL2RenderingContext.prototype.readPixels;
    WebGL2RenderingContext.prototype.readPixels = new Proxy(read, { apply(target, receiver, args) { counts.readbacks++; return Reflect.apply(target, receiver, args); } });
  });
  await page.goto('/my/?view=dossier');
  await ready(page);
  const canvas = page.locator('canvas').first();
  await expect(canvas).toHaveAttribute('data-fx-state', /live|static/);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('kex:interaction', { detail: { busy: true } })));
  await expect(canvas).toHaveAttribute('data-fx-state', 'paused');
  const paused = await page.evaluate(() => (window as unknown as { fxCounts: { draws: number } }).fxCounts.draws);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as unknown as { fxCounts: { draws: number } }).fxCounts.draws)).toBe(paused);
  await page.evaluate(async () => {
    await (window as unknown as { browser: { storage: { local: { set(v: unknown): Promise<void> } } } }).browser.storage.local.set({ 'kex:settings': { enabled: true, effects: 'static', motion: 'full' } });
    document.dispatchEvent(new CustomEvent('kex:interaction', { detail: { busy: false } }));
  });
  await expect(canvas).toHaveAttribute('data-fx-state', 'static');
  const phase = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const gl = element.getContext('webgl2')!;
    return gl.getUniform(gl.getParameter(gl.CURRENT_PROGRAM), gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'uTime')!) as number;
  });
  const before = await phase();
  const bounds = await canvas.boundingBox();
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const extension = element.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    (window as unknown as { restoreFxContext(): void }).restoreFxContext = () => extension.restoreContext();
    extension.loseContext();
  });
  await expect(canvas).toHaveAttribute('data-fx-state', 'fallback');
  await page.evaluate(() => (window as unknown as { restoreFxContext(): void }).restoreFxContext());
  await expect(canvas).toHaveAttribute('data-fx-state', 'static');
  expect(await phase()).toBeCloseTo(before, 4);
  expect(await canvas.boundingBox()).toEqual(bounds);
  await page.evaluate(async () => {
    await (window as unknown as { browser: { storage: { local: { set(v: unknown): Promise<void> } } } }).browser.storage.local.set({ 'kex:settings': { enabled: true, effects: 'off', motion: 'full' } });
  });
  await expect(canvas).toHaveAttribute('data-fx-state', 'fallback');
  await page.evaluate(async () => {
    await (window as unknown as { browser: { storage: { local: { set(v: unknown): Promise<void> } } } }).browser.storage.local.set({ 'kex:settings': { enabled: true, effects: 'static', motion: 'full' } });
  });
  await expect(canvas).toHaveAttribute('data-fx-state', 'static');
  expect(await phase()).toBeCloseTo(before, 4);
  await page.setViewportSize({ width: 960, height: 800 });
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.width > 0 && element.height > 0)).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { fxCounts: { readbacks: number } }).fxCounts.readbacks)).toBe(0);
  await page.screenshot({ path: `${out}/effects-context-restored.png` });
});

test('a topic click while the course’s own page is still loading lands on that topic and clears loading', async ({ page }) => {
  await page.goto('/my/courses.php');
  await ready(page);
  await page.route('**/course/view.php?id=37582*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await route.continue();
  });
  await page.locator('[data-kex-test="sidebar-toggle"]').click();
  await page.locator('.kex-sb__course[data-course-id="37582"]').first().click();
  await expect(page.locator('.kex-outline [data-kex-topic]')).not.toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-kex-nav', 'loading');
  const topic = page.locator('.kex-outline [data-kex-topic]').nth(2);
  const selected = await topic.getAttribute('data-kex-topic');
  await topic.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-kex-nav', 'loading');
  await expect(page.locator(`.kex-outline [data-kex-topic="${selected}"]`)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.kex-coursenav a')).not.toHaveCount(0);
  await expect(page.locator('.kex-transition-ghost')).toHaveCount(0);
});

test('a course opens at its top with the hero, and topic clicks add no Back steps', async ({ page }) => {
  await page.goto('/my/courses.php');
  await ready(page);
  await page.locator('.kex-sb__course[data-course-id="37582"]').first().click();
  await expect(page.locator('#kex-main')).toHaveAttribute('data-kex-course', '37582');
  await page.waitForFunction(() => !document.documentElement.dataset.kexInteraction);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('.kex-hero')).toBeInViewport();
  await page.locator('.kex-outline [data-kex-topic]').nth(3).click();
  await page.locator('.kex-outline [data-kex-topic]').nth(5).click();
  await expect(page).toHaveURL(/#topic-\d+$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/my\/courses\.php$/);
});

test('faculty theme changes repaint a working shader without leaving a lost context', async ({ page }) => {
  await page.goto('/course/view.php?id=37582');
  await ready(page);
  const setColour = async (colourBySchool: boolean) => {
    await page.evaluate(async (colourBySchool) => {
      await (window as unknown as { browser: { storage: { local: { set(v: unknown): Promise<void> } } } }).browser.storage.local.set({ 'kex:settings': { enabled: true, effects: 'static', motion: 'full', colourBySchool } });
    }, colourBySchool);
  };
  // The old look's last frame is laid over the new canvas while it fades out (.kex-hero__snap).
  const canvas = page.locator('#kex-main .kex-hero__canvas:not(.kex-hero__snap)');
  for (const themed of [true, false, true]) {
    await setColour(themed);
    if (themed) await expect(page.locator('html')).toHaveAttribute('data-kex-school', 'it');
    else await expect(page.locator('html')).not.toHaveAttribute('data-kex-school');
    await expect(canvas).toHaveAttribute('data-fx-state', 'static');
    const palette = await canvas.evaluate((element: HTMLCanvasElement) => {
      const gl = element.getContext('webgl2')!;
      if (gl.isContextLost()) throw new Error('Theme changed into a lost WebGL context');
      const program = gl.getParameter(gl.CURRENT_PROGRAM);
      return [...gl.getUniform(program, gl.getUniformLocation(program, 'uBody')!)];
    });
    // IAS0230: the IT school's palette, turned a little for its prefix.
    const body = themed ? ribbonsFor('IAS0230', true).body : DEFAULT_RIBBONS.body;
    body.forEach((channel, i) => expect(palette[i]).toBeCloseTo(channel));
  }
});

for (const [name, path, selector] of [
  ['dossier', '/my/?view=dossier', '.kex-hero'],
  ['page-band', '/my/courses.php', '.kex-band'],
  ['faculty-course', '/course/view.php?id=37582', '.kex-hero'],
] as const) {
  test(`static artwork and first shader paint retain the same composition: ${name}`, async ({ page }) => {
    await holdShaderCompile(page, { flag: 'allowShaderPaint' });
    await page.goto(path);
    await ready(page);
    const art = page.locator(selector).first();
    await art.evaluate((element) => {
      element.querySelectorAll<HTMLElement>(':scope > :not(canvas)').forEach((child) => { child.style.visibility = 'hidden'; });
    });
    await page.evaluate(async () => {
      await (window as unknown as { browser: { storage: { local: { set(v: unknown): Promise<void> } } } }).browser.storage.local.set({ 'kex:settings': { enabled: true, effects: 'static', motion: 'full' } });
    });
    await expect(art).toHaveAttribute('data-mode', 'fallback');
    const before = PNG.sync.read(await art.screenshot({ path: `${out}/${name}-fallback.png` }));
    await page.evaluate(() => { (window as unknown as { allowShaderPaint?: boolean }).allowShaderPaint = true; });
    await expect(art).toHaveAttribute('data-mode', 'static');
    await expect.poll(() => art.locator('canvas').evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
    const after = PNG.sync.read(await art.screenshot({ path: `${out}/${name}-first-paint.png` }));
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    let difference = 0;
    for (let i = 0; i < before.data.length; i += 4) for (let channel = 0; channel < 3; channel++) difference += Math.abs(before.data[i + channel] - after.data[i + channel]);
    // Allow antialiasing/resampling and WebP compression, but reject a different crop or palette (those land at 20 and more).
    // The hero is 15 px narrower since round 10 keeps room for the scrollbar, which resamples the artwork a little more.
    const meanDifference = difference / (before.width * before.height * 3);
    expect(meanDifference).toBeLessThan(9);
    writeFileSync(`${out}/${name}-composition.json`, JSON.stringify({ meanDifference, width: before.width, height: before.height }));
  });
}
