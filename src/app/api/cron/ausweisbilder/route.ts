import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { removeUnusedDocuments } from '@/lib/guest-documents'

// Tägliche Bereinigung der Ausweisbilder (PROJ-29), aufgerufen von Vercel Cron (vercel.json).
// Vercel sendet „Authorization: Bearer <CRON_SECRET>“; ohne gesetztes Geheimnis läuft nichts.
export const dynamic = 'force-dynamic'

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(header)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await removeUnusedDocuments()
  return NextResponse.json(result, { status: result.failed ? 500 : 200 })
}
