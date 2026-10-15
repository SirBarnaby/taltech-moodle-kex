import { test as base, expect, type Page } from '@playwright/test';
import { LAB, STUDENT, DIST, login, installKex, type Seed } from '../harness/kex';

export { LAB, STUDENT, DIST, login, installKex };
export type { Seed };

interface Options {
  /** Values for browser.storage.local before the first page load. */
  seed: Seed;
  /** Load the extension (default). Set false to compare with plain Moodle. */
  kex: boolean;
}

interface WorkerFixtures {
  studentState: Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>;
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
