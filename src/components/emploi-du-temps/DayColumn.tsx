'use client'

import { clsx } from 'clsx'
import SlotCapsule from './SlotCapsule'
import type { ResolvedSlot } from './EmploiDuTempsClient'

type ViewMode = 'global' | 'class' | 'teacher'

interface Props {
  day: number
  slots: ResolvedSlot[]
  startHour: number
  endHour: number
  isToday: boolean
  canEdit: boolean
  viewMode: ViewMode
  isTeacher: boolean
  isValidated: (sourceSlotId: string) => boolean
  onValidate: (slot: ResolvedSlot) => void
  onCancelValidation: (sourceSlotId: string) => void
  onClickSlot: (slot: ResolvedSlot) => void
  onContextMenuSlot: (e: React.MouseEvent, slot: ResolvedSlot) => void
  onClickEmpty: (day: number, time: string) => void
  onDeleteSlot: (sourceSlotId: string) => void
  vacationLabel?: string | null
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function DayColumn({
  day, slots, startHour, endHour, isToday, canEdit, viewMode,
  isTeacher, vacationLabel, isValidated, onValidate, onCancelValidation,
  onClickSlot, onContextMenuSlot, onClickEmpty, onDeleteSlot,
}: Props) {
  const totalMinutes = (endHour - startHour) * 60
  const startMinutes = startHour * 60

  const groupedSlots = groupOverlapping(slots)

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

      {/* Hour grid lines */}
      {Array.from({ length: endHour - startHour }).map((_, i) => (
        <div
          key={i}
          className="absolute w-full border-t border-warm-50"
          style={{ top: `${(i / (endHour - startHour)) * 100}%` }}
        />
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
              isTeacher={isTeacher}
              validated={isValidated(slot.sourceSlotId)}
              onValidate={() => onValidate(slot)}
              onCancelValidation={() => onCancelValidation(slot.sourceSlotId)}
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
