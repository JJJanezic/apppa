// Kunden-Logo (PROJ-38): Umwandlung im Browser vor dem Hochladen.
// Jedes Logo wird richtig gedreht, auf höchstens 1.000 Pixel (längste Seite) verkleinert und als PNG gespeichert.
// Ein durchsichtiger Hintergrund bleibt erhalten. Das Original wird nicht aufbewahrt.

import { decodeImage, fitWithin, ImageConvertError } from '@/lib/document-image'
import { isLogoFile, LOGO_MAX_EDGE, LOGO_MAX_INPUT_BYTES, LOGO_MAX_OUTPUT_BYTES } from '@/lib/tenant-logo'

export type ConvertedLogo = { blob: Blob; width: number; height: number }

function toPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Datei → PNG (höchstens 5 MB). Fehler als ImageConvertError mit Meldungs-Code.
export async function convertLogoImage(file: File): Promise<ConvertedLogo> {
  if (!isLogoFile(file.name, file.type)) throw new ImageConvertError('imageUnsupported')
  if (file.size > LOGO_MAX_INPUT_BYTES) throw new ImageConvertError('imageTooLarge')
  const bitmap = await decodeImage(file)
  try {
    const size = fitWithin(bitmap.width, bitmap.height, LOGO_MAX_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new ImageConvertError('imageFailed')
    // Kein Hintergrund: transparente Flächen bleiben transparent
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    const blob = await toPng(canvas)
    if (!blob || blob.size > LOGO_MAX_OUTPUT_BYTES) throw new ImageConvertError('imageFailed')
    return { blob, ...size }
  } finally {
    bitmap.close()
  }
}
