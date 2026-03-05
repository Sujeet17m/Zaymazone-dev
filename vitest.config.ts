/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/components/artisan/**',
        'src/pages/ArtisanDashboard.tsx',
        'src/pages/ArtisanOrders.tsx',
        'src/lib/api.ts',
      ],
      exclude: ['src/__tests__/**'],
    },
    testTimeout: 10000,
  },
})
