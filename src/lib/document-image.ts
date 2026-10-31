// Ausweisbilder (PROJ-29): Umwandlung im Browser vor dem Hochladen.
// Jedes Bild wird richtig gedreht, auf höchstens 2.000 Pixel (längste Seite) verkleinert und als JPEG gespeichert.
// Dabei gehen versteckte Fotodaten (GPS, Kameramodell) verloren. Das Original wird nicht aufbewahrt.

export const MAX_INPUT_BYTES = 30 * 1024 * 1024
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
export const MAX_EDGE = 2000
const QUALITIES = [0.85, 0.75, 0.6] as const

export type ImageErrorCode = 'imageTooLarge' | 'imageUnsupported' | 'imageFailed'

export class ImageConvertError extends Error {
  constructor(readonly code: ImageErrorCode) {
    super(code)
  }
}

// Auswahl im Dateidialog: alle Bilder, HEIC/HEIF ausdrücklich (manche Systeme kennen den Bildtyp nicht)
export const IMAGE_ACCEPT = 'image/*,.heic,.heif'

// HEIC/HEIF erkennen: am Typ oder, wenn der Browser keinen Typ kennt, an der Endung
export function isHeicFile(name: string, type: string): boolean {
  if (/^image\/hei[cf](-sequence)?$/i.test(type)) return true
  return (type === '' || type === 'application/octet-stream') && /\.(heic|heif)$/i.test(name)
}

// Ist die Datei überhaupt ein Bild? (Typ image/* oder HEIC an der Endung)
export function looksLikeImage(name: string, type: string): boolean {
  return type.startsWith('image/') || isHeicFile(name, type)
}

// Zielgröße: längste Seite höchstens `max`, Seitenverhältnis bleibt, nie vergrößern
export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

// Auch für das Kunden-Logo (PROJ-38) genutzt
export async function decodeImage(file: File): Promise<ImageBitmap> {
  // Moderne Browser drehen nach der Kamera-Angabe (EXIF) selbst; Safari kann auch HEIC selbst lesen
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    if (!isHeicFile(file.name, file.type)) throw new ImageConvertError('imageUnsupported')
  }
  // Chrome, Firefox, Edge: HEIC-Dekoder erst jetzt nachladen (eigene Datei, nicht im normalen Seiten-Bundle)
  try {
    const { heicTo } = await import('heic-to/next')
    return await heicTo({ blob: file, type: 'bitmap', options: { imageOrientation: 'from-image' } })
  } catch {
    throw new ImageConvertError('imageUnsupported')
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

// Datei → JPEG (höchstens 2 MB). Fehler als ImageConvertError mit Meldungs-Code.
export async function convertDocumentImage(file: File): Promise<Blob> {
  if (!looksLikeImage(file.name, file.type)) throw new ImageConvertError('imageUnsupported')
  if (file.size > MAX_INPUT_BYTES) throw new ImageConvertError('imageTooLarge')
  const bitmap = await decodeImage(file)
  try {
    const size = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new ImageConvertError('imageFailed')
    // Transparente Flächen (PNG, GIF) weiß statt schwarz
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size.width, size.height)
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, quality)
      if (blob && blob.size <= MAX_OUTPUT_BYTES) return blob
    }
    throw new ImageConvertError('imageFailed')
  } finally {
    bitmap.close()
  }
}
