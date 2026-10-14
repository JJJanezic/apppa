import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'

import messages from '../../../messages/de.json'
import AppError from './error'

describe('Fehlerzustand im Rahmen', () => {
  it('zeigt eine deutsche Meldung und „Erneut versuchen“ ruft reset auf', () => {
    const reset = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <NextIntlClientProvider locale="de-AT" messages={messages}>
        <AppError error={new Error('kaputt')} reset={reset} />
      </NextIntlClientProvider>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Da ist etwas schiefgelaufen.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
