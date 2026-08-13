'use client'

import { useDraggable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import { Check, CalendarDays, MoreVertical, Ban } from 'lucide-react'
import type { CSSProperties } from 'react'
import Tooltip from '@/components/ui/Tooltip'
import type { ResolvedSlot } from './EmploiDuTempsClient'

// Couleurs définies dans globals.css (palette de marque, aplats opaques dans
// les deux thèmes) — voir « Créneaux de l'emploi du temps ».
const SLOT_COLORS: Record<string, string> = {
  cours:    'edt-slot-cours',
  activite: 'edt-slot-activite',
}
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
  /** Nombre de créneaux se partageant la largeur : pilote la densité d'affichage. */
  groupSize?: number
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
  validated, groupSize = 1, draggable: isDraggableEnabled = false, menuActive = false, onValidate, onCancelValidation, onClick, onContextMenu, onKeyMenu, onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slot-${slot.sourceSlotId}`,
    data: { type: 'existing-slot', slot },
    disabled: !isDraggableEnabled,
  })

  const noTeacher = !slot.teacher_id

  // Densité : la capsule perd des lignes à mesure qu'elle rétrécit, au lieu de
  // les tronquer toutes à deux caractères. Le détail reste accessible en
  // infobulle (et dans l'`aria-label`, inchangé).
  //   1-2 créneaux : tout        3-4 : sans salle ni horaire        5+ : nom seul
  const dense   = groupSize >= 3
  const minimal = groupSize >= 5
  // La validation ne remplace plus la couleur : elle s'ajoute (la teinte reste
  // celle de la catégorie, sinon un cours validé et une activité validée
  // deviendraient identiques).
  const colorClass = clsx(
    SLOT_COLORS[slot.slot_type] ?? SLOT_COLORS.cours,
    validated && 'edt-slot-validated',
  )
  // Validation : le personnel gestionnaire (canEdit) peut valider tout créneau ;
  // un enseignant ne peut valider que SON propre créneau.
  const showValidation = (canEdit || (isTeacher && isOwnSlot)) && canValidate && slot.slot_type !== 'pause'

  // ENSEIGNANT ABSENT : le creneau reste VISIBLE — il a bien lieu, et son
  // titulaire doit savoir ce qu'il manque — mais la validation est refusee.
  // On la remplace par une marque inerte plutot que de la retirer : un bouton
  // qui disparait se lit comme un defaut, une marque qui explique se lit comme
  // une regle. La base refuse de toute facon l'ecriture
  // (`guard-presence-absence-exclusivity`) ; ceci l'annonce AVANT le clic.
  const absent = !!slot.teacherAbsent

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
        // `flex` : le contenu est enveloppé dans le wrapper INLINE du Tooltip.
        // En contexte inline, la ligne réserve la place du jambage sous la
        // ligne de base — le contenu descendait donc de quelques pixels et
        // l'horaire sortait du cadre. En flex, ce décalage n'existe pas.
        'rounded-lg border overflow-hidden transition-shadow group flex',
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
      {/* En densité réduite, le détail retiré de la capsule reste accessible au
          survol. Le wrapper du Tooltip est `inline-flex` : sans `w-full` le
          contenu ne remplirait pas la capsule. */}
      <Tooltip
        content={dense ? ariaLabel : ''}
        className={clsx('h-full w-full align-bottom', !dense && 'pointer-events-none')}
        maxWidth="max-w-none"
      >
        <div className={clsx('h-full flex flex-col overflow-hidden', minimal ? 'px-1 py-0.5' : 'px-1.5 py-0.5')}>
          {/* Cours (ou type de créneau) */}
          <div className={clsx('font-bold leading-tight', minimal ? 'text-[9px] line-clamp-2' : 'text-[10px] truncate')}>
            {slot.cours?.nom_fr ?? slot.slot_type}
          </div>

          {/* Classe (vues globale / enseignant) */}
          {viewMode !== 'class' && slot.classes && (
            <div className={clsx('font-medium leading-tight truncate opacity-80', minimal ? 'text-[8px]' : 'text-[9px]')}>
              {slot.classes.name}
            </div>
          )}

          {/* Enseignant (vues globale / classe) — « Prof non affecté » reste
              affiché même en densité minimale : c'est une anomalie à voir. */}
          {viewMode !== 'teacher' && (
            noTeacher ? (
              <div className={clsx('leading-tight truncate text-orange-500 font-medium', minimal ? 'text-[8px]' : 'text-[9px]')}>
                {minimal ? 'Sans prof' : 'Prof non affecté'}
              </div>
            ) : slot.teachers && !minimal ? (
              <div className="text-[9px] leading-tight truncate opacity-70">
                {teacherShort(slot.teachers)}
              </div>
            ) : null
          )}

          {/* Salle — première ligne sacrifiée quand la place manque */}
          {slot.rooms && !dense && (
            <div className="text-[9px] leading-tight truncate opacity-60">
              {slot.rooms.name}
            </div>
          )}

          {/* Horaire — même police que la ligne titre. Retiré en densité minimale :
              tous les créneaux du groupe partagent le même horaire. */}
          {!minimal && (
            <div className="text-[10px] font-bold leading-tight mt-auto flex items-center gap-0.5">
              {!slot.isRecurring && <CalendarDays size={9} className="opacity-70" />}
              {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}
            </div>
          )}
        </div>
      </Tooltip>

      {/* Validation impossible : la personne est absente ce demi-jour */}
      {showValidation && absent && (
        <div className="absolute bottom-1 right-1" onClick={e => e.stopPropagation()}>
          <Tooltip content="Absent ce jour : la présence ne peut pas être validée">
            <span
              role="img"
              aria-label={`Présence non validable, absence enregistrée : ${ariaLabel}`}
              className="w-[15px] h-[15px] rounded border border-red-300 bg-red-50 text-red-500 flex items-center justify-center cursor-not-allowed"
            >
              <Ban size={10} strokeWidth={2.5} />
            </span>
          </Tooltip>
        </div>
      )}

      {/* Validation button for teacher */}
      {showValidation && !absent && (
        <div
          className="absolute bottom-1 right-1 flex gap-0.5"
          onClick={e => e.stopPropagation()}
        >
          {validated ? (
            <Tooltip content="Annuler la validation">
              <button
                onClick={onCancelValidation}
                aria-label={`Annuler la validation de présence : ${ariaLabel}`}
                aria-pressed
                className="w-[15px] h-[15px] rounded bg-primary-500 text-white hover:bg-red-500 transition-colors flex items-center justify-center"
              >
                <Check size={11} strokeWidth={3} />
              </button>
            </Tooltip>
          ) : (
            /* Non validé = case VIDE. Un ✓ plein, même ambre, se lit « fait » :
               l'état à cocher ne doit pas porter la marque de l'état coché. */
            <Tooltip content="Valider ma présence">
              <button
                onClick={onValidate}
                aria-label={`Valider ma présence : ${ariaLabel}`}
                aria-pressed={false}
                className="w-[15px] h-[15px] rounded border-2 border-amber-500 bg-transparent hover:bg-amber-500 hover:text-white text-transparent transition-colors flex items-center justify-center"
              >
                <Check size={9} />
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
              'p-0.5 rounded bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity',
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
