import localFont from 'next/font/local'
import type { CSSProperties } from 'react'

import type { RichAttrs, RichFont } from '@/lib/rich-text'

// Schriften der Rechnungstexte (PROJ-39). Dieselben Dateien wie im PDF (src/lib/invoice-pdf/fonts), als WOFF2 in
// src/app/fonts: keine Verbindung zu Google, weder beim Bauen noch beim Seitenaufruf. Ohne Vorladen: Der Browser holt nur
// die Schrift, die tatsächlich angezeigt wird. Nur die Seiten mit Editor oder Entwurfsvorschau binden diese Datei ein.
// next/font verlangt je Schrift einen eigenen Aufruf mit festen Werten. Der Name der Konstante wird der Name der Schrift;
// „rich…“ trennt sie von der App-Schrift (sonst mischte der Browser beide Source Serif zu einer Familie).
const richArimo = localFont({
  src: [
    { path: '../../app/fonts/Arimo-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../app/fonts/Arimo-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../app/fonts/Arimo-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../../app/fonts/Arimo-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
})
const richTinos = localFont({
  src: [
    { path: '../../app/fonts/Tinos-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../app/fonts/Tinos-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../app/fonts/Tinos-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../../app/fonts/Tinos-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
})
const richCarlito = localFont({
  src: [
    { path: '../../app/fonts/Carlito-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../app/fonts/Carlito-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../app/fonts/Carlito-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../../app/fonts/Carlito-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
})
const richSourceSans = localFont({
  src: [
    { path: '../../app/fonts/SourceSans3-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../app/fonts/SourceSans3-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../app/fonts/SourceSans3-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../../app/fonts/SourceSans3-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
})
const richSourceSerif = localFont({
  src: [
    { path: '../../app/fonts/SourceSerif4-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../app/fonts/SourceSerif4-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../app/fonts/SourceSerif4-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../../app/fonts/SourceSerif4-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
})
const richOpenSans = localFont({
  src: [
    { path: '../../app/fonts/OpenSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../app/fonts/OpenSans-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../app/fonts/OpenSans-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../../app/fonts/OpenSans-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
})

export const RICH_FONT_FAMILY: Record<RichFont, string> = {
  arimo: richArimo.style.fontFamily,
  tinos: richTinos.style.fontFamily,
  carlito: richCarlito.style.fontFamily,
  'source-sans': richSourceSans.style.fontFamily,
  'source-serif': richSourceSerif.style.fontFamily,
  'open-sans': richOpenSans.style.fontFamily,
}

// Darstellung der Einstellungen eines Texts; ohne Angabe gilt, was die Umgebung vorgibt (Standard, linksbündig)
export function richTextStyle(attrs: RichAttrs | undefined): CSSProperties {
  const style: CSSProperties = {}
  if (attrs?.fontFamily) style.fontFamily = RICH_FONT_FAMILY[attrs.fontFamily]
  if (attrs?.fontSize) style.fontSize = `${attrs.fontSize}pt`
  if (attrs?.textAlign) style.textAlign = attrs.textAlign
  return style
}
