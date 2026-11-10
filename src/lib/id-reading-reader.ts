import 'server-only'

import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'

import type { IdReadValues } from '@/lib/id-reading'
import { MODEL_ANSWER_JSON_SCHEMA, modelAnswerSchema, normalizeModelAnswer } from '@/lib/id-reading-normalize'

// „Ausweis-Leser“ (PROJ-51): einziger Ort, der den KI-Anbieter kennt. Claude über Amazon Bedrock (Mantle-Endpunkt) in der
// Region aus BEDROCK_REGION; Zugang nur aus Server-Variablen (eigene Namen, Vercel reserviert AWS_*). Feste Anweisung, festes
// Antwortschema, kein freies Eingabefeld – der Zugang lässt sich über die App nur für diese eine Aufgabe nutzen.
// Wechsel des Anbieters (z. B. Google Vertex) betrifft nur diese Datei.

export type ReaderOutcome =
  | { ok: true; read: IdReadValues; usage: Usage }
  // kein Ausweis erkannt oder Aufgabe abgelehnt (Dienst erreicht → zählt)
  | { ok: false; reason: 'noDocument'; usage: Usage | null }
  // Antwort unbrauchbar oder Zeitüberschreitung (Kosten möglich → zählt)
  | { ok: false; reason: 'failed'; usage: Usage | null }
  // keine Verbindung, Zugang ungültig, Modell gesperrt, Dienst gestört (zählt nicht)
  | { ok: false; reason: 'unreachable'; usage: null }
  // Zugang nicht eingerichtet
  | { ok: false; reason: 'notConfigured'; usage: null }

export type Usage = { model: string; inputTokens: number; outputTokens: number }
export type IdImage = { side: 'front' | 'back'; jpeg: Buffer }

// Der Server bricht nach 50 Sekunden ab (die Schnittstelle darf 60 Sekunden laufen)
const TIMEOUT_MS = 50_000

const SYSTEM = `Du bist Teil einer Hotel-Software in Österreich. Beherbergungsbetriebe sind nach dem Meldegesetz verpflichtet, bei Gästen Art, Nummer, Ausstellungsdatum, ausstellende Behörde und Staat des Reisedokuments sowie Name, Geburtsdatum, Geschlecht und Staatsangehörigkeit zu erfassen. Der Gast legt seinen Ausweis beim Check-in selbst vor; das Personal fotografiert ihn mit Zustimmung des Gastes. Deine Aufgabe ist, die Angaben von den Bildern abzulesen, damit das Personal sie nicht abtippen muss. Das Personal prüft jedes Ergebnis vor dem Speichern.

Regeln:
- Gib nur aus, was tatsächlich auf den Bildern steht. Rate nichts und leite nichts ab (z. B. kein Ausstellungsdatum aus dem Ablaufdatum berechnen). Fehlt eine Angabe, setze value auf null.
- legible = false, wenn eine Angabe nur teilweise oder unscharf zu lesen ist.
- Verwechsle nicht: Die Dokumentnummer ist nicht die sechsstellige Zugangsnummer (CAN) deutscher Personalausweise neben dem Ablaufdatum; der Geburtsort ist nicht die ausstellende Behörde; das Ablaufdatum ist nicht das Ausstellungsdatum.
- Bei deutschen Personalausweisen stehen Behörde und Ausstellungsdatum auf der Rückseite.
- Namen in lateinischer Schrift; gibt es eine maschinenlesbare Zone, nimm deren Schreibweise als Vorlage, aber mit Umlauten wie im Klartext.
- Gibt es eine maschinenlesbare Zone (Zeilen mit <<<), gib sie wörtlich und vollständig in mrz_lines wieder.
- Zeigt kein Bild ein Reisedokument, setze document_detected auf false.`

function client(): AnthropicBedrockMantle | null {
  const awsAccessKey = process.env.BEDROCK_ACCESS_KEY_ID
  const awsSecretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY
  const awsRegion = process.env.BEDROCK_REGION
  if (!awsAccessKey || !awsSecretAccessKey || !awsRegion || !process.env.BEDROCK_MODEL) return null
  // apiKey: null → kein Rückgriff auf AWS_BEARER_TOKEN_BEDROCK aus der Umgebung
  return new AnthropicBedrockMantle({ awsRegion, awsAccessKey, awsSecretAccessKey, apiKey: null, maxRetries: 0, timeout: TIMEOUT_MS })
}

export const readerConfigured = () => client() !== null

// today: JJJJ-MM-TT (Wien) für die Datumsprüfung
export async function readIdDocument(images: IdImage[], today: string): Promise<ReaderOutcome> {
  const anthropic = client()
  if (!anthropic) return { ok: false, reason: 'notConfigured', usage: null }
  const model = process.env.BEDROCK_MODEL!

  let response
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: MODEL_ANSWER_JSON_SCHEMA as unknown as Record<string, unknown> } },
      messages: [
        {
          role: 'user',
          content: [
            ...images.flatMap((img) => [
              { type: 'text' as const, text: img.side === 'front' ? 'Vorderseite:' : 'Rückseite:' },
              { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: img.jpeg.toString('base64') } },
            ]),
            { type: 'text', text: 'Lies die Angaben dieses Reisedokuments aus.' },
          ],
        },
      ],
    })
  } catch (e) {
    if (e instanceof AnthropicBedrockMantle.APIConnectionTimeoutError) return { ok: false, reason: 'failed', usage: null }
    if (e instanceof AnthropicBedrockMantle.APIConnectionError) return { ok: false, reason: 'unreachable', usage: null }
    if (e instanceof AnthropicBedrockMantle.APIError) {
      console.error('[ausweis] Bedrock-Fehler', e.status, e.message)
      // 400: Anfrage abgelehnt (z. B. Bild unbrauchbar) – der Dienst wurde erreicht; sonst Zugang/Modell/Dienst gestört
      return e.status === 400 ? { ok: false, reason: 'failed', usage: null } : { ok: false, reason: 'unreachable', usage: null }
    }
    console.error('[ausweis] Unerwarteter Fehler', e)
    return { ok: false, reason: 'unreachable', usage: null }
  }

  const usage: Usage = { model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
  if (response.stop_reason === 'refusal') return { ok: false, reason: 'noDocument', usage }
  const textBlock = response.content.find((b) => b.type === 'text')
  let parsed
  try {
    parsed = modelAnswerSchema.safeParse(textBlock && textBlock.type === 'text' ? JSON.parse(textBlock.text) : null)
  } catch {
    return { ok: false, reason: 'failed', usage }
  }
  if (!parsed.success) {
    console.error('[ausweis] Antwort passt nicht zum Schema', response.stop_reason)
    return { ok: false, reason: 'failed', usage }
  }
  if (!parsed.data.document_detected) return { ok: false, reason: 'noDocument', usage }
  return { ok: true, read: normalizeModelAnswer(parsed.data, today), usage }
}
