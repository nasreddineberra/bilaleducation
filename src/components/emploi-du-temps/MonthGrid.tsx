'use client'

import { clsx } from 'clsx'
import type { ResolvedSlot } from './EmploiDuTempsClient'

type ViewMode = 'global' | 'class' | 'teacher'

const DAY_LABELS_SHORT: Record<number, string> = {
  0: 'DIM', 1: 'LUN', 2: 'MAR', 3: 'MER',
  4: 'JEU', 5: 'VEN', 6: 'SAM',
}

function teacherShort(p: { first_name: string; last_name: string; civilite?: string } | undefined): string {
  if (!p) return ''
  const civ = p.civilite === 'Mme' ? 'Mme' : 'M.'
  return `${civ} ${p.last_name}`
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  month: number // 0-11
  year: number
  orderedDays: number[]
  slots: ResolvedSlot[]
  viewMode: ViewMode
  canEdit: boolean
  isSchoolDay: (dateStr: string) => boolean
  getVacationLabel: (dateStr: string) => string | null
  onClickSlot: (slot: ResolvedSlot) => void
  onContextMenuSlot: (e: React.MouseEvent, slot: ResolvedSlot) => void
  onClickEmpty: (day: number, time: string, date: string) => void
}

const MAX_VISIBLE = 3

export default function MonthGrid({
  month, year, orderedDays, slots, viewMode, canEdit,
  isSchoolDay, getVacationLabel,
  onClickSlot, onContextMenuSlot, onClickEmpty,
}: Props) {
  // Build calendar weeks
  const weeks = buildCalendarWeeks(year, month, orderedDays[0])

  // Group slots by date
  const slotsByDate: Record<string, ResolvedSlot[]> = {}
  for (const s of slots) {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = []
    slotsByDate[s.date].push(s)
  }
  // Sort each day's slots by start_time
  for (const date of Object.keys(slotsByDate)) {
    slotsByDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  const todayStr = formatDate(new Date())

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div
        className="grid border-b border-warm-100 flex-shrink-0"
        style={{ gridTemplateColumns: `repeat(7, 1fr)` }}
      >
        {orderedDays.map(d => (
          <div
            key={d}
            className="p-2 text-center text-xs font-semibold uppercase tracking-wide text-warm-500 border-l first:border-l-0 border-warm-100"
          >
            {DAY_LABELS_SHORT[d]}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid min-h-0" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid border-b last:border-b-0 border-warm-100 min-h-0"
            style={{ gridTemplateColumns: `repeat(7, 1fr)` }}
          >
            {week.map((cell, ci) => {
              const dateStr = formatDate(cell.date)
              const isCurrentMonth = cell.date.getMonth() === month
              const isToday = dateStr === todayStr
              const vacLabel = getVacationLabel(dateStr)
              const schoolDay = isSchoolDay(dateStr)
              const daySlots = slotsByDate[dateStr] ?? []
              const hasMore = daySlots.length > MAX_VISIBLE
              const visibleSlots = hasMore ? daySlots.slice(0, MAX_VISIBLE - 1) : daySlots

              return (
                <div
                  key={ci}
                  className={clsx(
                    'border-l first:border-l-0 border-warm-100 flex flex-col overflow-hidden relative',
                    !isCurrentMonth && 'bg-warm-50/50',
                    vacLabel && 'bg-amber-50/40',
                    !schoolDay && !vacLabel && !isCurrentMonth && 'bg-warm-50/50',
                    !schoolDay && !vacLabel && isCurrentMonth && 'bg-warm-50/30',
                    canEdit && !vacLabel && schoolDay && 'cursor-crosshair',
                  )}
                  onClick={(e) => {
                    if (vacLabel || !schoolDay || !canEdit) return
                    if ((e.target as HTMLElement).closest('[data-month-slot]')) return
                    onClickEmpty(cell.date.getDay(), '09:00', dateStr)
                  }}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between px-1.5 pt-1">
                    <span
                      className={clsx(
                        'text-[11px] leading-none font-medium',
                        isToday
                          ? 'bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center'
                          : isCurrentMonth ? 'text-warm-700' : 'text-warm-300',
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>

                  {/* Vacation label */}
                  {vacLabel && (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-[8px] font-semibold text-amber-600 uppercase tracking-wide">
                        {vacLabel}
                      </span>
                    </div>
                  )}

                  {/* Slot capsules */}
                  {!vacLabel && (
                    <div className="flex-1 flex flex-col gap-px px-1 pb-1 overflow-hidden min-h-0">
                      {visibleSlots.map(slot => (
                        <MonthSlotCapsule
                          key={slot.id}
                          slot={slot}
                          viewMode={viewMode}
                          onClick={() => onClickSlot(slot)}
                          onContextMenu={(e) => onContextMenuSlot(e, slot)}
                        />
                      ))}
                      {hasMore && (
                        <span className="text-[8px] text-warm-400 font-medium px-1 cursor-default">
                          +{daySlots.length - (MAX_VISIBLE - 1)} autres
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mini capsule for month view ─────────────────────────────────────────────

const SLOT_COLORS: Record<string, string> = {
  cours: 'bg-blue-100 text-blue-800',
  activite: 'bg-emerald-100 text-emerald-800',
}

function MonthSlotCapsule({
  slot, viewMode, onClick, onContextMenu,
}: {
  slot: ResolvedSlot
  viewMode: ViewMode
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const colorClass = SLOT_COLORS[slot.slot_type] ?? SLOT_COLORS.cours

  return (
    <div
      data-month-slot
      className={clsx(
        'rounded px-1 py-px truncate cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0',
        colorClass,
      )}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e) }}
    >
      <span className="text-[9px] font-semibold leading-tight">
        {slot.start_time.slice(0, 5)}
      </span>
      <span className="text-[9px] leading-tight ml-0.5">
        {slot.cours?.nom_fr ?? slot.slot_type}
      </span>
      {viewMode !== 'class' && slot.classes && (
        <span className="text-[8px] opacity-70 ml-0.5">
          {slot.classes.name}
        </span>
      )}
      {viewMode !== 'teacher' && slot.teachers && (
        <span className="text-[8px] opacity-60 ml-0.5">
          {teacherShort(slot.teachers)}
        </span>
      )}
    </div>
  )
}

// ─── Calendar week builder ───────────────────────────────────────────────────

interface CalendarCell {
  date: Date
}

function buildCalendarWeeks(year: number, month: number, startDay: number): CalendarCell[][] {
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  // Find the start of the first week (may be in previous month)
  const firstDow = firstOfMonth.getDay()
  const offset = (firstDow - startDay + 7) % 7
  const calendarStart = new Date(year, month, 1 - offset)

  const weeks: CalendarCell[][] = []
  const cursor = new Date(calendarStart)

  // Build weeks until we've passed the last day of the month
  while (true) {
    const week: CalendarCell[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ date: new Date(cursor) })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)

    // Stop after we've covered the whole month
    if (cursor.getMonth() !== month && weeks.length >= 4) break
  }

  return weeks
}
