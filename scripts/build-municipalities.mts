// Erzeugt die Daten-Migration der österreichischen Gemeinden (PROJ-6) aus der Gemeindeliste von Statistik Austria.
//
// Aufruf (Runbook Abschnitt 13):
//   npx tsx scripts/build-municipalities.mts <gemliste_knz.csv> <ziel.sql>
//
// Quelle: https://www.statistik.at/verzeichnis/reglisten/gemliste_knz.csv – CC BY 4.0,
// „Datenquelle: Statistik Austria — data.statistik.gv.at“. Die Datei wird streng geprüft: Nur Zeilen mit
// fünfstelliger Gemeindekennziffer und vierstelligen PLZ werden übernommen, alles andere bricht ab.
import { readFileSync, writeFileSync } from 'node:fs'

import { municipalitySearchKey, stateOfMunicipality } from '../src/lib/apartments.ts'

const [source, target] = process.argv.slice(2)
if (!source || !target) {
  console.error('Aufruf: npx tsx scripts/build-municipalities.mts <gemliste_knz.csv> <ziel.sql>')
  process.exit(1)
}

const text = readFileSync(source, 'utf8')
const stand = /Gebietsstand (\d{4})/.exec(text)?.[1]
if (!stand) throw new Error('Gebietsstand nicht gefunden – ist das die Gemeindeliste sortiert nach Kennziffer?')

type Row = { name: string; postalCodes: Set<string> }
const municipalities = new Map<string, Row>()

for (const line of text.split(/\r?\n/)) {
  if (!/^\d{5};/.test(line)) continue
  const [code, name, , , mainPostalCode = '', morePostalCodes = ''] = line.split(';')
  if (!/^[1-9]\d{4}$/.test(code)) throw new Error(`Ungültige Kennziffer: ${line}`)
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 100 || /[<>;"\\]/.test(cleanName)) throw new Error(`Ungültiger Name: ${line}`)
  if (!stateOfMunicipality(code)) throw new Error(`Unbekanntes Bundesland: ${line}`)
  const postalCodes = [mainPostalCode, ...morePostalCodes.split(/\s+/)].map((p) => p.trim()).filter(Boolean)
  for (const p of postalCodes) if (!/^\d{4}$/.test(p)) throw new Error(`Ungültige PLZ „${p}“: ${line}`)

  // Wien steht je Bezirk in der Liste (gleiche Kennziffer) – zu einer Gemeinde zusammenfassen
  const row = municipalities.get(code) ?? { name: cleanName, postalCodes: new Set<string>() }
  if (row.name !== cleanName) throw new Error(`Kennziffer ${code} mit zwei Namen: ${row.name} / ${cleanName}`)
  postalCodes.forEach((p) => row.postalCodes.add(p))
  municipalities.set(code, row)
}

if (municipalities.size < 2000) throw new Error(`Nur ${municipalities.size} Gemeinden gelesen – Datei unvollständig?`)

const sql = (value: string) => `'${value.replaceAll("'", "''")}'`
const codes = [...municipalities.keys()].sort()
const municipalityRows = codes.map((code) => {
  const { name } = municipalities.get(code)!
  return `(${sql(code)}, ${sql(name)}, ${sql(stateOfMunicipality(code)!)}, ${sql(municipalitySearchKey(name))})`
})
const postalRows = codes.flatMap((code) =>
  [...municipalities.get(code)!.postalCodes].sort().map((p) => `(${sql(p)}, ${sql(code)})`)
)

const out = `-- PROJ-6: Österreichische Gemeinden, Gebietsstand ${stand} (${municipalities.size} Gemeinden, ${postalRows.length} PLZ-Zuordnungen)
-- Erzeugt mit scripts/build-municipalities.mts aus supabase/data/statistik-austria/ – nicht von Hand ändern.
-- Datenquelle: Statistik Austria — data.statistik.gv.at (CC BY 4.0)
--
-- Wiederholbar: Gemeinden werden ergänzt bzw. aktualisiert; nicht mehr enthaltene erhalten „gültig bis“
-- (Nachfolger setzt das Runbook). Die PLZ-Zuordnung wird vollständig ersetzt.

insert into public.municipalities (code, name, state, search_key) values
${municipalityRows.join(',\n')}
on conflict (code) do update
  set name = excluded.name, state = excluded.state, search_key = excluded.search_key, valid_until = null;

update public.municipalities
set valid_until = coalesce(valid_until, current_date)
where code not in (${codes.map(sql).join(', ')});

delete from public.municipality_postal_codes;
insert into public.municipality_postal_codes (postal_code, municipality_code) values
${postalRows.join(',\n')};
`

writeFileSync(target, out)
console.log(`${municipalities.size} Gemeinden, ${postalRows.length} PLZ-Zuordnungen → ${target}`)
