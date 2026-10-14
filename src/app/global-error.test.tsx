import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import GlobalError from './global-error'

describe('Fehlerseite für das oberste Layout (BUG-4)', () => {
  it('ist deutsch und „Erneut versuchen“ ruft reset auf', () => {
    const reset = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // rendert <html>/<body>; in jsdom genügt ein Container im Dokument
    render(<GlobalError error={new Error('kaputt')} reset={reset} />, { container: document.documentElement })
    expect(screen.getByRole('heading', { name: 'Da ist etwas schiefgelaufen.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
