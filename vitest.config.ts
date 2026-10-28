import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // tests/ enthält die Playwright-E2E-Tests (npm run test:e2e)
    exclude: ['**/node_modules/**', '**/.next/**', 'tests/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        // Gegen „apppa-dev“; meldet die gemeinsamen Testnutzer einmal je Lauf an (supabase/tests/global-setup.ts)
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['supabase/tests/**/*.test.ts'],
          globalSetup: ['./supabase/tests/global-setup.ts'],
          // Netzwerk und geteilte Dev-Datenbank: 5 s (Standard) reichen unter Last nicht
          testTimeout: 30_000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
