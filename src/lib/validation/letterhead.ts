import { z } from 'zod'

import {
  isLetterheadFontSize,
  isLetterheadLogoHeight,
  LETTERHEAD_FONT_SIZE as S,
  LETTERHEAD_LOGO_HEIGHT as H,
  LETTERHEAD_SPACINGS,
  LOGO_POSITIONS,
} from '@/lib/letterhead'
import { RICH_FONTS } from '@/lib/rich-text'

type T = (key: string, values?: Record<string, string | number>) => string

// Eingabe mit Komma oder Punkt; Feld ist Text, damit „11,5“ während des Tippens stehen bleibt
const number = (v: string) => Number(v.trim().replace(',', '.'))

export const letterheadSchema = (t: T) =>
  z.object({
    fontFamily: z.enum(RICH_FONTS),
    fontSize: z
      .string()
      .refine((v) => /^\d+([.,]\d+)?$/.test(v.trim()) && isLetterheadFontSize(number(v)), t('fontSizeRange', { min: S.min, max: S.max }))
      .transform(number),
    lineSpacing: z.enum(LETTERHEAD_SPACINGS),
    paragraphSpacing: z.enum(LETTERHEAD_SPACINGS),
    logoPosition: z.enum(LOGO_POSITIONS),
    logoHeightMm: z
      .string()
      .refine((v) => /^\d+$/.test(v.trim()) && isLetterheadLogoHeight(number(v)), t('logoHeightRange', { min: H.min, max: H.max }))
      .transform(number),
    showIssuer: z.boolean(),
  })

export type LetterheadInput = z.input<ReturnType<typeof letterheadSchema>>
export type LetterheadOutput = z.output<ReturnType<typeof letterheadSchema>>
