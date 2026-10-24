import { z } from 'zod'

import { normalizeEmail } from '@/lib/validation/auth'
import { TENANT_NAME_MAX } from '@/lib/validation/team'

// Prüfregeln für den Betreiber-Bereich (PROJ-5). Browser und Server-Aktionen nutzen dieselben Schemas.
// Meldungen kommen über `t` aus messages/de.json („operator.validation“).

type T = (key: string) => string

const email = (t: T) => z.string().trim().min(1, t('emailRequired')).pipe(z.email(t('emailInvalid'))).transform(normalizeEmail)

export const createTenantSchema = (t: T) =>
  z.object({
    name: z.string().trim().min(1, t('nameRequired')).max(TENANT_NAME_MAX, t('nameTooLong')),
    email: email(t),
    // Hinweis „gleicher Name“ wurde gesehen und bestätigt
    allowDuplicate: z.boolean().optional(),
  })

export const ownerInviteSchema = (t: T) => z.object({ email: email(t) })

export type CreateTenantValues = z.infer<ReturnType<typeof createTenantSchema>>
export type CreateTenantInput = z.input<ReturnType<typeof createTenantSchema>>
export type OwnerInviteValues = z.infer<ReturnType<typeof ownerInviteSchema>>
export type OwnerInviteInput = z.input<ReturnType<typeof ownerInviteSchema>>
