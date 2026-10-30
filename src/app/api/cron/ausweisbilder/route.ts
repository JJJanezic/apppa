import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { removeUnusedDocuments } from '@/lib/guest-documents'
import { removeUnusedInvoicePdfs } from '@/lib/invoice-files'

// Tägliche Bereinigung der Ausweisbilder (PROJ-29) und Rechnungs-PDFs (PROJ-37), aufgerufen von Vercel Cron (vercel.json).
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
  // Ein Zeitplan, ein Schlüssel; beide Bereiche laufen auch, wenn einer scheitert
  const [documents, invoices] = await Promise.all([removeUnusedDocuments(), removeUnusedInvoicePdfs()])
  const failed = documents.failed || invoices.failed
  return NextResponse.json({ removed: documents.removed, invoicePdfsRemoved: invoices.removed, failed }, { status: failed ? 500 : 200 })
}
