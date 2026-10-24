'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  text: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
}

// Bestätigung vor folgenreichen Aktionen (Entfernen, Zurückziehen, Austreten …), per Tastatur bedienbar
export function ConfirmDialog({ open, onOpenChange, title, text, confirmLabel, cancelLabel, onConfirm }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="min-h-11">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
