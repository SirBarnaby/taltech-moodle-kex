import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'happy-dom',
    environmentOptions: { happyDOM: { settings: { disableJavaScriptEvaluation: true, disableCSSFileLoading: true, disableJavaScriptFileLoading: true } } },
  },
  define: { __DEBUG__: 'true', __VERSION__: '"test"' },
});
