'use client'

import { Toaster } from '@/components/ui/sonner'

// Hinweis-Meldungen wie im Entwurf: dunkle Leiste unten mittig; wird von Screenreadern vorgelesen (Sonner, aria-live)
export function AppToaster() {
  return (
    <Toaster
      theme="light"
      position="bottom-center"
      closeButton
      containerAriaLabel="Benachrichtigungen"
      duration={4000}
      offset={88}
      mobileOffset={{ bottom: 88 }}
      toastOptions={{
        classNames: {
          toast: 'group toast !bg-ds-neutral-900 !text-ds-neutral-100 !border-0 !shadow-md !rounded-lg !text-sm',
          description: '!text-ds-neutral-300',
          icon: '!text-ds-accent-300',
          closeButton: '!bg-ds-neutral-800 !text-ds-neutral-100 !border-0',
          actionButton: '!bg-primary !text-primary-foreground',
        },
      }}
    />
  )
}
