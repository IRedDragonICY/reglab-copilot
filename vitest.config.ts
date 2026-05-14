import { defineConfig } from 'vitest/config';
import path from 'path';

// Vitest config at repo root. Mirrors the `resolve.alias` from `vite.config.ts`
// so `@/` imports work identically in tests as they do in app code.
// Default environment is `node`; suites that need DOM APIs can opt in per-file
// via the `// @vitest-environment jsdom` directive at the top of the test file.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    css: false,
    restoreMocks: true,
  },
});
