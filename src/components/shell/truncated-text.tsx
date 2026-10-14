'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Einzeilig gekürzter Text; der volle Text steht im Tooltip (lange Kunden- oder Personennamen).
// Nicht fokussierbar: sonst öffnet sich der Tooltip, sobald ein Blatt den Fokus auf den Namen setzt.
// Screenreader lesen ohnehin den vollen Text, gekürzt wird nur optisch.
export function TruncatedText({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('block min-w-0 truncate', className)}>
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
