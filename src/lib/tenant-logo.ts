// Kunden-Logo (PROJ-38): Speicherbereich, Speicherort und Grenzen. Gilt im Browser und auf dem Server.

export const LOGO_BUCKET = 'tenant-logos'

// Eingang (vor der Umwandlung) und Ergebnis (PNG; gleiche Grenze im Speicherbereich)
export const LOGO_MAX_INPUT_BYTES = 10 * 1024 * 1024
export const LOGO_MAX_OUTPUT_BYTES = 5 * 1024 * 1024
// Längste Seite nach dem Umwandeln; kleinere Logos werden nie vergrößert
export const LOGO_MAX_EDGE = 1000
// Darunter (längere Seite) erscheint der Hinweis, dass das Logo im Druck unscharf wirken kann
export const LOGO_SMALL_EDGE = 300

// Platzhalter im Formular, solange das Logo noch umgewandelt bzw. hochgeladen wird (blockiert das Speichern)
export const LOGO_UPLOADING = 'uploading'

// Speicherort: <Kunde>/<zufällig>.png
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const LOGO_PATH = new RegExp(`^${UUID}/${UUID}\\.png$`)

export const isLogoPath = (value: string): boolean => LOGO_PATH.test(value)

// Gehört der Speicherort zum Ordner dieses Kunden?
export const isLogoPathOf = (value: string, tenantId: string): boolean =>
  isLogoPath(value) && value.startsWith(`${tenantId.toLowerCase()}/`)

// Erlaubte Eingänge: PNG, JPEG, WebP, GIF und HEIC/HEIF (Typ oder, ohne Typ, die Endung). SVG, BMP, TIFF, PDF nicht.
const LOGO_TYPES = /^image\/(png|jpeg|webp|gif|hei[cf](-sequence)?)$/i
const LOGO_EXTENSIONS = /\.(png|jpe?g|webp|gif|heic|heif)$/i

export function isLogoFile(name: string, type: string): boolean {
  if (type) return LOGO_TYPES.test(type) || (type === 'application/octet-stream' && LOGO_EXTENSIONS.test(name))
  return LOGO_EXTENSIONS.test(name)
}

// Auswahl im Dateidialog (HEIC ausdrücklich, manche Systeme kennen den Bildtyp nicht)
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.heic,.heif'

// Kleines Logo? (längere Seite unter 300 Pixel)
export const isSmallLogo = (width: number, height: number): boolean => Math.max(width, height) < LOGO_SMALL_EDGE
