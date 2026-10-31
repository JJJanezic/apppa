'use client'

import { BracketsCurly, ListBullets, ListNumbers, TextB, TextItalic } from '@phosphor-icons/react'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Toggle } from '@/components/ui/toggle'
import { formatNumber } from '@/lib/format'
import { tablesToBlocks } from '@/lib/paste-html'
import { allowedPlaceholders, PLACEHOLDER_PATTERN, type PlaceholderContext } from '@/lib/invoice-texts'
import { docLength, normalizeDoc, type RichDoc } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

// Beschränkter Editor der Rechnungstexte (PROJ-39): fett, kursiv, Absätze, Zeilenumbruch, Aufzählung und nummerierte
// Liste. Alles andere ist im Editor gar nicht vorhanden; Eingefügtes aus Word, E-Mail oder Webseiten behält deshalb nur
// diese Formate (Links werden Text, Bilder, Farben und Schriftarten fallen weg). Platzhalter sind normaler Text
// „{Wohnung}“ und werden markiert: erlaubte farbig, unbekannte bzw. hier unzulässige rot.
// Wird nur auf den Rechnungs-Einstellungen geladen (next/dynamic in rich-text-field.tsx).

interface RichTextEditorProps {
  value: RichDoc
  onChange: (doc: RichDoc) => void
  // Platzhalter: erlaubte Liste und Markierung; 'fixed' = keine Platzhalter (feste Texte)
  context: PlaceholderContext
  max: number
  labelId: string
  describedBy?: string
  invalid?: boolean
  readOnly?: boolean
}

const placeholderKey = new PluginKey<PlaceholderState>('invoicePlaceholders')

function decorate(doc: PmNode, allowed: Set<string>): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Text des Absatzes samt Umbrüchen; Positionen bleiben 1:1, weil jeder Umbruch genau eine Stelle belegt
    const text = node.textBetween(0, node.content.size, '\n', '\n')
    for (const m of text.matchAll(PLACEHOLDER_PATTERN)) {
      const from = pos + 1 + (m.index ?? 0)
      const ok = allowed.has(m[1])
      decorations.push(
        Decoration.inline(from, from + m[0].length, {
          class: ok
            ? 'rounded-sm bg-ds-accent-100 px-0.5 text-ds-accent-800'
            : 'rounded-sm bg-ds-accent-2-100 px-0.5 text-ds-accent-2-800 underline decoration-wavy',
        })
      )
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

type PlaceholderState = { allowed: Set<string>; decorations: DecorationSet }

// Markierung der Platzhalter. Eine neue erlaubte Liste (z. B. „Anzahlung ja/nein“) kommt als Meta-Angabe einer
// Transaktion, damit die Markierung sofort wechselt.
const PlaceholderMarks = Extension.create<{ allowed: string[] }>({
  name: 'invoicePlaceholders',
  addOptions: () => ({ allowed: [] }),
  addProseMirrorPlugins() {
    const initial = new Set(this.options.allowed)
    return [
      new Plugin<PlaceholderState>({
        key: placeholderKey,
        state: {
          init: (_, state) => ({ allowed: initial, decorations: decorate(state.doc, initial) }),
          apply: (tr, old) => {
            const next = tr.getMeta(placeholderKey) as Set<string> | undefined
            if (next) return { allowed: next, decorations: decorate(tr.doc, next) }
            return tr.docChanged ? { allowed: old.allowed, decorations: decorate(tr.doc, old.allowed) } : old
          },
        },
        props: { decorations: (state) => placeholderKey.getState(state)?.decorations },
      }),
    ]
  },
})

export function RichTextEditor({ value, onChange, context, max, labelId, describedBy, invalid, readOnly = false }: RichTextEditorProps) {
  const t = useTranslations('invoiceSettings.editor')
  const placeholders = allowedPlaceholders(context)
  // Angaben für Screenreader bei jedem Rendern aus den aktuellen Werten: useEditor übernimmt nach jedem Rendern die
  // editorProps neu und würde nachträglich gesetzte Attribute wieder entfernen (BUG-2 aus QA)
  const attributes: Record<string, string> = {
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-labelledby': labelId,
    'aria-invalid': invalid ? 'true' : 'false',
    'aria-readonly': readOnly ? 'true' : 'false',
    class:
      'min-h-32 break-words px-3 py-2 text-[15px] leading-relaxed outline-none [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-6',
  }
  if (describedBy) attributes['aria-describedby'] = describedBy
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false,
        dropcursor: false,
        trailingNode: false,
      }),
      PlaceholderMarks.configure({ allowed: placeholders }),
    ],
    content: value,
    editorProps: {
      // Tabellen aus Word oder Webseiten: jede Zelle ein Absatz statt zusammengeklebtem Text (BUG-4 aus QA)
      transformPastedHTML: tablesToBlocks,
      attributes,
    },
    // useEditor ruft immer den aktuellen Rückruf auf
    onUpdate: ({ editor: e }) => onChange(normalizeDoc(e.getJSON())),
  })

  // Erlaubte Platzhalter geändert (z. B. Anzahlung ein/aus): Markierung neu berechnen
  const placeholderList = placeholders.join('|')
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const next = new Set(placeholderList ? placeholderList.split('|') : [])
    editor.view.dispatch(editor.state.tr.setMeta(placeholderKey, next))
  }, [editor, placeholderList])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  // Nach „Platzhalter einfügen“ zurück in die Schreibfläche statt auf den Menüknopf (BUG-1 aus QA). Ohne Auswahl
  // (Escape, Klick daneben) bleibt der Fokus wie üblich auf dem Knopf.
  const inserted = useRef(false)

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      bulletList: e?.isActive('bulletList') ?? false,
      orderedList: e?.isActive('orderedList') ?? false,
    }),
  })

  const length = docLength(value)
  const tools = [
    { key: 'bold', icon: TextB, pressed: active?.bold, run: () => editor?.chain().focus().toggleBold().run() },
    { key: 'italic', icon: TextItalic, pressed: active?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { key: 'bulletList', icon: ListBullets, pressed: active?.bulletList, run: () => editor?.chain().focus().toggleBulletList().run() },
    { key: 'orderedList', icon: ListNumbers, pressed: active?.orderedList, run: () => editor?.chain().focus().toggleOrderedList().run() },
  ] as const

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-md border border-input bg-ds-surface focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        invalid && 'border-ds-accent-2-700',
        readOnly && 'bg-ds-neutral-100'
      )}
    >
      {!readOnly && (
        <div role="toolbar" aria-label={t('toolbar')} aria-controls={labelId} className="flex flex-wrap items-center gap-1 border-b p-1">
          {tools.map(({ key, icon: Icon, pressed, run }) => (
            <Toggle key={key} size="lg" pressed={pressed ?? false} onPressedChange={run} aria-label={t(key)} disabled={!editor}>
              <Icon size={18} weight="bold" aria-hidden="true" />
            </Toggle>
          ))}
          {placeholders.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="ml-auto min-h-11 gap-1.5" disabled={!editor}>
                  <BracketsCurly size={18} aria-hidden="true" />
                  {t('insertPlaceholder')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-80 overflow-y-auto"
                onCloseAutoFocus={(event) => {
                  if (!inserted.current) return
                  inserted.current = false
                  event.preventDefault()
                  editor?.commands.focus()
                }}
              >
                {placeholders.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    className="min-h-11"
                    onSelect={() => {
                      inserted.current = true
                      editor?.chain().focus().insertContent({ type: 'text', text: `{${name}}` }).run()
                    }}
                  >
                    {`{${name}}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
      <p className={cn('px-3 pb-2 text-right text-[13px] text-ds-neutral-700', length > max && 'font-semibold text-ds-accent-2-800')}>
        {t('count', { length: formatNumber(length), max: formatNumber(max) })}
      </p>
    </div>
  )
}
