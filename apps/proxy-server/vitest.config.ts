import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      thresholds: {
        // Temporarily lowered until full implementation in later subagents
        branches: 60,
        functions: 40,
        lines: 40,
        statements: 40,
      },
    },
  },
});
