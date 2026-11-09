'use client'

import { FilePdf, UploadSimple } from '@phosphor-icons/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { prepareGuestSheetUpload, registerGuestSheetUpload } from '@/app/(app)/gaesteblaetter/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { todayIso } from '@/lib/bookings'
import { GUEST_SHEET_BUCKET, GUEST_SHEET_PDF_MAX_BYTES } from '@/lib/guest-sheet'
import { createClient } from '@/lib/supabase/client'
import { sheetUploadSchema, type SheetUploadInput } from '@/lib/validation/guest-sheet'

interface GuestSheetUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  previousSheetId: string | null
  sheetNumber: string | null
  canConsent: boolean
}

type FileError = 'pdfInvalid' | 'pdfTooLarge' | 'uploadFailed' | 'fileMissing'

const isPdf = (f: File) => f.type === 'application/pdf' || ((f.type === '' || f.type === 'application/octet-stream') && /\.pdf$/i.test(f.name))

// „Gästeblatt hochladen“ (PROJ-26): altes Papier-Gästeblatt als PDF (bis 10 MB) mit „Unterschrieben am“ und
// Marketing-Häkchen; die Lfd.-Nr. kommt aus der Buchung (nur lesen). Die Datei geht erst beim Speichern in den Speicher; Pflichtfelder an Gast oder Buchung prüft niemand.
export function GuestSheetUploadDialog({ open, onOpenChange, bookingId, previousSheetId, sheetNumber, canConsent }: GuestSheetUploadDialogProps) {
  const t = useTranslations('guestSheets.upload')
  const tv = useTranslations('guestSheets.validation')
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<FileError | null>(null)
  const [error, setError] = useState<string | null>(null)
  const schema = useMemo(() => sheetUploadSchema(tv), [tv])
  const form = useForm<SheetUploadInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: { signedOn: '', marketingConsent: false },
  })

  function choose(f: File) {
    setFileError(null)
    if (!isPdf(f)) return setFileError('pdfInvalid')
    if (f.size > GUEST_SHEET_PDF_MAX_BYTES) return setFileError('pdfTooLarge')
    setFile(f)
  }

  async function save(values: SheetUploadInput) {
    setError(null)
    if (!file) return setFileError('fileMissing')
    const prepared = await callAction(() => prepareGuestSheetUpload())
    if (!prepared.ok || !prepared.data) return setError(prepared.ok ? 'unknown' : prepared.error)
    const { error: uploadError } = await createClient()
      .storage.from(GUEST_SHEET_BUCKET)
      .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: 'application/pdf' })
    if (uploadError) return setFileError('uploadFailed')
    const result = await callAction(() => registerGuestSheetUpload({ bookingId, path: prepared.data!.path, values, previousSheetId }))
    if (!result.ok) return setError(result.error)
    toast.success(t('saved'))
    onOpenChange(false)
    setFile(null)
    form.reset()
    router.refresh()
  }

  const submitting = form.formState.isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('text')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(save)} noValidate className="flex flex-col gap-4">
            <FormError error={error} namespace="guestSheets.errors" />
            <div className="flex flex-col gap-2">
              <span id="gaesteblatt-datei" className="text-sm font-medium leading-none">
                {t('file')}
              </span>
              <input
                ref={input}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) choose(f)
                }}
              />
              {file && (
                <p className="flex min-w-0 items-center gap-2 rounded-lg bg-ds-surface px-3 py-2">
                  <FilePdf size={20} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 break-words">{file.name}</span>
                </p>
              )}
              <Button type="button" variant="outline" className="min-h-11 w-fit" aria-describedby="gaesteblatt-datei" onClick={() => input.current?.click()}>
                <UploadSimple size={18} aria-hidden="true" />
                {file ? t('replaceFile') : t('chooseFile')}
              </Button>
              <p className="text-[13px] text-ds-neutral-800">{t('fileHint')}</p>
              {fileError && (
                <p role="alert" className="text-sm text-destructive">
                  {t(`fileErrors.${fileError}`)}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Lfd.-Nr. aus der Buchung, nur lesen (Erweiterung 2026-11-09): nacherfasst wird sie im Buchungsformular */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium leading-none">{t('sheetNumber')}</span>
                <p className="flex min-h-11 items-center break-words font-semibold">{sheetNumber ?? t('noNumber')}</p>
                {!sheetNumber && <p className="text-[13px] text-ds-neutral-800">{t('noNumberHint')}</p>}
              </div>
              <FormField
                control={form.control}
                name="signedOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('signedOn')}</FormLabel>
                    <FormControl>
                      <Input type="date" max={todayIso()} className="min-h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="marketingConsent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0">
                  <FormControl>
                    <Checkbox className="mt-1 size-5" checked={field.value} disabled={!canConsent} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <div className="flex flex-col gap-1">
                    <FormLabel className="font-normal">{t('marketing')}</FormLabel>
                    <FormDescription>{canConsent ? t('marketingHint') : t('marketingNoGuest')}</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitting} aria-busy={submitting} className="min-h-11">
                {submitting ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
