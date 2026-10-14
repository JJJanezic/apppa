import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { DetailPanel } from './detail-panel'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Details öffnen</button>
      <DetailPanel open={open} onOpenChange={setOpen} eyebrow="Booking.com · #B01-26" title="Lukas Brenner">
        <p>Inhalt</p>
      </DetailPanel>
    </>
  )
}

async function openPanel() {
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Details öffnen' })
  trigger.focus()
  fireEvent.click(trigger)
  await screen.findByRole('dialog', { name: 'Lukas Brenner' })
  return trigger
}

describe('DetailPanel', () => {
  it('zeigt Überzeile, Titel und Inhalt', async () => {
    await openPanel()
    expect(screen.getByText('Booking.com · #B01-26')).toBeInTheDocument()
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
  })

  // Die Fokus-Rückgabe lässt sich in jsdom nicht verlässlich prüfen; sie wird im Browser über das
  // gleiche shadcn-Sheet („Mehr“-Blatt) in tests/PROJ-2-app-shell.spec.ts geprüft.
  it('schließt mit Esc', async () => {
    await openPanel()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('schließt über „Schließen“ (deutsch beschriftet)', async () => {
    await openPanel()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Schließen' })))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
