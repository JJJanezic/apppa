import { taxReportPdfResponse } from '@/lib/tourist-tax-report-export'

// Ortstaxen-Bericht als PDF (PROJ-16): ?jahr=&von=&bis=&gemeinde= wie die Seite; nur Inhaber des gewählten Kunden
export const GET = (request: Request) => taxReportPdfResponse(request)
