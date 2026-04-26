import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/*.config.{js,ts}',
      'vitest.setup.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
        '**/*.config.{js,ts}',
        '**/types/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
