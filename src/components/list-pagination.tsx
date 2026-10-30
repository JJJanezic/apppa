import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'

interface ListPaginationProps {
  page: number
  pageCount: number
  // Adresse der Seite n (Filter bleiben erhalten)
  href: (page: number) => string
  labels: { nav: string; previous: string; next: string; pageOf: string }
}

// Blättern in Listen (Rechnungen PROJ-37, Buchungen mit Rechnungsfilter): „Zurück · Seite 1 von 3 · Weiter“
export function ListPagination({ page, pageCount, href, labels }: ListPaginationProps) {
  const step = (n: number, label: string, icon: React.ReactNode, iconFirst: boolean) => {
    const content = iconFirst ? (
      <>
        {icon}
        {label}
      </>
    ) : (
      <>
        {label}
        {icon}
      </>
    )
    return n >= 1 && n <= pageCount ? (
      <Button asChild variant="outline" className="min-h-11">
        <Link href={href(n)}>{content}</Link>
      </Button>
    ) : (
      <Button variant="outline" className="min-h-11" disabled>
        {content}
      </Button>
    )
  }

  return (
    <Pagination aria-label={labels.nav}>
      <PaginationContent className="gap-3">
        <PaginationItem>{step(page - 1, labels.previous, <CaretLeft size={16} aria-hidden="true" />, true)}</PaginationItem>
        <PaginationItem className="text-sm text-ds-neutral-800" aria-current="page">
          {labels.pageOf}
        </PaginationItem>
        <PaginationItem>{step(page + 1, labels.next, <CaretRight size={16} aria-hidden="true" />, false)}</PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
