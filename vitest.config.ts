import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'happy-dom',
    environmentOptions: { happyDOM: { settings: { disableJavaScriptEvaluation: true, disableCSSFileLoading: true, disableJavaScriptFileLoading: true } } },
    // One worker context is reused for every file in it (no module re-import, no new DOM per file): `npm test` stays under 5 s.
    // The price: a test file cleans up what it changes (document, storage, module-level stores) in afterEach.
    // Files that never touch `document` start with `// @vitest-environment node`.
    isolate: false,
    testTimeout: 20_000,
    // happy-dom reports every external script, stylesheet and iframe it refuses to load; none of it is a test failure.
    onConsoleLog: (log) => (/loading is disabled|moodle strings unavailable/.test(log) ? false : undefined),
  },
  define: { __DEBUG__: 'true', __VERSION__: '"test"' },
});
