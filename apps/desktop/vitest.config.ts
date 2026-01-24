import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    fileParallelism: false,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        'electron/main.ts', // Requires Electron runtime
        'electron/preload.ts', // Requires Electron runtime
        'electron/index.ts', // Re-exports only
        'src/pages/**', // Next.js pages - tested via E2E
      ],
      thresholds: {
        // Temporarily lowered for testable code
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@electron': resolve(__dirname, './electron'),
    },
  },
});
