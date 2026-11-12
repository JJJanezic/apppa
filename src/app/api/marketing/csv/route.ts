import { marketingCsvResponse } from '@/lib/marketing-export'

// Gäste für Marketing als CSV (PROJ-52): ?von=&bis=&aufenthalte=&objekt=&wohnung=&quelle=&land=&sprache=&erreichbar=&segment=
// wie die Seite; nur Inhaber des gewählten Kunden; jeder Abruf wird protokolliert
export const GET = (request: Request) => marketingCsvResponse(request)
