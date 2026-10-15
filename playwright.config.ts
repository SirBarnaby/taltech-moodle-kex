import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  testMatch: ['e2e-chromium/**/*.spec.ts', 'visual/**/*.spec.ts'],
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
  projects: [
    {
      name: 'chromium',
      // Software WebGL2 so the hero shader runs in headless Chromium.
      use: { browserName: 'chromium', launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
    },
  ],
});
