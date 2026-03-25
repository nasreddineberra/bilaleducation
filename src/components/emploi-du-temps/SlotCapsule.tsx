'use client'

import { useDraggable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import { Check, Trash2, CalendarDays } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ResolvedSlot } from './EmploiDuTempsClient'

const SLOT_COLORS: Record<string, string> = {
  cours: 'bg-blue-100 border-blue-200 text-blue-900',
  activite: 'bg-emerald-100 border-emerald-200 text-emerald-900',
}

const VALIDATED_COLORS = 'bg-green-100 border-green-300 text-green-900'
const MODIFIED_BORDER = 'border-amber-400 border-dashed'

type ViewMode = 'global' | 'class' | 'teacher'

interface Props {
  slot: ResolvedSlot
  style: CSSProperties
  viewMode: ViewMode
  canEdit: boolean
  isToday: boolean
  isTeacher: boolean
  validated: boolean
  onValidate: () => void
  onCancelValidation: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDelete: () => void
}

function teacherShort(p: { first_name: string; last_name: string; civilite?: string } | undefined): string {
  if (!p) return ''
  const civ = p.civilite === 'Mme' ? 'Mme' : 'M.'
  return `${civ} ${p.last_name}`
}

export default function SlotCapsule({
  slot, style, viewMode, canEdit, isToday, isTeacher,
  validated, onValidate, onCancelValidation, onClick, onContextMenu, onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: slot.id,
    disabled: !canEdit,
  })

  const colorClass = validated ? VALIDATED_COLORS : (SLOT_COLORS[slot.slot_type] ?? SLOT_COLORS.cours)
  const showValidation = isTeacher && isToday && slot.slot_type !== 'pause'

  return (
    <div
      ref={setNodeRef}
      data-slot
      style={{ ...style, zIndex: isDragging ? 50 : 10 }}
      className={clsx(
        'rounded-lg border overflow-hidden transition-shadow group',
        colorClass,
        slot.isModified && MODIFIED_BORDER,
        isDragging && 'opacity-40',
        canEdit && 'cursor-grab active:cursor-grabbing',
        !canEdit && 'cursor-default',
      )}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e) }}
      {...(canEdit ? { ...attributes, ...listeners } : {})}
    >
      <div className="px-1.5 py-0.5 h-full flex flex-col overflow-hidden">
        {/* Course name or type */}
        <div className="text-[10px] font-bold leading-tight truncate">
          {slot.cours?.nom_fr ?? slot.slot_type}
        </div>

        {/* Class name (in global/teacher view) */}
        {viewMode !== 'class' && slot.classes && (
          <div className="text-[9px] font-medium leading-tight truncate opacity-80">
            {slot.classes.name}
          </div>
        )}

        {/* Teacher (in global/class view) */}
        {viewMode !== 'teacher' && slot.teachers && (
          <div className="text-[9px] leading-tight truncate opacity-70">
            {teacherShort(slot.teachers)}
          </div>
        )}

        {/* Room */}
        {slot.rooms && (
          <div className="text-[9px] leading-tight truncate opacity-60">
            {slot.rooms.name}
          </div>
        )}

        {/* Time range */}
        <div className="text-[8px] leading-tight opacity-50 mt-auto flex items-center gap-0.5">
          {!slot.isRecurring && <CalendarDays size={7} className="opacity-60" />}
          {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
        </div>
      </div>

      {/* Validation button for teacher */}
      {showValidation && (
        <div
          className="absolute bottom-0.5 right-0.5 flex gap-0.5"
          onClick={e => e.stopPropagation()}
        >
          {validated ? (
            <button
              onClick={onCancelValidation}
              className="p-0.5 rounded bg-green-500 text-white hover:bg-red-500 transition-colors"
              title="Annuler la validation"
            >
              <Check size={10} />
            </button>
          ) : (
            <button
              onClick={onValidate}
              className="p-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              title="Valider ma présence"
            >
              <Check size={10} />
            </button>
          )}
        </div>
      )}

      {/* Delete button (hover, edit mode, non-recurring only) */}
      {canEdit && !slot.isRecurring && (
        <button
          className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Supprimer"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}
