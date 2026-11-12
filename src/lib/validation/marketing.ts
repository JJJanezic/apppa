import { z } from 'zod'

import { SEGMENT_NAME_MAX } from '@/lib/marketing'

// Name eines Segments (PROJ-52): Pflicht, bis 60 Zeichen; Eindeutigkeit je Kunde prüft die Datenbank.
// Meldungen aus „marketing.segments.validation“.

type T = (key: string) => string

export const segmentNameSchema = (t: T) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, t('nameRequired'))
      .max(SEGMENT_NAME_MAX, t('nameTooLong')),
  })

export type SegmentNameInput = z.input<ReturnType<typeof segmentNameSchema>>
