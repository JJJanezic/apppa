import 'server-only'

// Hinweis-Mails, die Supabase nicht verschickt (PROJ-4: „Du wurdest eingeladen“ an bestehende Konten).
// Versand über die Brevo-Schnittstelle. Ohne BREVO_API_KEY wird nichts verschickt (die Einladung erscheint
// trotzdem in der App). Absender domainunabhängig über BREVO_SENDER_EMAIL (Standard: no-reply@apppa.at).

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export type InvitationNotice = {
  to: string
  tenantName: string
  inviterName: string | null
  roleLabel: string
  appUrl: string
}

export function invitationNoticeHtml(n: InvitationNotice): string {
  const who = n.inviterName ? `${escape(n.inviterName)} hat dich` : 'Du wurdest'
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.55; color: #201e1d; max-width: 560px;">
  <p style="font-size: 22px; font-weight: bold; margin: 0 0 24px;">apppa.</p>
  <h2 style="font-size: 20px; margin: 0 0 16px;">Einladung zu „${escape(n.tenantName)}“</h2>
  <p>Hallo,</p>
  <p>${who} als ${escape(n.roleLabel)} zu „${escape(n.tenantName)}“ in apppa eingeladen.</p>
  <p>Melde dich an und nimm die Einladung auf dem Dashboard an. Sie gilt 14 Tage.</p>
  <p style="margin: 24px 0;"><a href="${escape(n.appUrl)}/anmelden" style="background: #006786; color: #ffffff; padding: 12px 20px; border-radius: 4px; text-decoration: none; display: inline-block;">Zu apppa</a></p>
  <p style="color: #605d5d; font-size: 13px;">Du kennst diese Person nicht? Dann lehne die Einladung einfach ab oder ignoriere diese E-Mail.</p>
</div>`
}

// true = an Brevo übergeben; false = nicht verschickt (kein Schlüssel oder Fehler, wird protokolliert)
export async function sendInvitationNotice(notice: InvitationNotice): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    console.warn('[mail] BREVO_API_KEY fehlt – Hinweis-Mail nicht verschickt')
    return false
  }
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'apppa', email: process.env.BREVO_SENDER_EMAIL || 'no-reply@apppa.at' },
        to: [{ email: notice.to }],
        subject: `Einladung zu „${notice.tenantName}“ in apppa`,
        htmlContent: invitationNoticeHtml(notice),
      }),
    })
    if (!res.ok) console.error('[mail] Brevo antwortet', res.status)
    return res.ok
  } catch (error) {
    console.error('[mail] Brevo nicht erreichbar', error instanceof Error ? error.message : error)
    return false
  }
}
