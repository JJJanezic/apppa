import { NextResponse, type NextRequest } from 'next/server'

// Frühere Adresse der Mail-Links (PROJ-1). Löst nichts mehr ein, sondern leitet nur auf die Bestätigungsseite:
// Linkscanner rufen Links per GET auf und würden Einmal-Links sonst verbrauchen (BUG-3 PROJ-1).
// Eingelöst wird erst per Knopf auf /bestaetigen. Rücksprung-Ziele („next“) werden nicht übernommen.
const ALLOWED_TYPES = ['invite', 'recovery']

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const target = new URL('/bestaetigen', request.nextUrl.origin)
  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    target.searchParams.set('token_hash', tokenHash)
    target.searchParams.set('type', type)
  }
  return NextResponse.redirect(target)
}
