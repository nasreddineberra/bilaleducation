'use client'

import { useDraggable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import { Check, CalendarDays, MoreVertical, Ban } from 'lucide-react'
import type { CSSProperties } from 'react'
import Tooltip from '@/components/ui/Tooltip'
import type { ResolvedSlot } from './EmploiDuTempsClient'
import { nomCourtEnseignant, nomCompletEnseignant as nomComplet, genreCivilite } from '@/lib/teachers/nom'
import { accordGenre } from '@/lib/texte/genre'
import { dureeMinutes } from '@/lib/edt/temps'
import { intituleCreneau, libelleSalle } from '@/lib/edt/intitule'

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
  /** Le titulaire est remplace sur cette seance : nom du remplacant (message rouge). */
  remplaceParNom?: string | null
  /** Le connecte est le REMPLACANT sur cette seance : affiche le titulaire remplace. */
  remplacementDe?: boolean
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

export default function SlotCapsule({
  slot, style, viewMode, canEdit, canValidate, isTeacher, isOwnSlot = false, remplaceParNom = null, remplacementDe = false,
  validated, groupSize = 1, draggable: isDraggableEnabled = false, menuActive = false, onValidate, onCancelValidation, onContextMenu, onKeyMenu,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slot-${slot.sourceSlotId}`,
    data: { type: 'existing-slot', slot },
    disabled: !isDraggableEnabled,
  })

  // Seance ANNULEE : toutes ses informations restent, sur fond gris, avec un gros
  // « ANNULÉ » au centre (demande du 27/10) ; ni validation ni marqueur d'absence.
  // Reactivable depuis le menu.
  const annulee = !!slot.annulee
  // Un remplacant d'absence sans fiche enseignant assure la seance : ce n'est
  // pas un « Prof non affecté ».
  const noTeacher = !slot.teacher_id && !slot.remplacant

  // Densité : la capsule perd des lignes à mesure qu'elle rétrécit, au lieu de
  // les tronquer toutes à deux caractères. Le détail reste accessible en
  // infobulle (et dans l'`aria-label`, inchangé).
  //   1-2 créneaux : tout        3-4 : sans salle ni horaire        5+ : nom seul
  const minimal = groupSize >= 5

  // ── ET LE MÊME RAISONNEMENT EN HAUTEUR ────────────────────────────────
  // `dense`/`minimal` ne regardaient que `groupSize`, c'est-à-dire la LARGEUR :
  // un créneau de 15 min recevait exactement le même contenu qu'un créneau de
  // trois heures. Mesuré le 03/10 sur une capture : six lignes empilées font
  // ~70 px pour ~51 px utiles sur une heure — le conteneur étant en `flex` avec
  // `overflow-hidden`, les lignes se compriment et le HAUT sort du cadre. Le
  // titre du cours était donc invisible, et le nom de la classe coupé en deux.
  //
  // L'amplitude de la grille est FIXE (7h-19h) : une heure vaut toujours un
  // douzième de la colonne, la durée est donc un critère fiable sans mesurer
  // quoi que ce soit.
  //
  // Au-delà du seuil on ne rogne pas, on CHOISIT : la classe et l'horaire, rien
  // d'autre (décision utilisateur). Tout le reste passe en infobulle.
  const court = dureeMinutes(slot.start_time, slot.end_time) <= 60
  // La validation ne remplace plus la couleur : elle s'ajoute (la teinte reste
  // celle de la catégorie, sinon un cours validé et une activité validée
  // deviendraient identiques).
  const colorClass = clsx(
    SLOT_COLORS[slot.slot_type] ?? SLOT_COLORS.cours,
    validated && 'edt-slot-validated',
  )
  // Validation : le personnel gestionnaire (canEdit) peut valider tout créneau ;
  // un enseignant ne peut valider que SON propre créneau.
  const showValidation = !annulee && (canEdit || (isTeacher && isOwnSlot)) && canValidate && slot.slot_type !== 'pause'

  // ENSEIGNANT ABSENT, RIEN DE DECIDE (lot 3) : le creneau reste VISIBLE — il
  // a bien lieu, et son titulaire doit savoir ce qu'il manque — mais la
  // validation est refusee. On la remplace par une marque inerte plutot que de
  // la retirer : un bouton qui disparait se lit comme un defaut, une marque qui
  // explique se lit comme une regle. La base refuse de toute facon
  // (`valider_seance`) ; ceci l'annonce AVANT le clic.
  const absent = !annulee && !!slot.aDecider

  // LE BADGE D'ABSENCE N'EST PAS UN CONTROLE DE VALIDATION, c'est un MARQUEUR
  // D'ETAT — il ne depend donc pas de `canValidate`, la garde de date qui
  // n'autorise le ✓ qu'a partir du jour de la seance. Sans cette distinction,
  // une absence FUTURE (conge pose a l'avance) afficherait les hachures sans un
  // mot d'explication : c'est le badge qui porte l'infobulle.
  const marqueurAbsence = absent && (canEdit || (isTeacher && isOwnSlot)) && slot.slot_type !== 'pause'

  // Libellé du créneau — cours, classe/prof selon la vue, salle, horaire, statut.
  //
  // DEUX LECTURES, DEUX FORMES. L'`aria-label` reste d'un seul tenant : les
  // virgules y marquent les pauses d'un lecteur d'écran, et « de 09:00 à 10:00 »
  // s'entend mieux qu'un intervalle. L'infobulle, elle, est LUE DES YEUX : une
  // information par ligne, sans ponctuation de liaison (demande du 03/10).
  // Les deux disent la même chose, elles ne se lisent pas de la même façon.
  // Matiere d'un cours, nom d'une activite, a defaut le type (`intituleCreneau`).
  const libelleCours = intituleCreneau(slot)

  // ETAT DE LA SEANCE (28/10) : un libelle centre en hauteur dans la capsule, et
  // repris dans l'infobulle unique. Accord sur la civilite du titulaire.
  const genreTitulaire = genreCivilite(slot.teachers?.civilite)
  const pasDePause = slot.slot_type !== 'pause'
  const etat: { texte: string; ton: 'rouge' | 'ambre' } | null =
    annulee || !pasDePause ? null
    : noTeacher && viewMode !== 'teacher' ? { texte: 'Prof non affecté', ton: 'rouge' }
    : absent ? { texte: `${accordGenre(genreTitulaire, 'Absent', 'Absente', 'Absence')} · à décider`, ton: 'ambre' }
    : remplaceParNom ? {
        texte: accordGenre(genreTitulaire, `Remplacé par ${remplaceParNom}`, `Remplacée par ${remplaceParNom}`, `Remplacement : ${remplaceParNom}`),
        ton: 'rouge',
      }
    : remplacementDe && slot.teachers ? { texte: `Remplacement de ${nomCourtEnseignant(slot.teachers)}`, ton: 'rouge' }
    : null

  const infoLignes: string[] = []
  if (viewMode !== 'class' && slot.classes) infoLignes.push(slot.classes.name)
  infoLignes.push(libelleCours)
  if (annulee) infoLignes.unshift('Séance annulée')
  if (viewMode !== 'teacher') infoLignes.push(noTeacher ? 'Prof non affecté' : nomComplet(slot.teachers))
  if (slot.rooms) infoLignes.push(libelleSalle(slot.rooms.name))
  infoLignes.push(`${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`)
  if (etat && etat.texte !== 'Prof non affecté') infoLignes.push(etat.texte)
  if (validated) infoLignes.push('Présence validée')

  const ariaParts: string[] = []
  if (viewMode !== 'class' && slot.classes) ariaParts.push(slot.classes.name)
  ariaParts.push(libelleCours)
  if (annulee) ariaParts.unshift('séance annulée')
  if (viewMode !== 'teacher') ariaParts.push(noTeacher ? 'Prof non affecté' : nomComplet(slot.teachers))
  if (slot.rooms) ariaParts.push(libelleSalle(slot.rooms.name))
  ariaParts.push(`de ${slot.start_time.slice(0, 5)} à ${slot.end_time.slice(0, 5)}`)
  if (etat && etat.texte !== 'Prof non affecté') ariaParts.push(etat.texte)
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
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)] focus-visible:ring-offset-1',
        menuActive && 'ring-2 ring-secondary-600 ring-offset-1 shadow-lg',
        colorClass,
        // Grise neutre (jeton du champ verrouille) : prime sur la couleur de
        // categorie, posee a specificite nulle (`:where`).
        annulee && 'bg-[var(--champ-verrou)] border-warm-300 text-warm-700',
        // L'absence se marque par des HACHURES et non par une baisse d'opacite
        // (qui ferait tomber le contraste des libelles). Voir `.edt-slot-absent`.
        absent && 'edt-slot-absent',
        // Prof non affecte : rouge, comme « Sans titulaire » sur la fiche classe ;
        // l'ambre en pointilles signale deja une seance MODIFIEE.
        noTeacher && !annulee && 'border-2 border-dashed border-red-400',
        !noTeacher && !annulee && slot.isModified && MODIFIED_BORDER,
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
      {/* UNE SEULE INFOBULLE (28/10) : toutes les informations de la seance, sur
          toute la capsule et quelle que soit sa taille ; les libelles d'etat n'en
          portent plus. Le wrapper du Tooltip est `inline-flex` : sans `w-full` le
          contenu ne remplirait pas la capsule. */}
      <Tooltip
        content={
          <span className="flex flex-col gap-0.5 text-left">
            {infoLignes.map((l, i) => <span key={i}>{l}</span>)}
          </span>
        }
        className="h-full w-full align-bottom"
        maxWidth="max-w-none"
      >
        <div className={clsx('h-full flex flex-col overflow-hidden', minimal ? 'px-1 py-0.5' : 'px-1.5 py-0.5')}>
          {/* ORDRE (demande du 27/10) : classe, intitule, enseignant, horaire —
              quelle que soit la duree. La classe est masquee en vue classe
              (redondante), l'enseignant en vue enseignant. */}
          {viewMode !== 'class' && slot.classes && (
            <div className={clsx('font-bold leading-tight truncate', minimal ? 'text-[9px]' : 'text-[10px]')}>
              {slot.classes.name}
            </div>
          )}

          {/* Intitule : matiere d'un cours, nom d'une activite, sinon le type. Sur un
              creneau court, la salle le rejoint sur la meme ligne (place). */}
          <div className={clsx('leading-tight', minimal ? 'text-[8px] line-clamp-2' : 'text-[9px] truncate')}>
            {libelleCours}{court && !minimal && slot.rooms ? ` · ${libelleSalle(slot.rooms.name)}` : ''}
          </div>

          {/* Salle sous l'intitule (demande du 27/10), sa propre ligne sur un creneau
              long ; seulement en infobulle quand 5 creneaux et plus se partagent la colonne. */}
          {slot.rooms && !court && !minimal && (
            <div className="text-[9px] leading-tight truncate">
              {libelleSalle(slot.rooms.name)}
            </div>
          )}

          {/* Enseignant (vues globale / classe), en gras : « Mme NOM » sur une ligne,
              quelle que soit la duree (decision du 27/10). Le nom complet, prenom
              compris, reste dans l'infobulle. */}
          {viewMode !== 'teacher' && !noTeacher && slot.teachers && !minimal && (
            <div className="text-[9px] leading-tight font-bold truncate">
              {nomCourtEnseignant(slot.teachers)}
            </div>
          )}

          {/* Etat (Prof non affecte, absent a decider, remplacement) : centre en
              hauteur dans l'espace libre entre les informations et l'horaire, AVANT
              l'horaire pour rester visible meme quand la capsule est courte. Deux
              lignes plutot qu'une coupure ; « Prof non affecté » s'affiche quelle
              que soit la place, c'est une anomalie a voir. */}
          {etat && (
            <div className="flex-1 min-h-0 flex items-center">
              <div className={clsx('leading-tight font-bold line-clamp-2 min-w-0',
                etat.ton === 'rouge' ? 'text-red-700' : 'text-amber-700',
                minimal ? 'text-[8px]' : 'text-[9px]')}>
                {etat.texte}
              </div>
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

      {/* Tampon « ANNULÉ » au centre, par-dessus les informations ; son propre fond
          gris le garde lisible sur une seance courte ou il chevauche une ligne. */}
      {annulee && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={clsx(
            'rounded px-1.5 bg-[var(--champ-verrou)] font-extrabold tracking-widest text-red-700',
            minimal ? 'text-[10px]' : 'text-sm',
          )}>
            ANNULÉ
          </span>
        </div>
      )}

      {/* Validation impossible : la personne est absente ce demi-jour */}
      {marqueurAbsence && (
        <div className="absolute bottom-1 right-1" onClick={e => e.stopPropagation()}>
          <Tooltip content="Enseignant absent, rien n’est décidé pour cette séance (Absences enseignants). La présence ne peut pas être validée.">
            <span
              role="img"
              aria-label={`Présence non validable, enseignant absent, séance à décider : ${ariaLabel}`}
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
                className="w-[15px] h-[15px] rounded bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)] text-white dark:text-[var(--brand-surface-2)] hover:bg-red-500 dark:hover:bg-red-500 dark:hover:text-white transition-colors flex items-center justify-center"
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
