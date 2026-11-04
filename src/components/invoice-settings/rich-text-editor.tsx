'use client'

import { BracketsCurly, Code, ListBullets, ListNumbers, TextAlignCenter, TextAlignJustify, TextAlignLeft, TextAlignRight, TextB, TextItalic } from '@phosphor-icons/react'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { RICH_FONT_FAMILY, richTextStyle } from '@/components/invoice-settings/rich-text-fonts'
import { useRichTextCheck } from '@/components/invoice-settings/rich-text-guard'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { formatNumber } from '@/lib/format'
import { tablesToBlocks } from '@/lib/paste-html'
import { allowedPlaceholders, PLACEHOLDER_PATTERN, type PlaceholderContext } from '@/lib/invoice-texts'
import { docLength, normalizeDoc, parseFontSize, RICH_FONTS, withAttrs, type RichAlign, type RichAttrs, type RichDoc, type RichFont } from '@/lib/rich-text'
import { docToHtml, htmlToDoc, RICH_CODE_MAX, RICH_HTML_TAGS } from '@/lib/rich-text-html'
import { cn } from '@/lib/utils'

// Beschränkter Editor der Rechnungstexte (PROJ-39): fett, kursiv, Absätze, Zeilenumbruch, Aufzählung und nummerierte
// Liste. Alles andere ist im Editor gar nicht vorhanden; Eingefügtes aus Word, E-Mail oder Webseiten behält deshalb nur
// diese Formate (Links werden Text, Bilder, Farben und Schriftarten fallen weg). Platzhalter sind normaler Text
// „{Wohnung}“ und werden markiert: erlaubte farbig, unbekannte bzw. hier unzulässige rot.
// Schriftart, Schriftgröße und Ausrichtung gelten für den ganzen Text und stehen neben dem Editor-Inhalt im Dokument.
// Das Code-Feld zeigt den Text als HTML; jede Eingabe wird sofort in die Struktur übersetzt (rich-text-html.ts).
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

const STANDARD = 'standard'
const ALIGNS = [
  { key: 'alignLeft', value: undefined, icon: TextAlignLeft },
  { key: 'alignCenter', value: 'center', icon: TextAlignCenter },
  { key: 'alignRight', value: 'right', icon: TextAlignRight },
  { key: 'alignJustify', value: 'justify', icon: TextAlignJustify },
] as const

const formatSize = (size: number | undefined) => (size === undefined ? '' : String(size).replace('.', ','))
// Tiptap kennt die Einstellungen nicht; es bekommt nur den Inhalt
const editorContent = (doc: RichDoc) => ({ type: 'doc', content: doc.content })

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
  // Was beim Verlassen des Code-Felds entfernt wurde; bis zur nächsten Bearbeitung sichtbar
  const [removed, setRemoved] = useState<string[]>([])
  // Angaben für Screenreader bei jedem Rendern aus den aktuellen Werten: useEditor übernimmt nach jedem Rendern die
  // editorProps neu und würde nachträglich gesetzte Attribute wieder entfernen (BUG-2 aus QA)
  const attributes: Record<string, string> = {
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-labelledby': labelId,
    'aria-invalid': invalid ? 'true' : 'false',
    'aria-readonly': readOnly ? 'true' : 'false',
    class:
      'min-h-32 break-words px-3 py-2 text-[15px] leading-relaxed outline-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-left [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-left',
  }
  // Einstellungen des Texts direkt an der Schreibfläche; Tiptap setzt das Attribut, darum als Text statt als React-Stil
  const { fontFamily, fontSize, textAlign } = richTextStyle(value.attrs)
  const style = [fontFamily && `font-family:${fontFamily}`, fontSize && `font-size:${fontSize}`, textAlign && `text-align:${textAlign}`].filter(Boolean).join(';')
  if (style) attributes.style = style
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
    content: editorContent(value),
    editorProps: {
      // Tabellen aus Word oder Webseiten: jede Zelle ein Absatz statt zusammengeklebtem Text (BUG-4 aus QA)
      transformPastedHTML: tablesToBlocks,
      attributes,
    },
    // useEditor ruft immer den aktuellen Rückruf auf
    onUpdate: ({ editor: e }) => {
      setRemoved([])
      onChange(withAttrs(normalizeDoc(e.getJSON()), value.attrs))
    },
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
  // Gesteuertes Menü: Bei der Auswahl sofort schließen und den Fokus gleich in die Schreibfläche setzen, nicht erst nach
  // dem Ausblenden. Sonst gehen schnell getippte Zeichen an den Menüeintrag (Leertaste wählt ihn erneut, andere
  // Zeichen landen in der Schnellsuche; BUG-7 aus QA).
  const [menuOpen, setMenuOpen] = useState(false)

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      bulletList: e?.isActive('bulletList') ?? false,
      orderedList: e?.isActive('orderedList') ?? false,
    }),
  })

  const setAttrs = (next: RichAttrs) => onChange(withAttrs(value, { ...value.attrs, ...next }))

  // Schriftgröße: Eingabe erst beim Verlassen des Felds übernehmen, ungültige Werte bleiben stehen und sperren das Speichern
  const [sizeText, setSizeText] = useState(() => formatSize(value.attrs?.fontSize))
  const [sizeInvalid, setSizeInvalid] = useState(false)
  function commitSize() {
    const size = parseFontSize(sizeText)
    setSizeInvalid(size === null)
    if (size === null) return
    setSizeText(formatSize(size))
    if (size !== value.attrs?.fontSize) setAttrs({ fontSize: size })
  }

  // Code-Feld: null = Schreibfläche. codeStart erkennt, ob der Code überhaupt bearbeitet wurde.
  const [code, setCode] = useState<string | null>(null)
  const codeStart = useRef('')

  function openCode() {
    const html = docToHtml(value)
    codeStart.current = html
    setCode(html)
    setRemoved([])
    // Eine ungültige Eingabe wird durch den gespeicherten Wert ersetzt; das Code-Feld zeigt die gültigen Einstellungen
    setSizeText(formatSize(value.attrs?.fontSize))
    setSizeInvalid(false)
  }

  function closeCode() {
    const html = code ?? ''
    setCode(null)
    setCodeTooLong(false)
    if (html === codeStart.current) return
    const result = htmlToDoc(html)
    editor?.commands.setContent(editorContent(result.doc), { emitUpdate: false })
    onChange(result.doc)
    setRemoved(result.removed)
    setSizeText(formatSize(result.doc.attrs?.fontSize))
  }

  // Zu langer Code wird abgewiesen statt gekürzt (BUG-2 aus QA): ein maxLength am Feld schnitte Eingefügtes ohne Hinweis ab
  const [codeTooLong, setCodeTooLong] = useState(false)
  function changeCode(html: string) {
    setCodeTooLong(html.length > RICH_CODE_MAX)
    if (html.length > RICH_CODE_MAX) return
    setCode(html)
    onChange(htmlToDoc(html).doc)
  }

  useRichTextCheck(() => {
    if (readOnly) return true
    if (code !== null && htmlToDoc(code).removed.length > 0) {
      closeCode()
      return false
    }
    return !sizeInvalid
  })

  const codeOpen = code !== null
  const toolDisabled = !editor || codeOpen
  const fontField = `${labelId}-font`
  const sizeField = `${labelId}-size`
  const sizeMessage = `${labelId}-size-message`

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
            <Toggle key={key} size="lg" pressed={pressed ?? false} onPressedChange={run} aria-label={t(key)} disabled={toolDisabled}>
              <Icon size={18} weight="bold" aria-hidden="true" />
            </Toggle>
          ))}
          <Select
            value={value.attrs?.fontFamily ?? STANDARD}
            onValueChange={(v) => setAttrs({ fontFamily: v === STANDARD ? undefined : (v as RichFont) })}
            disabled={toolDisabled}
          >
            <SelectTrigger id={fontField} aria-label={t('fontFamily')} className="min-h-11 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STANDARD} className="min-h-11">
                {t('fontStandard')}
              </SelectItem>
              {RICH_FONTS.map((font) => (
                <SelectItem key={font} value={font} className="min-h-11" style={{ fontFamily: RICH_FONT_FAMILY[font] }}>
                  {t(`fonts.${font}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 px-1">
            <Input
              id={sizeField}
              inputMode="decimal"
              autoComplete="off"
              aria-label={t('fontSize')}
              aria-invalid={sizeInvalid}
              aria-describedby={sizeInvalid ? sizeMessage : undefined}
              placeholder={t('fontStandard')}
              className="min-h-11 w-24"
              value={sizeText}
              disabled={toolDisabled}
              onChange={(e) => setSizeText(e.target.value)}
              onBlur={commitSize}
              onKeyDown={(e) => {
                // Enter übernimmt die Größe und speichert nicht das Formular
                if (e.key !== 'Enter') return
                e.preventDefault()
                commitSize()
              }}
            />
            <span aria-hidden="true" className="text-sm text-ds-neutral-800">
              pt
            </span>
          </div>
          {ALIGNS.map(({ key, value: align, icon: Icon }) => (
            <Toggle
              key={key}
              size="lg"
              pressed={value.attrs?.textAlign === align}
              onPressedChange={() => setAttrs({ textAlign: align as RichAlign | undefined })}
              aria-label={t(key)}
              disabled={toolDisabled}
            >
              <Icon size={18} weight="bold" aria-hidden="true" />
            </Toggle>
          ))}
          <Toggle size="lg" pressed={codeOpen} onPressedChange={() => (codeOpen ? closeCode() : openCode())} aria-label={t('code')} disabled={!editor} className="gap-1.5 px-3">
            <Code size={18} weight="bold" aria-hidden="true" />
            {t('codeShort')}
          </Toggle>
          {placeholders.length > 0 && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="ml-auto min-h-11 gap-1.5" disabled={toolDisabled}>
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
                    onSelect={(event) => {
                      event.preventDefault()
                      inserted.current = true
                      // erst schließen (Fokusfalle des Menüs endet), dann Fokus sofort in die Schreibfläche: focus() von
                      // Tiptap wartet einen Frame, so lange hätte noch der Menüeintrag die Tasten
                      flushSync(() => setMenuOpen(false))
                      if (!editor) return
                      editor.view.focus()
                      editor.chain().focus().insertContent({ type: 'text', text: `{${name}}` }).run()
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
      {sizeInvalid && (
        <p id={sizeMessage} role="alert" className="border-b px-3 py-2 text-sm text-ds-accent-2-800">
          {t('fontSizeInvalid')}
        </p>
      )}
      {removed.length > 0 && (
        <p role="alert" className="border-b px-3 py-2 text-sm text-ds-accent-2-800">
          {t('removed', { items: removed.join(', ') })}
        </p>
      )}
      {codeOpen && (
        <div className="flex flex-col gap-2 p-3">
          <p className="text-[13px] text-ds-neutral-800">{t('codeHint', { tags: RICH_HTML_TAGS, wrapper: '<div>' })}</p>
          {codeTooLong && (
            <p role="alert" className="text-sm text-ds-accent-2-800">
              {t('codeTooLong', { max: formatNumber(RICH_CODE_MAX) })}
            </p>
          )}
          <Textarea
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="min-h-48 font-mono"
            value={code}
            onChange={(e) => changeCode(e.target.value)}
          />
        </div>
      )}
      {/* Bleibt im Code-Modus erhalten (nur ausgeblendet), damit Rückgängig und Markierung der Platzhalter weiterlaufen */}
      <EditorContent editor={editor} className={codeOpen ? 'hidden' : undefined} />
      <p className={cn('px-3 pb-2 text-right text-[13px] text-ds-neutral-700', length > max && 'font-semibold text-ds-accent-2-800')}>
        {t('count', { length: formatNumber(length), max: formatNumber(max) })}
      </p>
    </div>
  )
}
