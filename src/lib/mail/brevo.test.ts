// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { invitationNoticeHtml } = await import('./brevo')

describe('Hinweis-Mail Einladung', () => {
  const base = { to: 'a@b.at', tenantName: 'Pichler Ferienwohnungen', inviterName: 'Johanna Pichler', roleLabel: 'Mitarbeiter', appUrl: 'https://app.apppa.at' }

  it('nennt Kunde, einladende Person, Rolle und verlinkt die Anmeldung', () => {
    const html = invitationNoticeHtml(base)
    expect(html).toContain('Johanna Pichler hat dich als Mitarbeiter zu „Pichler Ferienwohnungen“')
    expect(html).toContain('href="https://app.apppa.at/anmelden"')
  })

  it('ohne Namen neutral formuliert', () => {
    expect(invitationNoticeHtml({ ...base, inviterName: null })).toContain('Du wurdest als Mitarbeiter')
  })

  it('maskiert HTML in Namen (kein Einschleusen von Inhalten)', () => {
    const html = invitationNoticeHtml({ ...base, tenantName: '<script>x</script>', inviterName: '<b>X</b>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<b>X</b>')
  })
})
