import { Arimo, Carlito, Open_Sans, Source_Sans_3, Source_Serif_4, Tinos } from 'next/font/google'
import type { CSSProperties } from 'react'

import type { RichAttrs, RichFont } from '@/lib/rich-text'

// Schriften der Rechnungstexte (PROJ-39). Beim Bauen mitgeliefert, keine Verbindung zu Google beim Seitenaufruf. Ohne
// Vorladen: Der Browser holt nur die Schrift, die tatsächlich angezeigt wird. Nur die Seiten mit Editor oder
// Entwurfsvorschau binden diese Datei ein.
const arimo = Arimo({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap', preload: false })
const tinos = Tinos({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap', preload: false })
const carlito = Carlito({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap', preload: false })
const sourceSans = Source_Sans_3({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap', preload: false })
const sourceSerif = Source_Serif_4({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap', preload: false })
const openSans = Open_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap', preload: false })

export const RICH_FONT_FAMILY: Record<RichFont, string> = {
  arimo: arimo.style.fontFamily,
  tinos: tinos.style.fontFamily,
  carlito: carlito.style.fontFamily,
  'source-sans': sourceSans.style.fontFamily,
  'source-serif': sourceSerif.style.fontFamily,
  'open-sans': openSans.style.fontFamily,
}

// Darstellung der Einstellungen eines Texts; ohne Angabe gilt, was die Umgebung vorgibt (Standard, linksbündig)
export function richTextStyle(attrs: RichAttrs | undefined): CSSProperties {
  const style: CSSProperties = {}
  if (attrs?.fontFamily) style.fontFamily = RICH_FONT_FAMILY[attrs.fontFamily]
  if (attrs?.fontSize) style.fontSize = `${attrs.fontSize}pt`
  if (attrs?.textAlign) style.textAlign = attrs.textAlign
  return style
}
