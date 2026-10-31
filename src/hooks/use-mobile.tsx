import * as React from "react"

const MOBILE_BREAKPOINT = 768

// apppa: enabled = false lässt den Wert auf false (ohne Zustandswechsel nach dem Laden)
export function useIsMobile(enabled = true) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (!enabled) return
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [enabled])

  return !!isMobile
}
