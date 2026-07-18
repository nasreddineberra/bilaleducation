'use client'

import { useDraggable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import { Check, CalendarDays, MoreVertical } from 'lucide-react'
import type { CSSProperties } from 'react'
import Tooltip from '@/components/ui/Tooltip'
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
  canValidate: boolean
  isTeacher: boolean
  isOwnSlot?: boolean
  validated: boolean
  draggable?: boolean
  menuActive?: boolean
  onValidate: () => void
  onCancelValidation: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onKeyMenu?: (rect: DOMRect) => void
  onDelete: () => void
}

function teacherShort(p: { first_name: string; last_name: string; civilite?: string } | undefined): string {
  if (!p) return ''
  const civ = p.civilite === 'Mme' ? 'Mme' : 'M.'
  return `${civ} ${p.last_name}`
}

export default function SlotCapsule({
  slot, style, viewMode, canEdit, isToday, canValidate, isTeacher, isOwnSlot = false,
  validated, draggable: isDraggableEnabled = false, menuActive = false, onValidate, onCancelValidation, onClick, onContextMenu, onKeyMenu, onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slot-${slot.sourceSlotId}`,
    data: { type: 'existing-slot', slot },
    disabled: !isDraggableEnabled,
  })

  const noTeacher = !slot.teacher_id
  const colorClass = validated ? VALIDATED_COLORS : (SLOT_COLORS[slot.slot_type] ?? SLOT_COLORS.cours)
  // Validation : le personnel gestionnaire (canEdit) peut valider tout créneau ;
  // un enseignant ne peut valider que SON propre créneau.
  const showValidation = (canEdit || (isTeacher && isOwnSlot)) && canValidate && slot.slot_type !== 'pause'

  // Libellé accessible du créneau (cours, classe/prof selon la vue, salle, horaire, statut)
  const ariaParts = [slot.cours?.nom_fr ?? slot.slot_type]
  if (viewMode !== 'class' && slot.classes) ariaParts.push(slot.classes.name)
  if (viewMode !== 'teacher') ariaParts.push(noTeacher ? 'Prof non affecté' : teacherShort(slot.teachers))
  if (slot.rooms) ariaParts.push(slot.rooms.name)
  ariaParts.push(`de ${slot.start_time.slice(0, 5)} à ${slot.end_time.slice(0, 5)}`)
  if (validated) ariaParts.push('présence validée')
  const ariaLabel = ariaParts.filter(Boolean).join(', ')

  return (
    <div
      ref={setNodeRef}
      data-slot
      style={{ ...style, zIndex: isDragging ? 50 : menuActive ? 30 : 10 }}
      className={clsx(
        'rounded-lg border overflow-hidden transition-shadow group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
        menuActive && 'ring-2 ring-secondary-600 ring-offset-1 shadow-lg',
        colorClass,
        noTeacher && 'border-dashed border-orange-400',
        !noTeacher && slot.isModified && MODIFIED_BORDER,
        isDragging && 'opacity-30 scale-95',
        isDraggableEnabled && 'cursor-grab active:cursor-grabbing',
        !isDraggableEnabled && 'cursor-default',
      )}
      // Le clic sur le corps du créneau ne fait rien (on stoppe juste la propagation
      // vers la cellule vide) : pour agir, l'utilisateur passe par le bouton menu « ⋯ ».
      onClick={(e) => { if (isDragging) return; e.stopPropagation() }}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e) }}
      aria-label={ariaLabel}
      {...(isDraggableEnabled ? { ...listeners, ...attributes } : {})}
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
        {viewMode !== 'teacher' && (
          noTeacher ? (
            <div className="text-[9px] leading-tight truncate text-orange-500 font-medium">
              Prof non affecté
            </div>
          ) : slot.teachers ? (
            <div className="text-[9px] leading-tight truncate opacity-70">
              {teacherShort(slot.teachers)}
            </div>
          ) : null
        )}

        {/* Room */}
        {slot.rooms && (
          <div className="text-[9px] leading-tight truncate opacity-60">
            {slot.rooms.name}
          </div>
        )}

        {/* Time range — meme police que le nom de classe (ligne titre). */}
        <div className="text-[10px] font-bold leading-tight mt-auto flex items-center gap-0.5">
          {!slot.isRecurring && <CalendarDays size={9} className="opacity-70" />}
          {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}
        </div>
      </div>

      {/* Validation button for teacher */}
      {showValidation && (
        <div
          className="absolute bottom-0.5 right-0.5 flex gap-0.5"
          onClick={e => e.stopPropagation()}
        >
          {validated ? (
            <Tooltip content="Annuler la validation">
              <button
                onClick={onCancelValidation}
                aria-label={`Annuler la validation de présence : ${ariaLabel}`}
                className="p-0.5 rounded bg-green-500 text-white hover:bg-red-500 transition-colors"
              >
                <Check size={10} />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content="Valider ma présence">
              <button
                onClick={onValidate}
                aria-label={`Valider ma présence : ${ariaLabel}`}
                className="p-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                <Check size={10} />
              </button>
            </Tooltip>
          )}
        </div>
      )}

      {/* Bouton menu « ⋯ » — seul point d'entrée des actions (Modifier / Supprimer) sur un créneau existant */}
      {canEdit && onKeyMenu && (
        <Tooltip content="Actions du créneau" className="absolute top-0.5 right-0.5">
          <button
            className={clsx(
              'p-0.5 rounded bg-secondary-700 text-white group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity',
              menuActive ? 'opacity-100' : 'opacity-0',
            )}
            onClick={(e) => { e.stopPropagation(); onKeyMenu((e.currentTarget as HTMLElement).getBoundingClientRect()) }}
            aria-label={`Actions du créneau : ${ariaLabel}`}
            aria-haspopup="menu"
          >
            <MoreVertical size={10} />
          </button>
        </Tooltip>
      )}
    </div>
  )
}
