import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/services/**', 'src/routes/**', 'src/middleware/**'],
      exclude: ['src/__tests__/**'],
    },
    // Short timeout since all DB calls are mocked
    testTimeout: 10000,
  },
})
