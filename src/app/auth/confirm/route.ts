import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Ziel der Links aus den Einladungs- und Passwort-Reset-Mails (supabase/templates/*.html).
// Bestätigt den Token und meldet die Person an; die Oberflächen dazu entstehen in PROJ-3.
const ALLOWED_TYPES: EmailOtpType[] = ['invite', 'recovery', 'email_change']

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'
  // Nur relative Pfade zulassen (kein Open Redirect)
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin))
    }
  }

  return NextResponse.redirect(new URL('/?auth_error=link_invalid', origin))
}
