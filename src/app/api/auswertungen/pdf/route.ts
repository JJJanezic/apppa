import { statsPdfResponse } from '@/lib/statistics-export'

// Auswertung als PDF (PROJ-18): ?jahr=&von=&bis=&objekt=&wohnung= wie die Seite; nur Inhaber des gewählten Kunden
export const GET = (request: Request) => statsPdfResponse(request)
