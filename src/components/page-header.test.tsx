import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { KpiGrid, KpiTile } from './kpi-tile'
import { PageHeader } from './page-header'

describe('Seitenkopf und Kennzahl-Kachel', () => {
  it('Seitenkopf zeigt Überzeile, Überschrift, Untertitel und Hauptaktion', () => {
    render(
      <PageHeader
        eyebrow="Montag, 5. Oktober 2026"
        title="Guten Morgen, Johanna."
        lead="Heute reisen 3 Gäste an."
        action={<button>Neue Buchung</button>}
      />
    )
    expect(screen.getByText('Montag, 5. Oktober 2026')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Guten Morgen, Johanna.' })).toBeInTheDocument()
    expect(screen.getByText('Heute reisen 3 Gäste an.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Neue Buchung' })).toBeInTheDocument()
  })

  it('Kennzahl-Kacheln als Beschreibungsliste (Beschriftung → Wert)', () => {
    render(
      <KpiGrid label="Kennzahlen">
        <KpiTile label="Umsatz Oktober" value="€ 17.480" sub="anteilig, alle Kanäle" />
      </KpiGrid>
    )
    expect(screen.getByRole('term')).toHaveTextContent('Umsatz Oktober')
    expect(screen.getAllByRole('definition')[0]).toHaveTextContent('€ 17.480')
  })
})
