import { defineConfig } from '@playwright/test';

const port = Number(process.env.KEX_DEMO_PORT || 8099);
const origin = `http://localhost:${port}`;
const artifacts = process.env.KEX_ARTIFACT_DIR || 'artifacts/local-review';
export default defineConfig({
  testDir: 'test/local',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  workers: 1,
  reporter: [['list'], ['json', { outputFile: `${artifacts}/playwright-results.json` }]],
  outputDir: `${artifacts}/test-results`,
  use: { headless: true, baseURL: origin, viewport: { width: 1440, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', channel: process.platform === 'win32' ? 'msedge' : undefined, launchOptions: { executablePath: process.env.KEX_CHROMIUM || undefined } },
  webServer: { command: 'node scripts/local-demo.mjs', url: `${origin}/__demo/meta`, reuseExistingServer: false, timeout: 30_000 },
});
