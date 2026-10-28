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
  // Einheitliche Formate (PROJ-31): Datum und Beträge nur über src/lib/format.ts. Erlaubte Ausnahmen
  // (Monatsüberschriften, Datum unter dem Dashboard-Gruß) mit eslint-disable-next-line und Begründung.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/format.ts', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.property.name=/^(dateTime|number)$/][callee.object.name='format']",
          message: 'Datum und Beträge über src/lib/format.ts formatieren (formatDate, formatCents, formatNumber …).',
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleDateString'] > Literal[value!='sv-SE']",
          message: 'Datum über src/lib/format.ts formatieren (sv-SE nur für ISO-Tage).',
        },
      ],
    },
  },
  // Playwright: die Fixture-Funktion `use` ist kein React-Hook
  {
    files: ['tests/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**']),
])
