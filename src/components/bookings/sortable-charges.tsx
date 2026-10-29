'use client'

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SortableChargeListProps {
  // IDs der Positionen in aktueller Reihenfolge (useFieldArray-IDs)
  ids: string[]
  // Bezeichnung der Position an Stelle i (für Ansagen), leer erlaubt
  labelAt: (index: number) => string
  onMove: (from: number, to: number) => void
  // Während des Ziehens darf Escape das Seitenpanel nicht schließen
  onDraggingChange: (dragging: boolean) => void
  children: React.ReactNode
}

// Zusatzkosten per Griff ordnen (PROJ-34): Maus, Touch und Tastatur, nur senkrecht und innerhalb der Liste.
export function SortableChargeList({ ids, labelAt, onMove, onDraggingChange, children }: SortableChargeListProps) {
  const t = useTranslations('bookings.panel')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Stand der laufenden Ziehaktion, beim Aufnehmen festgehalten: Nach dem Ablegen ist die Liste schon umsortiert,
  // die Ansage braucht aber Name und Stellen wie während des Ziehens
  const drag = useRef({ name: '', from: 0, overId: null as UniqueIdentifier | null, overPos: 0 })
  const indexOf = (id: UniqueIdentifier) => ids.indexOf(String(id))
  const total = ids.length

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const i = indexOf(active.id)
      const name = labelAt(i).trim() || t('chargeFallback', { n: i + 1 })
      drag.current = { name, from: i + 1, overId: active.id, overPos: i + 1 }
      return t('sortStart', { label: name, pos: i + 1, total })
    },
    onDragOver: ({ over }) => {
      // Beim Aufnehmen liegt die Position über sich selbst; das soll „aufgenommen“ nicht überschreiben
      if (!over || over.id === drag.current.overId) return undefined
      drag.current.overId = over.id
      drag.current.overPos = indexOf(over.id) + 1
      return t('sortOver', { label: drag.current.name, pos: drag.current.overPos, total })
    },
    onDragEnd: ({ over }) => {
      const { name, from, overPos } = drag.current
      if (!over) return t('sortCancel', { label: name, pos: from, total })
      return t('sortEnd', { label: name, pos: overPos, total })
    },
    onDragCancel: () => t('sortCancel', { label: drag.current.name, pos: drag.current.from, total }),
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    onDraggingChange(false)
    if (!over || active.id === over.id) return
    const from = indexOf(active.id)
    const to = indexOf(over.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('sortInstructions') } }}
      onDragStart={() => onDraggingChange(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => onDraggingChange(false)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">{children}</div>
      </SortableContext>
    </DndContext>
  )
}

interface SortableChargeRowProps {
  id: string
  // Zugänglicher Name des Griffs, z. B. „Reinigung verschieben“
  handleLabel: string
  // Griff nur ab zwei Positionen
  sortable: boolean
  // Mit Umsatzsteuersatz (PROJ-35): Betrag und Satz in einer Zelle, am Handy in der zweiten Zeile
  withVat?: boolean
  children: React.ReactNode
}

// Zelle für Betrag und Satz einer Position. Ohne Satz löst sie sich auf (contents), dann gilt das bisherige Raster.
export function chargeMoneyCell(sortable: boolean, withVat: boolean): string {
  if (!withVat) return 'contents'
  return cn('flex items-start gap-2 row-start-2 sm:col-auto sm:row-start-auto', sortable ? 'col-[2/-1]' : 'col-[1/-1]')
}

export function SortableChargeRow({ id, handleLabel, sortable, withVat = false, children }: SortableChargeRowProps) {
  const t = useTranslations('bookings.panel')
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
    attributes: { roleDescription: t('sortRole') },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-dragging={isDragging || undefined}
      className={cn(
        'grid items-start gap-2 rounded-lg bg-ds-bg',
        withVat
          ? sortable
            ? 'grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]'
            : 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto]'
          : sortable
            ? 'grid-cols-[auto_1fr_7rem_auto]'
            : 'grid-cols-[1fr_7rem_auto]',
        isDragging && 'relative z-10 shadow-lg ring-2 ring-ds-accent-700',
      )}
    >
      {sortable && (
        <Button
          ref={setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 cursor-grab touch-none active:cursor-grabbing"
          aria-label={handleLabel}
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical size={20} weight="bold" aria-hidden="true" />
        </Button>
      )}
      {children}
    </div>
  )
}
