import { redirect } from 'next/navigation'

// /einstellungen öffnet den ersten Reiter
export default function SettingsPage() {
  redirect('/einstellungen/team')
}
