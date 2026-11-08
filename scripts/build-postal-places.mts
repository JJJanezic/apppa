// Erzeugt die Ortslisten für „Ort und Staat aus der PLZ“ (PROJ-48).
//
// Aufruf (Runbook Abschnitt 16):
//   npx tsx scripts/build-postal-places.mts supabase/data/rtr/plz.json supabase/data/geonames/DE.txt src/lib/postal-places-data
//
// Quellen: RTR-PLZ-Verzeichnis (CC BY 3.0 AT) und GeoNames-Postleitzahlen DE (CC BY 4.0), siehe README im jeweiligen Ordner.
// Die Dateien werden streng geprüft: ungültige PLZ oder Namen und zu kurze Listen brechen ab.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanPlaceNames } from '../src/lib/postal-places.ts'

const [rtrFile, geonamesFile, targetDir] = process.argv.slice(2)
if (!rtrFile || !geonamesFile || !targetDir) {
  console.error('Aufruf: npx tsx scripts/build-postal-places.mts <rtr plz.json> <geonames DE.txt> <zielordner>')
  process.exit(1)
}

function checkName(name: string, line: string) {
  if (!name || name.length > 100 || /[<>;"\\]/.test(name)) throw new Error(`Ungültiger Ortsname: ${line}`)
}

function write(file: string, places: Map<string, string[]>) {
  const sorted = Object.fromEntries([...places.entries()].sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(join(targetDir, file), `${JSON.stringify(sorted)}\n`)
}

// Österreich: nur gültige PLZ mit Adressierung
type RtrRow = { plz: number | string; ort: string; gueltigbis: string | null; adressierbar: string }
const rtr = JSON.parse(readFileSync(rtrFile, 'utf8')) as { data?: RtrRow[]; version?: { published?: string } }
if (!Array.isArray(rtr.data)) throw new Error('Kein Feld „data“ – ist das das PLZ-Verzeichnis der RTR?')
const at = new Map<string, string[]>()
for (const row of rtr.data) {
  if (row.gueltigbis || row.adressierbar !== 'Ja') continue
  const code = String(row.plz)
  const name = String(row.ort ?? '').trim()
  if (!/^[1-9]\d{3}$/.test(code)) throw new Error(`Ungültige PLZ: ${JSON.stringify(row)}`)
  checkName(name, JSON.stringify(row))
  at.set(code, [...(at.get(code) ?? []), name])
}
for (const [code, names] of at) at.set(code, cleanPlaceNames(names))
if (at.size < 2000) throw new Error(`Nur ${at.size} österreichische PLZ gelesen – Datei unvollständig?`)

// Deutschland: GeoNames, Spalten Land, PLZ, Ort, … Genauigkeit (Tabulator). Großkunden- und Postfach-Einträge
// (Behörden, Banken, Firmen mit eigener PLZ) haben keine Genauigkeitsangabe und entfallen.
const de = new Map<string, string[]>()
for (const line of readFileSync(geonamesFile, 'utf8').split(/\r?\n/)) {
  if (!line) continue
  const columns = line.split('\t')
  const [country, code, rawName = ''] = columns
  const name = rawName.trim()
  if (country !== 'DE' || !/^\d{5}$/.test(code) || columns.length !== 12) throw new Error(`Ungültige Zeile: ${line}`)
  if (!columns[11].trim()) continue
  checkName(name, line)
  de.set(code, [...(de.get(code) ?? []), name])
}
for (const [code, names] of de) {
  const clean = cleanPlaceNames(names)
  if (clean.length) de.set(code, clean)
  else de.delete(code)
}
if (de.size < 8000) throw new Error(`Nur ${de.size} deutsche PLZ gelesen – Datei unvollständig?`)

write('at.json', at)
write('de.json', de)
const multi = (m: Map<string, string[]>) => [...m.values()].filter((v) => v.length > 1).length
console.log(`AT: ${at.size} PLZ (${multi(at)} mit mehreren Orten), DE: ${de.size} PLZ (${multi(de)} mit mehreren Orten) → ${targetDir}`)
