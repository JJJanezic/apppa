'use client'

import { Buildings, HouseLine, PencilSimple, Plus } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ApartmentPanel } from '@/components/apartments/apartment-panel'
import { PropertyPanel } from '@/components/apartments/property-panel'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type Apartment, type Property, visibleProperties } from '@/lib/apartments'
import { formatCents } from '@/lib/format'

type Panel =
  | { kind: 'create'; presetPropertyId?: string }
  | { kind: 'apartment'; apartment: Apartment }
  | { kind: 'property'; property: Property }
  | null

// „Einstellungen → Wohnungen“ (PROJ-6): Wohnungen gruppiert nach Objekt; ab 768 px Tabelle, darunter Karten
export function ApartmentsOverview({ properties }: { properties: Property[] }) {
  const t = useTranslations('apartments')
  const [showArchived, setShowArchived] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  // Neuer Schlüssel je Öffnen: Formular startet mit frischen Werten
  const [panelKey, setPanelKey] = useState(0)
  const open = (next: Panel) => {
    setPanelKey((k) => k + 1)
    setPanel(next)
  }
  const close = (isOpen: boolean) => !isOpen && setPanel(null)

  const visible = visibleProperties(properties, showArchived)
  const hasArchived = properties.some((p) => p.apartments.some((a) => a.archivedAt))
  const euro = formatCents
  // Preis-Konfiguration (PROJ-27): Wohnungspreis pro Nacht oder Erwachsenenpreis pro Person und Nacht
  const configuredCents = (a: Apartment) => (a.priceMode === 'person' ? a.adultPriceCents : a.priceCents)
  const price = (a: Apartment) => {
    const cents = configuredCents(a)
    if (cents === null) return t('noPrice')
    return a.priceMode === 'person' ? t('perAdultShort', { price: euro(cents) }) : euro(cents)
  }
  const archivedBadge = (a: Apartment) =>
    a.archivedAt ? (
      <Badge variant="secondary" className="font-normal">
        {t('archived')}
      </Badge>
    ) : null
  // Tabelle: nur der Name ist der Knopf (Safari kann Klickflächen über die ganze Zeile nicht an <tr> verankern);
  // Karten auf dem Handy: Klickfläche über die ganze Karte (<li> ist ein gültiger Bezug)
  const nameButton = (a: Apartment, whole = false) => (
    <button
      type="button"
      onClick={() => open({ kind: 'apartment', apartment: a })}
      aria-label={t('openApartment', { name: a.name })}
      className={
        whole
          ? "text-left font-medium underline-offset-[3px] hover:underline after:absolute after:inset-0 after:content-['']"
          : 'text-left font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2'
      }
    >
      {a.name}
    </button>
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button className="min-h-11" onClick={() => open({ kind: 'create' })}>
          <Plus size={18} weight="bold" aria-hidden="true" />
          {t('create')}
        </Button>
        {hasArchived && (
          <div className="flex min-h-11 items-center gap-2">
            <Switch id="archivierte" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="archivierte" className="cursor-pointer font-normal">
              {t('showArchived')}
            </Label>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={HouseLine}
          title={t('emptyTitle')}
          text={hasArchived ? t('emptyArchivedText') : t('emptyText')}
        />
      ) : (
        visible.map((property) => (
          <section key={property.id} className="flex flex-col gap-3" aria-labelledby={`objekt-${property.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <Buildings size={22} weight="duotone" aria-hidden="true" className="mt-1 shrink-0 text-ds-accent-700" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 id={`objekt-${property.id}`} className="break-words text-2xl">
                    {property.name}
                  </h2>
                  <p className="text-sm text-ds-neutral-800">
                    {property.street}, {property.postalCode} {property.city}
                  </p>
                  <p className="text-[13px] text-ds-neutral-700">
                    {t('municipalityLine', { name: property.municipality.name, state: t(`state.${property.municipality.state}`) })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={t('editPropertyFor', { name: property.name })}
                title={t('editProperty')}
                onClick={() => open({ kind: 'property', property: properties.find((p) => p.id === property.id) ?? property })}
              >
                <PencilSimple size={20} weight="bold" aria-hidden="true" />
              </Button>
            </div>

            {property.apartments.length > 0 && (
              <>
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('colName')}</TableHead>
                      <TableHead>{t('colKind')}</TableHead>
                      <TableHead className="text-right">{t('colGuests')}</TableHead>
                      <TableHead className="text-right">{t('colPrice')}</TableHead>
                      <TableHead>{t('colTimes')}</TableHead>
                      <TableHead>
                        <span className="sr-only">{t('colStatus')}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {property.apartments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{nameButton(a)}</TableCell>
                        <TableCell>{t(`kind.${a.kind}`)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.maxGuests}
                          {a.maxAdults !== null && (
                            <span className="block text-[13px] text-ds-neutral-700">{t('adultsLimitShort', { count: a.maxAdults })}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{price(a)}</TableCell>
                        <TableCell className="tabular-nums">{t('times', { checkIn: a.checkIn, checkOut: a.checkOut })}</TableCell>
                        <TableCell>{archivedBadge(a)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <ul className="flex flex-col gap-3 md:hidden">
                  {property.apartments.map((a) => (
                    <li key={a.id} className="relative flex flex-col gap-1 rounded-lg bg-ds-surface p-4">
                      <span className="flex items-start justify-between gap-2">
                        {nameButton(a, true)}
                        {archivedBadge(a)}
                      </span>
                      <span className="text-sm text-ds-neutral-800">
                        {t(`kind.${a.kind}`)} · {t('guests', { count: a.maxGuests })}
                        {a.maxAdults !== null && <>, {t('adultsLimit', { count: a.maxAdults })}</>}
                      </span>
                      <span className="text-[13px] text-ds-neutral-700 tabular-nums">
                        {configuredCents(a) !== null && (
                          <>
                            {a.priceMode === 'person'
                              ? t('perAdult', { price: euro(configuredCents(a)!) })
                              : t('perNight', { price: euro(configuredCents(a)!) })}{' '}
                            ·{' '}
                          </>
                        )}
                        {t('times', { checkIn: a.checkIn, checkOut: a.checkOut })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Button
              variant="ghost"
              className="h-auto min-h-11 w-fit whitespace-normal py-2 text-left text-ds-accent-700"
              onClick={() => open({ kind: 'create', presetPropertyId: property.id })}
            >
              <Plus size={16} weight="bold" aria-hidden="true" />
              {t('addToProperty', { name: property.name })}
            </Button>
          </section>
        ))
      )}

      {(panel?.kind === 'create' || panel?.kind === 'apartment') && (
        <ApartmentPanel
          key={panelKey}
          open
          onOpenChange={close}
          properties={properties}
          apartment={panel.kind === 'apartment' ? panel.apartment : null}
          presetPropertyId={panel.kind === 'create' ? panel.presetPropertyId : undefined}
        />
      )}
      {panel?.kind === 'property' && <PropertyPanel key={panelKey} open onOpenChange={close} property={panel.property} />}
    </div>
  )
}
