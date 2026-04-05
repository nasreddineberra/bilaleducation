'use client'

import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import SlotCapsule from './SlotCapsule'
import type { ResolvedSlot } from './EmploiDuTempsClient'

type ViewMode = 'global' | 'class' | 'teacher'

interface Props {
  day: number
  dateStr: string
  slots: ResolvedSlot[]
  startHour: number
  endHour: number
  isToday: boolean
  canValidate: boolean
  canEdit: boolean
  viewMode: ViewMode
  isTeacher: boolean
  isValidated: (sourceSlotId: string, slotDate: string) => boolean
  onValidate: (slot: ResolvedSlot) => void
  onCancelValidation: (sourceSlotId: string, slotDate: string) => void
  onClickSlot: (slot: ResolvedSlot) => void
  onContextMenuSlot: (e: React.MouseEvent, slot: ResolvedSlot) => void
  onClickEmpty: (day: number, time: string) => void
  onDeleteSlot: (sourceSlotId: string) => void
  vacationLabel?: string | null
  /** Enable drop zones for drag & drop (only in week+class view) */
  droppable?: boolean
}

// ─── Drop zone for a 15min slot ─────────────────────────────────────────────

function DropZone({ id, topPct, heightPct }: { id: string; topPct: number; heightPct: number }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'absolute w-full z-10 transition-colors',
        isOver && 'bg-primary-200/30',
      )}
      style={{ top: `${topPct}%`, height: `${heightPct}%` }}
    />
  )
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function DayColumn({
  day, dateStr, slots, startHour, endHour, isToday, canValidate, canEdit, viewMode,
  isTeacher, vacationLabel, isValidated, onValidate, onCancelValidation,
  onClickSlot, onContextMenuSlot, onClickEmpty, onDeleteSlot, droppable = false,
}: Props) {
  const totalMinutes = (endHour - startHour) * 60
  const startMinutes = startHour * 60

  const groupedSlots = groupOverlapping(slots)

  // Generate 15min drop zones
  const dropZones = useMemo(() => {
    if (!droppable || vacationLabel) return []
    const zones: { id: string; topPct: number; heightPct: number }[] = []
    const totalSlots = (endHour - startHour) * 4 // 4 x 15min per hour
    const slotHeight = 100 / totalSlots
    for (let i = 0; i < totalSlots; i++) {
      const mins = startHour * 60 + i * 15
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      zones.push({
        id: `drop-${day}-${time}`,
        topPct: i * slotHeight,
        heightPct: slotHeight,
      })
    }
    return zones
  }, [droppable, vacationLabel, day, startHour, endHour])

  return (
    <div
      className={clsx(
        'relative border-l border-warm-100',
        vacationLabel ? 'bg-amber-50/40 cursor-default' : 'cursor-crosshair',
        isToday && !vacationLabel && 'bg-amber-50/30',
      )}
      onClick={(e) => {
        if (vacationLabel) return
        if ((e.target as HTMLElement).closest('[data-slot]')) return
        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const pct = y / rect.height
        const mins = startMinutes + pct * totalMinutes
        const roundedMins = Math.round(mins / 15) * 15
        const h = Math.floor(roundedMins / 60)
        const m = roundedMins % 60
        onClickEmpty(day, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }}
    >
      {/* Tag vacances */}
      {vacationLabel && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wide">
            {vacationLabel}
          </span>
        </div>
      )}

      {/* Hour grid lines + 15min subdivisions */}
      {Array.from({ length: endHour - startHour }).map((_, i) => (
        <div key={`h${i}`}>
          {/* Hour line */}
          <div
            className="absolute w-full border-t border-warm-100"
            style={{ top: `${(i / (endHour - startHour)) * 100}%` }}
          />
          {/* 15min, 30min, 45min lines */}
          {[1, 2, 3].map(q => (
            <div
              key={q}
              className={clsx(
                'absolute w-full border-t',
                q === 2 ? 'border-warm-100/60' : 'border-warm-50/80',
              )}
              style={{
                top: `${((i + q / 4) / (endHour - startHour)) * 100}%`,
                borderStyle: q === 2 ? 'solid' : 'dotted',
              }}
            />
          ))}
        </div>
      ))}

      {/* Drop zones (15min intervals) */}
      {dropZones.map(z => (
        <DropZone key={z.id} id={z.id} topPct={z.topPct} heightPct={z.heightPct} />
      ))}

      {/* Capsules */}
      {groupedSlots.map(group => (
        group.map((slot, idx) => {
          const topPct = ((timeToMinutes(slot.start_time) - startMinutes) / totalMinutes) * 100
          const heightPct = ((timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time)) / totalMinutes) * 100
          const width = 100 / group.length
          const left = idx * width

          return (
            <SlotCapsule
              key={slot.id}
              slot={slot}
              style={{
                position: 'absolute',
                top: `${topPct}%`,
                height: `${heightPct}%`,
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
                minHeight: '20px',
              }}
              viewMode={viewMode}
              canEdit={canEdit}
              isToday={isToday}
              canValidate={canValidate}
              isTeacher={isTeacher}
              validated={isValidated(slot.sourceSlotId, dateStr)}
              draggable={droppable}
              onValidate={() => onValidate(slot)}
              onCancelValidation={() => onCancelValidation(slot.sourceSlotId, dateStr)}
              onClick={() => onClickSlot(slot)}
              onContextMenu={(e) => onContextMenuSlot(e, slot)}
              onDelete={() => onDeleteSlot(slot.sourceSlotId)}
            />
          )
        })
      )).flat()}
    </div>
  )
}

function groupOverlapping(slots: ResolvedSlot[]): ResolvedSlot[][] {
  if (slots.length === 0) return []

  const sorted = [...slots].sort((a, b) =>
    timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  )

  const groups: ResolvedSlot[][] = []
  let currentGroup: ResolvedSlot[] = [sorted[0]]
  let groupEnd = timeToMinutes(sorted[0].end_time)

  for (let i = 1; i < sorted.length; i++) {
    const slotStart = timeToMinutes(sorted[i].start_time)
    if (slotStart < groupEnd) {
      currentGroup.push(sorted[i])
      groupEnd = Math.max(groupEnd, timeToMinutes(sorted[i].end_time))
    } else {
      groups.push(currentGroup)
      currentGroup = [sorted[i]]
      groupEnd = timeToMinutes(sorted[i].end_time)
    }
  }
  groups.push(currentGroup)

  return groups
}
