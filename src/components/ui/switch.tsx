"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

// Bedienfläche 44 × 44 px (Projektregel ≥ 44 px, QA PROJ-38 BUG-1); sichtbar bleibt die Spur mit 44 × 24 px.
// Die negativen Außenabstände halten den Platzbedarf im Layout bei 24 px.
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    // Safari springt in der Grundeinstellung mit der Tabulatortaste nur zwischen Textfeldern; ein ausdrücklicher
    // tabIndex nimmt das Feld in die Reihenfolge auf
    tabIndex={0}
    className={cn(
      "peer group -my-2.5 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
    ref={ref}
  >
    <span
      aria-hidden="true"
      className="pointer-events-none inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent ring-offset-background transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-data-[state=checked]:bg-primary group-data-[state=unchecked]:bg-input"
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </span>
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
