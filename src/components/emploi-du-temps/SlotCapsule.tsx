'use client'

import { useDraggable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import { Check, X, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'

const SLOT_COLORS: Record<string, string> = {
  cours: 'bg-blue-100 border-blue-200 text-blue-900',
  activite: 'bg-emerald-100 border-emerald-200 text-emerald-900',
  pause: 'bg-warm-100 border-warm-200 text-warm-600',
  autre: 'bg-purple-100 border-purple-200 text-purple-900',
}

const VALIDATED_COLORS = 'bg-green-100 border-green-300 text-green-900'

interface SlotData {
  id: string
  class_id: string
  teacher_id: string
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
  slot: SlotData
  style: CSSProperties
  viewMode: ViewMode
  canEdit: boolean
  isToday: boolean
  isTeacher: boolean
  validated: boolean
  onValidate: () => void
  onCancelValidation: () => void
  onClick: () => void
  onDelete: () => void
}

function teacherShort(p: { first_name: string; last_name: string; civilite?: string } | undefined): string {
  if (!p) return ''
  const civ = p.civilite === 'Mme' ? 'Mme' : 'M.'
  return `${civ} ${p.last_name}`
}

export default function SlotCapsule({
  slot, style, viewMode, canEdit, isToday, isTeacher,
  validated, onValidate, onCancelValidation, onClick, onDelete,
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
        isDragging && 'opacity-40',
        canEdit && 'cursor-grab active:cursor-grabbing',
        !canEdit && 'cursor-default',
      )}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      {...(canEdit ? { ...attributes, ...listeners } : {})}
    >
      <div className="px-1.5 py-0.5 h-full flex flex-col overflow-hidden">
        {/* Course name */}
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
        <div className="text-[8px] leading-tight opacity-50 mt-auto">
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

      {/* Delete button (hover, edit mode only) */}
      {canEdit && (
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
