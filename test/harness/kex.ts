import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext, Page } from 'playwright';

/** Shared by the Playwright specs and the plain-node scripts (visual diff): lab login, extension injection, seeds. */

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIST = path.join(root, 'dist/firefox-dev');
const SHIM = path.join(root, 'test/shim/browser-shim.js');

export const LAB = 'http://localhost:8080';
export const STUDENT = { username: 'student', password: 'Student#2026' };

export interface Seed {
  [key: string]: unknown;
}

/** Log in through the real form (token + POST), as a student would. */
export async function login(context: BrowserContext, who: { username: string; password: string } = STUDENT): Promise<void> {
  const page = await context.newPage();
  await page.goto(`${LAB}/login/index.php`);
  await page.fill('#username', who.username);
  await page.fill('#password', who.password);
  await Promise.all([page.waitForURL(/\/my\//), page.click('#loginbtn')]);
  await page.close();
}

/** CSS text with extension-relative font URLs pointed at the virtual extension origin. */
export function kexCss(): string {
  return readFileSync(path.join(DIST, 'kex.css'), 'utf8').replace(/url\(["']?(fonts|assets)\//g, 'url(https://kex.ext/$1/');
}

/** Inject the stylesheet as early as possible (before the first paint), like a manifest content_scripts css entry. */
function cssInjector(css: string): string {
  return `(() => {
    if (window.top !== window) return;
    const style = document.createElement('style');
    style.id = 'kex-test-css';
    style.textContent = ${JSON.stringify(css)};
    const attach = () => {
      const html = document.documentElement;
      if (!html) return false;
      html.insertBefore(style, html.firstChild);
      return true;
    };
    if (!attach()) {
      const mo = new MutationObserver(() => attach() && mo.disconnect());
      mo.observe(document, { childList: true });
    }
  })();`;
}

const MIME: Record<string, string> = {
  '.woff2': 'font/woff2', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
};

export async function installKex(page: Page, seed: Seed): Promise<void> {
  await page.route('https://kex.ext/**', async (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\//, '');
    try {
      const body = readFileSync(path.join(DIST, rel));
      await route.fulfill({
        status: 200,
        body,
        headers: { 'content-type': MIME[path.extname(rel)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' },
      });
    } catch {
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  await page.addInitScript(`window.__KEX_SEED__ = ${JSON.stringify(seed)};`);
  await page.addInitScript({ path: SHIM });
  await page.addInitScript(cssInjector(kexCss()));
  await page.addInitScript({ path: path.join(DIST, 'content.js') });
}


export const STUDENT_ID = 3;
export const COURSE_ITI = 2;

const HOST = new URL(LAB).host;
const envelope = <T>(data: T): { v: 1; at: number; data: T } => ({ v: 1, at: Date.now(), data });

/** The three pins of iteration3 (real lab cmids). */
export function iter3Pins(): unknown[] {
  const mk = (cmid: number, courseId: number, courseCode: string, title: string): unknown => ({
    cmid, courseId, courseCode, title, modname: 'resource', kind: 'lecture', format: 'PDF', url: `${LAB}/mod/resource/view.php?id=${cmid}`, addedAt: 1_760_000_000_000 + cmid,
  });
  return [mk(21, 2, 'ITI8801', 'Kubernetes slides'), mk(65, 4, 'IAS0230', 'ARM Cortex-M'), mk(35, 3, 'EMT0140', 'IoT project brief')];
}

/** storage.local contents for the visual diff: frozen shader time, three pins; aliases and order are the shipped defaults. */
export function iter3Seed(extra: Record<string, unknown> = {}): Seed {
  return {
    // The mock is the default look: no school colours, the lab's own language.
    'kex:settings': { enabled: true, effects: 'animated', motion: 'full', theme: 'light', colourBySchool: false, debug: { freezeTime: 7.3 }, ...extra },
    [`kex:v1:${HOST}:${STUDENT_ID}:pins`]: envelope(iter3Pins()),
  };
}

export function seedWithPins(pins: unknown[], settings: Record<string, unknown> = {}): Seed {
  return {
    'kex:settings': { enabled: true, ...settings },
    [`kex:v1:${HOST}:${STUDENT_ID}:pins`]: envelope(pins),
  };
}

/** Wait until the shell is mounted, the sidebar settled, fonts loaded and animations finished. */
export async function waitForCourse(page: Page): Promise<void> {
  await page.waitForSelector('#kex-root [data-kex-test=course] [data-kex-test=topics-row-1]');
  await page.waitForFunction(() => document.documentElement.dataset.kexData === 'idle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.documentElement.dataset.kexAnim === 'done', undefined, { timeout: 20_000 });
}
