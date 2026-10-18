import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  testMatch: ['e2e-chromium/**/*.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 1585, height: 992 },
    deviceScaleFactor: 1,
    actionTimeout: 10_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
