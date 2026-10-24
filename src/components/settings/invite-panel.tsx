'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { inviteMember } from '@/app/(app)/einstellungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { DetailPanel } from '@/components/detail-panel'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { inviteSchema, type InviteInput, type InviteValues } from '@/lib/validation/team'

// Knopf „Person einladen“ mit Detail-Panel: E-Mail-Adresse und Rolle
export function InvitePanel() {
  const t = useTranslations('team')
  const tv = useTranslations('team.validation')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const schema = useMemo(() => inviteSchema(tv), [tv])
  const form = useForm<InviteInput, unknown, InviteValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'staff' },
  })

  async function onSubmit(values: InviteValues) {
    setError(null)
    const result = await callAction(() => inviteMember(values))
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t('done.invited', { email: values.email }))
    form.reset()
    setOpen(false)
    router.refresh()
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setError(null)
      form.reset()
    }
  }

  return (
    <>
      <Button className="min-h-11" onClick={() => setOpen(true)}>
        <UserPlus size={18} weight="bold" aria-hidden="true" />
        {t('invite')}
      </Button>
      <DetailPanel open={open} onOpenChange={onOpenChange} title={t('invitePanel.title')} description={t('invitePanel.description')}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
            <FormError error={error} namespace="team.errors" />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invitePanel.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" inputMode="email" autoComplete="off" className="min-h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invitePanel.role')}</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-3">
                      {(['staff', 'owner'] as const).map((role) => (
                        <div key={role} className="flex items-start gap-3 rounded-md border p-3">
                          <RadioGroupItem value={role} id={`einladen-${role}`} className="mt-1" />
                          <Label htmlFor={`einladen-${role}`} className="flex cursor-pointer flex-col gap-1 font-normal">
                            <span className="font-semibold">{t(role === 'staff' ? 'invitePanel.roleStaff' : 'invitePanel.roleOwner')}</span>
                            <span className="text-sm text-ds-neutral-800">
                              {t(role === 'staff' ? 'invitePanel.roleStaffHint' : 'invitePanel.roleOwnerHint')}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting} className="min-h-11">
              {t('invitePanel.submit')}
            </Button>
          </form>
        </Form>
      </DetailPanel>
    </>
  )
}
