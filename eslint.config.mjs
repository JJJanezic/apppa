import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// ESLint (Next.js 16: Flat Config statt `next lint`). Regeln von Next.js inkl. React-Hooks,
// Core Web Vitals und TypeScript.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Von shadcn/ui erzeugter Code: nicht von Hand ändern (Projektregel), daher nur grobe Regeln
  {
    files: ['src/components/ui/**', 'src/hooks/use-toast.ts'],
    rules: { 'react-hooks/purity': 'off', '@typescript-eslint/no-unused-vars': 'off' },
  },
  // Playwright: die Fixture-Funktion `use` ist kein React-Hook
  {
    files: ['tests/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**']),
])
