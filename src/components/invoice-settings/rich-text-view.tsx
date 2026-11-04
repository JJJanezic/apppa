import { Fragment } from 'react'

import { richTextStyle } from '@/components/invoice-settings/rich-text-fonts'
import { fillPlaceholders, type PlaceholderValues } from '@/lib/invoice-texts'
import type { RichDoc, RichInline, RichParagraph } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

// Formatierter Rechnungstext als HTML-Ausgabe aus der gespeicherten Struktur (PROJ-39), optional mit gefüllten
// Platzhaltern. Ein Platzhalter, der mitten in einer Formatierung beginnt („{Woh**nung**}“), bleibt stehen.

function Inline({ node, values }: { node: RichInline; values?: PlaceholderValues }) {
  if (node.type === 'hardBreak') return <br />
  let content: React.ReactNode = values ? fillPlaceholders(node.text, values) : node.text
  const marks = node.marks ?? []
  if (marks.some((m) => m.type === 'italic')) content = <em>{content}</em>
  if (marks.some((m) => m.type === 'bold')) content = <strong>{content}</strong>
  return content
}

function Paragraph({ p, values }: { p: RichParagraph; values?: PlaceholderValues }) {
  return (
    <p className="min-h-[1lh]">
      {(p.content ?? []).map((n, i) => (
        <Inline key={i} node={n} values={values} />
      ))}
    </p>
  )
}

export function RichTextView({ doc, values, className }: { doc: RichDoc; values?: PlaceholderValues; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 break-words', className)} style={richTextStyle(doc.attrs)}>
      {doc.content.map((block, i) => {
        if (block.type === 'paragraph') return <Paragraph key={i} p={block} values={values} />
        const List = block.type === 'bulletList' ? 'ul' : 'ol'
        return (
          <List key={i} className={cn('flex flex-col gap-1 pl-6 text-left', block.type === 'bulletList' ? 'list-disc' : 'list-decimal')}>
            {block.content.map((item, j) => (
              <li key={j}>
                {item.content.map((p, k) => (
                  <Fragment key={k}>
                    <Paragraph p={p} values={values} />
                  </Fragment>
                ))}
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
