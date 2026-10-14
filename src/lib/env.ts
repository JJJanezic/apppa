import { z } from 'zod'

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

const serverSchema = clientSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
})

export type ClientEnv = z.infer<typeof clientSchema>
export type ServerEnv = z.infer<typeof serverSchema>

function parseEnv<T extends z.ZodType>(schema: T, values: Record<string, string | undefined>): z.infer<T> {
  const result = schema.safeParse(values)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const name = String(issue.path[0])
      return values[name] ? `${name} ist ungültig (${issue.message})` : `${name} fehlt`
    })
    throw new Error(
      `Umgebungsvariablen fehlen oder sind ungültig:\n- ${problems.join('\n- ')}\n` +
        'Siehe .env.local.example.'
    )
  }
  return result.data
}

// NEXT_PUBLIC_-Variablen müssen einzeln ausgeschrieben werden, damit Next.js sie in den Browser-Code übernimmt.
export function getClientEnv(): ClientEnv {
  return parseEnv(clientSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
}

// Nur auf dem Server verwenden: enthält den geheimen Schlüssel.
export function getServerEnv(): ServerEnv {
  return parseEnv(serverSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  })
}
