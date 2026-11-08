import { requireAppUser } from '@/lib/auth/session'

// Vollbild-Seiten ohne App-Menü (PROJ-26: Gästeblatt am Tablet). Gleiche Sitzungsprüfung wie der App-Rahmen.
export default async function FullscreenLayout({ children }: { children: React.ReactNode }) {
  await requireAppUser()
  return <main className="min-h-dvh bg-ds-bg">{children}</main>
}
