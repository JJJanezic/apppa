import { statsCsvResponse } from '@/lib/statistics-export'

// Auswertung als CSV für Excel (PROJ-18): ?jahr=&von=&bis=&objekt=&wohnung= wie die Seite; nur Inhaber des gewählten Kunden
export const GET = (request: Request) => statsCsvResponse(request)
