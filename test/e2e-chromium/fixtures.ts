import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIST = path.join(root, 'dist/firefox-dev');
const SHIM = path.join(root, 'test/shim/browser-shim.js');

export const LAB = 'http://localhost:8080';
export const STUDENT = { username: 'student', password: 'Student#2026' };

export interface Seed {
  [key: string]: unknown;
}

interface Options {
  /** Values for browser.storage.local before the first page load. */
  seed: Seed;
  /** Load the extension (default). Set false to compare with plain Moodle. */
  kex: boolean;
}

interface WorkerFixtures {
  studentState: Awaited<ReturnType<BrowserContext['storageState']>>;
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

export const test = base.extend<Options, WorkerFixtures>({
  seed: [{}, { option: true }],
  kex: [true, { option: true }],
  studentState: [
    async ({ browser }, use) => {
      const ctx = await browser.newContext();
      await login(ctx);
      const state = await ctx.storageState();
      await ctx.close();
      await use(state);
    },
    { scope: 'worker' },
  ],
  storageState: async ({ studentState }, use) => {
    await use(studentState);
  },
  page: async ({ page, seed, kex }, use) => {
    if (kex) await installKex(page, seed);
    await use(page);
  },
});

export { expect };

/** Wait until the shell is mounted and the sidebar course list has settled. */
export async function waitForShell(page: Page): Promise<void> {
  await page.waitForSelector('#kex-root .kex-sidebar');
  await page.waitForFunction(() => document.documentElement.dataset.kexData === 'idle');
  await page.evaluate(() => document.fonts.ready);
}
