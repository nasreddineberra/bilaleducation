'use client'

import { useDroppable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import SlotCapsule from './SlotCapsule'

interface SlotData {
  id: string
  class_id: string
  teacher_id: string
  cours_id: string | null
  room_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  slot_type: string
  color: string | null
  classes?: { name: string }
  teachers?: { first_name: string; last_name: string; civilite?: string }
  cours?: { nom_fr: string } | null
  rooms?: { name: string } | null
}

type ViewMode = 'global' | 'class' | 'teacher'

interface Props {
  day: number
  slots: SlotData[]
  startHour: number
  endHour: number
  isToday: boolean
  canEdit: boolean
  viewMode: ViewMode
  isTeacher: boolean
  isValidated: (slotId: string) => boolean
  onValidate: (slotId: string) => void
  onCancelValidation: (slotId: string) => void
  onClickSlot: (slot: SlotData) => void
  onClickEmpty: (day: number, time: string) => void
  onDeleteSlot: (slotId: string) => void
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function DayColumn({
  day, slots, startHour, endHour, isToday, canEdit, viewMode,
  isTeacher, isValidated, onValidate, onCancelValidation,
  onClickSlot, onClickEmpty, onDeleteSlot,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })

  const totalMinutes = (endHour - startHour) * 60
  const startMinutes = startHour * 60

  // Group overlapping slots for stacking
  const groupedSlots = groupOverlapping(slots)

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'relative border-l border-warm-100 cursor-crosshair',
        isToday && 'bg-amber-50/30',
        isOver && 'bg-blue-50/50',
      )}
      onClick={(e) => {
        // Click on empty space → compute time from click position
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
              validated={isValidated(slot.id)}
              onValidate={() => onValidate(slot.id)}
              onCancelValidation={() => onCancelValidation(slot.id)}
              onClick={() => canEdit && onClickSlot(slot)}
              onDelete={() => onDeleteSlot(slot.id)}
            />
          )
        })
      )).flat()}
    </div>
  )
}

/** Group overlapping slots so they can be placed side by side */
function groupOverlapping(slots: SlotData[]): SlotData[][] {
  if (slots.length === 0) return []

  const sorted = [...slots].sort((a, b) =>
    timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  )

  const groups: SlotData[][] = []
  let currentGroup: SlotData[] = [sorted[0]]
  let groupEnd = timeToMinutes(sorted[0].end_time)

  for (let i = 1; i < sorted.length; i++) {
    const slotStart = timeToMinutes(sorted[i].start_time)
    if (slotStart < groupEnd) {
      // Overlaps with current group
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
