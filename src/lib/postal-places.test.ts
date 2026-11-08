import { describe, expect, it } from 'vitest'

import { canAutofill, cleanPlaceNames, loadPostalPlaces, parsePostalCode, planAutofill, postalLookup } from '@/lib/postal-places'

describe('parsePostalCode', () => {
  it('erkennt vier- und fünfstellige PLZ', () => {
    expect(parsePostalCode('6020')).toEqual({ digits: '6020', prefix: null })
    expect(parsePostalCode('80331')).toEqual({ digits: '80331', prefix: null })
  })

  it('ignoriert Präfixe und Leerzeichen', () => {
    expect(parsePostalCode('A-6020')).toEqual({ digits: '6020', prefix: 'AT' })
    expect(parsePostalCode('A 6020')).toEqual({ digits: '6020', prefix: 'AT' })
    expect(parsePostalCode('at-6020')).toEqual({ digits: '6020', prefix: 'AT' })
    expect(parsePostalCode('D-80331')).toEqual({ digits: '80331', prefix: 'DE' })
    expect(parsePostalCode('DE 80331')).toEqual({ digits: '80331', prefix: 'DE' })
    expect(parsePostalCode(' 60 20 ')).toEqual({ digits: '6020', prefix: null })
  })

  it('lehnt unvollständige, zu lange und gemischte Eingaben ab', () => {
    for (const input of ['', '602', '602011', '6020a', 'CH-8001', 'A--6020', 'X6020']) expect(parsePostalCode(input)).toBeNull()
  })
})

describe('postalLookup', () => {
  it('leitet das Land aus der Stellenzahl ab, wenn es leer ist', () => {
    expect(postalLookup('6020', '', null)).toEqual({ country: 'AT', code: '6020' })
    expect(postalLookup('80331', '', null)).toEqual({ country: 'DE', code: '80331' })
  })

  it('schlägt bei gewähltem AT/DE nur in dessen Liste nach', () => {
    expect(postalLookup('6020', 'AT', null)).toEqual({ country: 'AT', code: '6020' })
    expect(postalLookup('80331', 'AT', null)).toBeNull()
    expect(postalLookup('6020', 'DE', null)).toBeNull()
  })

  it('macht bei anderem Land nichts', () => {
    expect(postalLookup('8001', 'CH', null)).toBeNull()
    expect(postalLookup('00100', 'IT', null)).toBeNull()
  })

  it('behandelt ein automatisch gesetztes Land wie ein leeres', () => {
    expect(postalLookup('80331', 'AT', 'AT')).toEqual({ country: 'DE', code: '80331' })
  })

  it('macht nichts, wenn das Präfix nicht zur Stellenzahl passt', () => {
    expect(postalLookup('D-6020', '', null)).toBeNull()
    expect(postalLookup('A-80331', '', null)).toBeNull()
  })
})

describe('canAutofill', () => {
  it('erlaubt leere und unverändert automatisch befüllte Felder', () => {
    expect(canAutofill('', null)).toBe(true)
    expect(canAutofill('Innsbruck', 'Innsbruck')).toBe(true)
    expect(canAutofill('Innsbruck', null)).toBe(false)
    expect(canAutofill('Innsbruck-Land', 'Innsbruck')).toBe(false)
  })
})

describe('planAutofill', () => {
  const none = { city: null, country: null }

  it('befüllt leeren Ort und leeres Land', () => {
    expect(planAutofill({ city: '', country: '' }, none, 'AT', ['Innsbruck'])).toEqual({
      values: { city: 'Innsbruck', country: 'AT' },
      auto: { city: 'Innsbruck', country: 'AT' },
      choices: [],
    })
  })

  it('lässt von Hand eingetragene Werte stehen', () => {
    const plan = planAutofill({ city: 'Hötting', country: 'AT' }, none, 'AT', ['Innsbruck'])
    expect(plan.values).toEqual({ city: 'Hötting', country: 'AT' })
    expect(plan.auto).toEqual(none)
  })

  it('ersetzt automatisch befüllte Werte bei geänderter PLZ', () => {
    const plan = planAutofill({ city: 'Innsbruck', country: 'AT' }, { city: 'Innsbruck', country: 'AT' }, 'DE', ['München'])
    expect(plan.values).toEqual({ city: 'München', country: 'DE' })
  })

  it('zeigt bei mehreren Orten die Auswahl und leert einen automatisch gesetzten Ort', () => {
    const plan = planAutofill({ city: 'München', country: 'DE' }, { city: 'München', country: 'DE' }, 'DE', ['Arnis', 'Kappeln'])
    expect(plan).toEqual({ values: { city: '', country: 'DE' }, auto: { city: null, country: 'DE' }, choices: ['Arnis', 'Kappeln'] })
  })

  it('zeigt keine Auswahl bei von Hand eingetragenem Ort, befüllt aber das leere Land', () => {
    const plan = planAutofill({ city: 'Arnis', country: '' }, none, 'DE', ['Arnis', 'Kappeln'])
    expect(plan).toEqual({ values: { city: 'Arnis', country: 'DE' }, auto: { city: null, country: 'DE' }, choices: [] })
  })

  it('ändert nichts bei unbekannter PLZ', () => {
    const plan = planAutofill({ city: 'Innsbruck', country: 'AT' }, { city: 'Innsbruck', country: 'AT' }, 'AT', [])
    expect(plan).toEqual({ values: { city: 'Innsbruck', country: 'AT' }, auto: { city: 'Innsbruck', country: 'AT' }, choices: [] })
  })
})

describe('cleanPlaceNames', () => {
  it('entfernt Doppelte, Firmen und Ortsteile neben dem Hauptort', () => {
    expect(cleanPlaceNames(['Hamburg Altstadt', 'Hamburg', 'Hamburg', 'BMW AG', 'Muster GmbH & Co KG'])).toEqual(['Hamburg'])
  })

  it('behält Ortsteile ohne Hauptort und sortiert deutsch', () => {
    expect(cleanPlaceNames(['Zettingen', 'Düngenheim', 'Brachtendorf'])).toEqual(['Brachtendorf', 'Düngenheim', 'Zettingen'])
    expect(cleanPlaceNames(['Norden Norddeich'])).toEqual(['Norden Norddeich'])
  })
})

describe('loadPostalPlaces', () => {
  it('liefert die Postorte der mitgelieferten Listen', async () => {
    const at = await loadPostalPlaces('AT')
    const de = await loadPostalPlaces('DE')
    expect(at?.['6020']).toEqual(['Innsbruck'])
    expect(at?.['6094']).toEqual(['Axams'])
    expect(de?.['80331']).toEqual(['München'])
    expect(de?.['20095']).toEqual(['Hamburg'])
    expect(de?.['80788']).toBeUndefined()
    expect(de?.['56761']?.length).toBeGreaterThan(1)
  })
})
