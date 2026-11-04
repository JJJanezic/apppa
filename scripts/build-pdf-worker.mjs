import { readFile } from 'node:fs/promises'

import { build } from 'esbuild'

// PDF-Arbeitsprozess (PROJ-41) als eigenständige Datei bauen. Turbopack bündelt Worker nicht; die Datei enthält React-PDF
// vollständig, die App selbst bindet die Bibliothek nie ein.
// pdfkit lädt seine Standardschriften erst zur Laufzeit über einen Import-Pfad seines eigenen Pakets. Im Bündel gibt es
// den nicht mehr, darum werden diese Aufrufe hier zu normalen, mitgebündelten Importen.
const standardFonts = {
  name: 'pdfkit-standard-fonts',
  setup(b) {
    b.onLoad({ filter: /pdfkit[\\/]js[\\/]pdfkit\.node\.mjs$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8')
      const pattern = /require\$1\(\s*["']#standard-fonts\/(\w+)["']\s*\)/g
      if (!pattern.test(source)) throw new Error('pdfkit: Standardschriften nicht gefunden; Version prüfen')
      return { contents: source.replace(pattern, (_, name) => `require("pdfkit/standard-fonts/${name}")`), loader: 'js' }
    })
  },
}

await build({
  entryPoints: ['src/lib/invoice-pdf/render-worker.ts'],
  outfile: 'pdf-worker-build/render-worker.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: true,
  jsx: 'automatic',
  tsconfig: 'tsconfig.json',
  plugins: [standardFonts],
  // gebündelte CommonJS-Teile brauchen require
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
})
