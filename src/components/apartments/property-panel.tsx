'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { deleteProperty, updateProperty } from '@/app/(app)/einstellungen/wohnungen/actions'
import { PropertyFields } from '@/components/apartments/property-fields'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailPanel } from '@/components/detail-panel'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import type { Municipality, Property } from '@/lib/apartments'
import { propertySchema, type PropertyInput } from '@/lib/validation/apartments'

interface PropertyPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  property: Property
}

// Detail-Panel „Objekt bearbeiten“ (PROJ-6): Name, Adresse, Gemeinde gelten für alle Wohnungen des Objekts.
// Löschen nur ohne zugeordnete Wohnungen (auch keine archivierten).
export function PropertyPanel({ open, onOpenChange, property }: PropertyPanelProps) {
  const t = useTranslations('apartments')
  const tv = useTranslations('apartments.validation')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [municipality, setMunicipality] = useState<Municipality | null>(property.municipality)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { run, pending } = useTeamAction('apartments.errors')
  const schema = useMemo(() => propertySchema(tv), [tv])
  const form = useForm<PropertyInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: property.name,
      street: property.street,
      postalCode: property.postalCode,
      city: property.city,
      municipalityCode: property.municipality.code,
    },
  })
  const count = property.apartments.length

  async function onSubmit(values: PropertyInput) {
    setError(null)
    const result = await callAction(() => updateProperty({ id: property.id, ...values }))
    if (!result.ok) {
      if (result.error === 'duplicatePropertyName') form.setError('name', { message: t('errors.duplicatePropertyName') })
      else setError(result.error)
      return
    }
    toast.success(t('done.propertySaved'))
    onOpenChange(false)
    router.refresh()
  }

  async function remove() {
    setConfirmDelete(false)
    if (await run(() => deleteProperty({ id: property.id }), t('done.propertyDeleted', { name: property.name }))) onOpenChange(false)
  }

  return (
    <DetailPanel open={open} onOpenChange={onOpenChange} title={t('propertyPanel.title')} eyebrow={property.name}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <FormError error={error} namespace="apartments.errors" />
          <PropertyFields prefix="" municipality={municipality} onMunicipality={setMunicipality} />
          <p className="text-sm text-ds-neutral-800">{t('propertyPanel.affects', { count })}</p>
          <Button type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting} className="min-h-11">
            {t('panel.save')}
          </Button>
          <div className="flex flex-col items-start gap-2 border-t pt-5">
            {count === 0 ? (
              <Button type="button" variant="ghost" className="min-h-11 text-ds-accent-2-700" disabled={pending} onClick={() => setConfirmDelete(true)}>
                {t('propertyPanel.delete')}
              </Button>
            ) : (
              <p className="text-[13px] text-ds-neutral-700">{t('propertyPanel.deleteBlocked')}</p>
            )}
          </div>
        </form>
      </Form>
      {confirmDelete && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setConfirmDelete(false)}
          title={t('confirm.deletePropertyTitle', { name: property.name })}
          text={t('confirm.deletePropertyText')}
          confirmLabel={t('propertyPanel.delete')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={remove}
        />
      )}
    </DetailPanel>
  )
}
