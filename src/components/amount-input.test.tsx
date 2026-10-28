import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { AmountInput } from './amount-input'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <AmountInput aria-label="Betrag" value={value} onValueChange={setValue} />
}

const field = () => screen.getByLabelText('Betrag') as HTMLInputElement
const typeAndLeave = (text: string) => {
  fireEvent.change(field(), { target: { value: text } })
  fireEvent.blur(field())
}

describe('Betragsfeld (PROJ-31)', () => {
  it.each([
    ['1250', '1.250,00'],
    ['45,5', '45,50'],
    ['125.5', '125,50'],
    ['1.250,5', '1.250,50'],
    ['0', '0,00'],
  ])('„%s“ wird beim Verlassen zu „%s“', (input, expected) => {
    render(<Harness />)
    typeAndLeave(input)
    expect(field().value).toBe(expected)
  })

  it('schreibt während des Tippens nichts um', () => {
    render(<Harness />)
    fireEvent.change(field(), { target: { value: '12' } })
    expect(field().value).toBe('12')
  })

  it('lässt ungültige und leere Eingaben stehen', () => {
    render(<Harness />)
    typeAndLeave('abc')
    expect(field().value).toBe('abc')
    typeAndLeave('')
    expect(field().value).toBe('')
  })
})
