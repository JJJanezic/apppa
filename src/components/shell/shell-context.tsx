'use client'

import { createContext, useContext } from 'react'

import type { ShellInfo } from '@/lib/shell'

const ShellContext = createContext<ShellInfo | null>(null)

export function ShellProvider({ value, children }: { value: ShellInfo; children: React.ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShell(): ShellInfo {
  const value = useContext(ShellContext)
  if (!value) throw new Error('useShell muss innerhalb von ShellProvider verwendet werden')
  return value
}
