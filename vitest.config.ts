import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['tests/**/*.test.ts'], // Исключаем старые Jest тесты
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/index.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    // Увеличиваем таймауты для тестов с сетью/БД
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

