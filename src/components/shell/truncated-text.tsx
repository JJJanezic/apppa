'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Einzeilig gekürzter Text; der volle Text steht im Tooltip (lange Kunden- oder Personennamen)
export function TruncatedText({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn('block min-w-0 truncate', className)}>
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
