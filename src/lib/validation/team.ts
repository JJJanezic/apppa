import { z } from 'zod'

import { normalizeEmail } from '@/lib/validation/auth'

// Prüfregeln für Team & Kunde (PROJ-4). Browser und Server-Aktionen nutzen dieselben Schemas.
// Meldungen kommen über `t` aus messages/de.json („team.validation“).

type T = (key: string) => string

export const TENANT_NAME_MAX = 200

export const inviteSchema = (t: T) =>
  z.object({
    email: z.string().trim().min(1, t('emailRequired')).pipe(z.email(t('emailInvalid'))).transform(normalizeEmail),
    role: z.enum(['owner', 'staff'], { error: t('roleRequired') }),
  })

export type InviteValues = z.infer<ReturnType<typeof inviteSchema>>
export type InviteInput = z.input<ReturnType<typeof inviteSchema>>
