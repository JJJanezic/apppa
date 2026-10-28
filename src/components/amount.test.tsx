import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Amount } from './amount'

const plain = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ')

describe('Betrag (PROJ-32)', () => {
  it('zeigt negative Beträge mit Minus in Rot', () => {
    const { container } = render(<Amount cents={-5000} />)
    expect(plain(container.textContent)).toBe('-€ 50,00')
    expect(container.firstChild).toHaveClass('text-destructive')
  })

  it.each([0, 5000])('zeigt %s Cent in normaler Schrift', (cents) => {
    const { container } = render(<Amount cents={cents} />)
    expect(container.firstChild).not.toHaveClass('text-destructive')
  })
})
