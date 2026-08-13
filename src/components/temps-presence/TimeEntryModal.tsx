'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { jourFerme } from '@/lib/school-year/jours-fermes'
import { creneauxDuJour, type CreneauSource, type ExceptionSource } from '@/lib/edt/creneaux-du-jour'
import type { VacationPeriod, JourFerie } from '@/types/database'
import { FloatInput, FloatSelect, FloatTextarea, FloatCheckbox, FloatButton } from '@/components/ui/FloatFields'
import type { TimeEntry } from './TempsPresenceClient'

interface PresenceType {
  id: string
  label: string
  code: string
  color: string
  is_absence: boolean
  /** `cours` | `activite` | `absence` pour les types RESERVES, sinon null. */
  reserved_kind?: string | null
}

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface Props {
  date: string
  entry: TimeEntry | null
  currentUserId: string
  canManage: boolean
  staffList: StaffMember[]
  presenceTypes: PresenceType[]
  existingEntries: TimeEntry[]
  onClose: () => void
  onSaved: () => void
  /** Vacances et jours feries : une saisie un jour ferme est signalee. */
  vacations?: VacationPeriod[]
  feries?: JourFerie[]
  /** Creneaux de l'annee : un remplacant se designe PAR CRENEAU. */
  slots?: CreneauSource[]
  exceptions?: ExceptionSource[]
  classesById?: Record<string, string>
  teachers?: TeacherRef[]
}

/**
 * Valeur sentinelle de « personne ne remplace ».
 *
 * NON VIDE, et c'est deliberé : sur un `FloatSelect`, une valeur vide fait
 * retomber le libelle flottant par-dessus le texte de l'option — les deux se
 * chevauchent, defaut constate a l'ecran. Elle permet aussi de distinguer
 * « pas encore repondu » (`''`) de « repondu : personne ».
 */
const AUCUN = '__aucun__'

/** Minutes entre deux horaires « HH:MM ». */
function minutesEntre(debut: string, fin: string): number {
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  return (fh * 60 + fm) - (dh * 60 + dm)
}

interface TeacherRef {
  id: string
  user_id: string | null
  first_name: string
  last_name: string
  civilite?: string | null
}

export default function TimeEntryModal({ date, entry, currentUserId, canManage, staffList, presenceTypes, existingEntries, onClose, onSaved, vacations = [], feries = [],
  slots = [], exceptions = [], classesById = {}, teachers = [] }: Props) {
  const supabase = createClient()
  const isEdit = !!entry

  // Jour de fermeture : on AVERTIT sans interdire. Une permanence pendant les
  // vacances ou une reunion un jour ferie existent ; bloquer priverait d'un cas
  // reel sans laisser de contournement, alors qu'un avertissement ignore ne
  // coute rien.
  const fermeture = jourFerme(date, vacations, feries)

  const defaultType = entry?.entry_type ?? ''

  const [profileId, setProfileId] = useState(entry?.profile_id ?? (canManage ? '' : currentUserId))
  const [entryType, setEntryType] = useState<string>(defaultType)
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? '12:00')
  const [isReplacement, setIsReplacement] = useState(entry?.is_replacement ?? false)
  const [replacedId, setReplacedId] = useState(entry?.replaced_profile_id ?? '')
  const [absenceReason, setAbsenceReason] = useState(entry?.absence_reason ?? '')
  // Creneaux manques. Une absence porte des HORAIRES, plus une demi-journee :
  // un enseignant ayant deux cours le matin et n'en manquant qu'un doit pouvoir
  // le dire, ce que « Matin » ne permettait pas.
  const [creneauxManques, setCreneauxManques] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = 'time-entry-modal-title'

  // Focus initial. Fermeture volontairement limitee a X / Annuler (pas de clic
  // hors modale ni Echap) pour ne pas perdre une saisie en cours.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const isAbsence = presenceTypes.find(p => p.code.toUpperCase() === entryType.toUpperCase())?.is_absence ?? false

  // On ne remplace qu'une personne ABSENTE ce jour : la liste « personne remplacee »
  // se limite aux membres ayant une saisie d'absence ce jour (+ la selection en cours
  // en edition, pour ne pas la perdre si les donnees ont change).
  const isAbsenceType = (code: string) =>
    presenceTypes.find(p => p.code.toUpperCase() === code.toUpperCase())?.is_absence ?? false
  const absentIds = new Set(
    existingEntries.filter(e => isAbsenceType(e.entry_type)).map(e => e.profile_id),
  )
  const replaceableStaff = staffList.filter(
    s => s.id !== profileId && (absentIds.has(s.id) || s.id === replacedId),
  )

  // ── PLUS D'EXCLUSION A LA JOURNEE ────────────────────────────────────────
  //
  // La modale ecartait toute personne ayant deja une saisie ce jour-la : reste
  // du modele en demi-journees, ou l'on ne pouvait etre absent qu'une fois par
  // jour. Depuis que l'absence porte sur un CRENEAU, un enseignant peut etre
  // absent le matin, present l'apres-midi, ou absent sur deux cours distincts
  // remplaces par deux personnes differentes — et l'ecarter apres la premiere
  // saisie empechait precisement la seconde.
  //
  // La seule contrainte reelle est le CHEVAUCHEMENT d'horaires, portee par la
  // base et signalee ici creneau par creneau. Une liste ne doit pas interdire
  // ce que la regle autorise.
  const selectableStaff = staffList

  // ── Creneaux du jour, et remplacement creneau par creneau ────────────────
  //
  // Un remplacement porte sur un COURS : les activites ne sont pas des creneaux
  // de classe propages a l'emploi du temps, elles se saisissent directement ici.
  const teacherIdDuProfil = teachers.find(t => t.user_id === profileId)?.id ?? ''

  const creneauxDuJourPersonne = creneauxDuJour(slots, exceptions, teacherIdDuProfil, date)
    .filter(cr => cr.slotType === 'cours')

  // Ceux effectivement manques : eux seuls appellent un remplacant.
  const creneauxConcernes = creneauxDuJourPersonne.filter(cr => creneauxManques.has(cr.slotId))

  const indisponibilite = (profilId: string, cr: { slotId: string; startTime: string; endTime: string }): string | null => {
    // La contrainte d'horaires ne vaut QUE pour les enseignants : eux seuls ne
    // peuvent pas etre a deux endroits. Le reste du personnel est present toute
    // la journee et depanne pendant son propre temps de travail.
    const estEnseignant = staffList.find(m => m.id === profilId)?.role === 'enseignant'
    const occupe = estEnseignant && existingEntries.some(e => {
      if (e.profile_id !== profilId) return false
      if (!e.start_time || !e.end_time) return false
      return cr.startTime < e.end_time.slice(0, 5) && cr.endTime > e.start_time.slice(0, 5)
    })
    if (occupe) return 'occupé'

    // Deja choisi a l'instant sur un autre creneau simultane, pas encore
    // enregistre : l'ecran doit le savoir avant la base.
    const dejaChoisi = estEnseignant && creneauxConcernes.some(autre =>
      autre.slotId !== cr.slotId
      && cr.startTime < autre.endTime && cr.endTime > autre.startTime
      && remplacants[autre.slotId] === profilId,
    )
    if (dejaChoisi) return 'déjà remplaçant'

    return null
  }

  // `''` = pas encore repondu, `AUCUN` = « personne ne remplace », choisi
  // explicitement. Distinguer les deux rend le champ obligatoire : sans cela,
  // ne pas repondre et repondre « personne » seraient le meme etat.
  const [remplacants, setRemplacants] = useState<Record<string, string>>({})

  useEffect(() => {
    setCreneauxManques(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, date])

  useEffect(() => {
    setRemplacants(prev => {
      const suivant: Record<string, string> = {}
      for (const cr of creneauxConcernes) suivant[cr.slotId] = prev[cr.slotId] ?? ''
      return suivant
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, date, creneauxManques, isAbsence])

  const isDirty = !isEdit || (
    profileId !== (entry?.profile_id ?? currentUserId) ||
    entryType !== defaultType ||
    startTime !== (entry?.start_time?.slice(0, 5) ?? '09:00') ||
    endTime !== (entry?.end_time?.slice(0, 5) ?? '12:00') ||
    isReplacement !== (entry?.is_replacement ?? false) ||
    replacedId !== (entry?.replaced_profile_id ?? '') ||
    absenceReason !== (entry?.absence_reason ?? '') ||

    notes !== (entry?.notes ?? '')
  )

  // Chaque creneau concerne doit avoir recu une reponse — un remplacant, ou
  // « Aucun membre ». On ne laisse pas partir une absence dont on ne sait pas
  // si les cours sont couverts.
  // Repondu ET valide : griser une option ne suffit pas, car un choix fait
  // AVANT peut devenir invalide apres — designer X sur un creneau le rend
  // indisponible sur le creneau simultane ou il etait deja selectionne.
  const remplacementsRepondus = creneauxConcernes.every(cr => {
    const choix = remplacants[cr.slotId]
    if (!choix) return false
    if (choix === AUCUN) return true
    return !indisponibilite(choix, cr)
  })

  // Une absence d'enseignant doit designer au moins un creneau manque : sans
  // creneau, elle ne dit rien. Pour qui n'a pas cours ce jour-la, les horaires
  // saisis a la main font foi, comme pour une presence.
  const absenceValide = !isAbsence
    || (creneauxDuJourPersonne.length > 0 ? creneauxManques.size > 0 : (!!startTime && !!endTime))

  const canSave = isDirty
    && (!canManage || !!profileId)
    && !!entryType
    && absenceValide
    && (isAbsence || (!!startTime && !!endTime))
    && (!isReplacement || !!replacedId)
    && (!isAbsence || remplacementsRepondus)

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    // Calcul duration
    let durationMinutes = 0
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      durationMinutes = (eh * 60 + em) - (sh * 60 + sm)
      if (durationMinutes <= 0) {
        setError('L\'heure de fin doit être supérieure à l\'heure de début')
        setSaving(false)
        return
      }
    }

    // Vérification chevauchement de créneaux pour la même personne
    if (!isAbsence && startTime && endTime) {
      const newStart = startTime
      const newEnd = endTime
      const overlap = existingEntries.find(e => {
        if (e.profile_id !== profileId) return false
        if (isEdit && e.id === entry!.id) return false
        if (!e.start_time || !e.end_time) return false // absences (sans horaire) ignorees
        const eStart = e.start_time.slice(0, 5)
        const eEnd = e.end_time.slice(0, 5)
        return newStart < eEnd && newEnd > eStart
      })
      if (overlap) {
        const s = staffList.find(st => st.id === profileId)
        const name = s ? `${s.last_name} ${s.first_name}` : 'Cette personne'
        setError(`${name} a déjà un créneau de ${overlap.start_time?.slice(0, 5)} à ${overlap.end_time?.slice(0, 5)} ce jour. Les créneaux ne peuvent pas se chevaucher.`)
        setSaving(false)
        return
      }
    }

    const commun = {
      profile_id: profileId,
      entry_date: date,
      entry_type: entryType,
      is_replacement: isReplacement,
      replaced_profile_id: isReplacement && replacedId ? replacedId : null,
      absence_reason: isAbsence ? absenceReason : null,
      notes: notes || null,
      recorded_by: currentUserId,
    }

    // UNE LIGNE PAR CRENEAU MANQUE. Une absence porte desormais des horaires :
    // deux cours manques le meme jour font deux lignes, chacune avec sa duree
    // reelle. Pour qui n'a pas cours ce jour-la (secretariat, entretien), les
    // horaires saisis a la main font foi — une seule ligne, comme avant.
    const lignes = isAbsence && creneauxConcernes.length > 0
      ? creneauxConcernes.map(cr => ({
          ...commun,
          start_time: cr.startTime,
          end_time: cr.endTime,
          duration_minutes: minutesEntre(cr.startTime, cr.endTime),
        }))
      : [{
          ...commun,
          start_time: startTime,
          end_time: endTime,
          duration_minutes: durationMinutes,
        }]

    const { error: err } = isEdit
      ? await supabase.from('staff_time_entries').update(lignes[0]).eq('id', entry!.id)
      : await supabase.from('staff_time_entries').insert(lignes)

    if (err) { setSaving(false); setError(err.message); return }

    // ── LE REMPLACEMENT CREE DIRECTEMENT LES HEURES DU REMPLACANT ─────────
    //
    // Une saisie faite dans temps de presence est un remplacement DIRECT : la
    // personne habilitee qui l'enregistre atteste du fait, la ligne est donc
    // valide d'emblee. Rien a valider ensuite dans l'emploi du temps — c'est ce
    // qui distingue ce cas du remplacement de LONGUE DUREE declare sur la fiche
    // classe, ou le remplacant valide ses creneaux comme un titulaire.
    //
    // Consequence utile : le remplacant n'a pas besoin d'une fiche enseignant.
    // La direction ou la secretaire depanne quand aucun enseignant n'est libre,
    // et ses heures sont comptees comme celles de n'importe qui.
    if (isAbsence && creneauxConcernes.length > 0) {
      const lignesRemplacement = creneauxConcernes
        .map(cr => {
          const choix = remplacants[cr.slotId]
          if (!choix || choix === AUCUN) return null
          // Type COURS, lu depuis les types RESERVES — un remplacement porte
          // toujours sur un cours. Ecrire le code en dur le rendrait faux des
          // qu'un etablissement renomme les siens.
          const type = presenceTypes.find(pt => pt.reserved_kind === 'cours')
          if (!type) return null
          return {
            profile_id: choix,
            entry_date: date,
            entry_type: type.code,
            start_time: cr.startTime,
            end_time: cr.endTime,
            duration_minutes: minutesEntre(cr.startTime, cr.endTime),
            is_replacement: true,
            replaced_profile_id: profileId,
            absence_reason: null,
            notes: null,
            recorded_by: currentUserId,
          }
        })
        .filter((l): l is NonNullable<typeof l> => l !== null)

      if (lignesRemplacement.length) {
        const { error: remErr } = await supabase.from('staff_time_entries').insert(lignesRemplacement)
        if (remErr) {
          setSaving(false)
          setError('Absence enregistrée, mais les heures du remplaçant ont échoué : ' + remErr.message)
          return
        }
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 outline-none"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
          <h3 id={titleId} className="text-sm font-bold text-secondary-800">
            {isEdit ? 'Modifier la saisie' : 'Nouvelle saisie'}
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 rounded-lg hover:bg-warm-100 text-warm-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {fermeture && (
            <p
              role="status"
              className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5"
            >
              {fermeture.titre}{fermeture.label ? ` · ${fermeture.label}` : ''}
            </p>
          )}

          <p className="text-xs text-warm-700 capitalize">{dateLabel}</p>

          {/* Type (choisi en premier : conditionne la liste des membres) */}
          <div className="relative border border-warm-300 rounded-lg px-3 pt-6 pb-2.5">
            <span className="absolute top-1.5 left-3 text-[10px] font-semibold tracking-wide uppercase text-warm-700 pointer-events-none select-none">Type<span className="text-red-400 ml-0.5">*</span></span>
            {/* Grille 2 colonnes : tous les boutons de largeur identique, label
                sur une ligne (le flex-wrap etirait les rangees differemment et
                faisait deborder les libelles longs comme « ADMINISTRATIF »). */}
            <div className="grid grid-cols-2 gap-2">
              {presenceTypes.map(pt => {
                const selected = entryType.toUpperCase() === pt.code.toUpperCase()
                return (
                  <label key={pt.id} className="block">
                    <input
                      type="radio"
                      name="entry_type"
                      value={pt.code}
                      checked={selected}
                      onChange={() => {
                        // Le membre reste selectionne : depuis que l'absence
                        // porte sur un creneau, avoir deja une saisie ce jour-la
                        // n'a plus rien d'incompatible. Seul le chevauchement
                        // d'horaires l'est, et il se verifie ailleurs.
                        setEntryType(pt.code)
                      }}
                      className="sr-only"
                    />
                    <span
                      className={`block text-center text-xs font-semibold py-1.5 px-2 rounded-md border cursor-pointer transition-all truncate ${!selected ? 'bg-white border-warm-300 text-warm-700 hover:border-warm-400' : ''}`}
                      style={selected ? { backgroundColor: pt.color, color: '#fff', borderColor: pt.color } : undefined}
                    >
                      {pt.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Membre (filtre selon le type : une personne absente n'est pas saisissable
              en presence, et une personne presente n'est pas saisissable en absence) */}
          {canManage ? (
            <FloatSelect
              label="MEMBRE ÉQUIPE"
              required
              disabled={!entryType}
              value={profileId}
              onChange={e => {
                const val = e.target.value
                setProfileId(val)
                if (val && val === replacedId) setReplacedId('')
              }}
            >
              <option value=""></option>
              {selectableStaff.map(s => (
                <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
              ))}
            </FloatSelect>
          ) : (
            <p className="text-xs text-warm-700">
              <span className="font-bold">{staffList.find(s => s.id === currentUserId)?.last_name} {staffList.find(s => s.id === currentUserId)?.first_name}</span>
            </p>
          )}

          {/* Horaires (sauf absence) */}
          {!isAbsence && (
            <div className="grid grid-cols-2 gap-3">
              <FloatInput
                label="DÉBUT"
                required
                type="time"
                value={startTime}
                onChange={e => {
                  setStartTime(e.target.value)
                  if (endTime && e.target.value && endTime <= e.target.value) setEndTime('')
                }}
              />
              <FloatInput
                label="FIN"
                required
                type="time"
                value={endTime}
                onChange={e => { if (!startTime || e.target.value > startTime) setEndTime(e.target.value) }}
                min={startTime || undefined}
                disabled={!startTime}
              />
            </div>
          )}

          {/* Remplacement (sauf absence) */}
          {!isAbsence && (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <FloatCheckbox
                  variant="compact"
                  label="EN REMPLACEMENT DE"
                  checked={isReplacement}
                  onChange={val => { setIsReplacement(val); if (!val) setReplacedId('') }}
                />
                {isReplacement && <span className="text-red-400 text-xs">*</span>}
              </div>
              {isReplacement && (
                replaceableStaff.length === 0 ? (
                  <p role="alert" className="text-xs text-warm-700 bg-warm-50 border border-warm-200 rounded-lg px-3 py-2">
                    Aucun membre marqué absent ce jour. Enregistrez d'abord l'absence de la personne remplacée.
                  </p>
                ) : (
                  <FloatSelect
                    label="Personne remplacée"
                    value={replacedId}
                    onChange={e => setReplacedId(e.target.value)}
                  >
                    <option value=""></option>
                    {replaceableStaff.map(s => (
                      <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                    ))}
                  </FloatSelect>
                )
              )}
            </div>
          )}

          {/* CRENEAUX MANQUES — remplace le selecteur Journee / Matin /
              Apres-midi, supprime : depuis qu'un remplacant se designe sur le
              creneau, c'est LUI la maille d'une absence. Un enseignant ayant
              deux cours le matin et n'en manquant qu'un ne pouvait pas le dire.

              Meme langage visuel que les anciens boutons de periode — memes
              classes, meme etat presse — mais rempli du contenu reel. */}
          {isAbsence && creneauxDuJourPersonne.length > 0 && (
            <div className="relative border border-warm-300 rounded-lg px-3 pt-6 pb-2.5">
              <span className="absolute top-1.5 left-3 text-[10px] font-semibold tracking-wide uppercase text-warm-700 pointer-events-none select-none">
                Créneaux manqués <span className="text-red-500">*</span>
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Créneaux manqués">
                {creneauxDuJourPersonne.map(cr => {
                  const choisi = creneauxManques.has(cr.slotId)
                  return (
                    <button
                      key={cr.slotId}
                      type="button"
                      onClick={() => setCreneauxManques(prev => {
                        const suivant = new Set(prev)
                        if (suivant.has(cr.slotId)) suivant.delete(cr.slotId)
                        else suivant.add(cr.slotId)
                        return suivant
                      })}
                      aria-pressed={choisi}
                      className={`text-center text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${choisi ? 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)] border-[var(--brand-surface)] dark:border-[var(--brand-accent)]' : 'bg-white border-warm-300 text-warm-700 hover:border-warm-400'}`}
                    >
                      {classesById[cr.classId] ?? 'Classe'} · {cr.startTime}-{cr.endTime}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sans cours ce jour-la (secretariat, entretien, ou enseignant hors
              creneau), l'absence se saisit comme une presence : des horaires. */}
          {isAbsence && creneauxDuJourPersonne.length === 0 && profileId && (
            <div className="grid grid-cols-2 gap-3">
              <FloatInput label="DÉBUT" required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              <FloatInput label="FIN"   required type="time" value={endTime}   onChange={e => setEndTime(e.target.value)} />
            </div>
          )}

          {/* Motif + remplacant : une absence et sa couverture se saisissent
              ENSEMBLE. Separer les deux gestes, c'est accepter qu'on oublie le
              second — et sans lui le remplacant ne voit pas le creneau. */}
          {isAbsence && (
            <FloatInput
              label="MOTIF"
              value={absenceReason}
              onChange={e => setAbsenceReason(e.target.value)}
              placeholder="Maladie, congé..."
            />
          )}

          {/* Remplacement, CRENEAU PAR CRENEAU.
              Construction RECOPIEE du bloc « Periode » juste au-dessus —
              meme bordure, meme rayon, libelle en coin — et non redessinee de
              memoire : deux encadres voisins qui different d'une nuance et
              d'un rayon se voient immediatement, et donnent a l'ecran un air
              bricole. Faute deja commise le 16 juillet sur un FloatSelect.

              Le bloc s'affiche TOUJOURS sur une absence, meme sans cours ce
              jour-la : ne rien afficher se lit comme un ecran casse. */}
          {isAbsence && (
            <div className="relative border border-warm-300 rounded-lg px-3 pt-6 pb-2.5 space-y-2.5">
              <span className="absolute top-1.5 left-3 text-[10px] font-semibold tracking-wide uppercase text-warm-700 pointer-events-none select-none">
                Remplacement{creneauxConcernes.length > 0 && <span className="text-red-500"> *</span>}
              </span>

              {creneauxConcernes.length === 0 ? (
                <p className="text-xs text-warm-700 italic">
                  {!profileId
                    ? 'Choisissez un membre pour voir ses cours de ce jour.'
                    : creneauxDuJourPersonne.length === 0
                      ? "Aucun cours ce jour : il n'y a rien à faire remplacer."
                      : 'Sélectionnez le ou les créneaux manqués ci-dessus.'}
                </p>
              ) : creneauxConcernes.map(cr => (
                <div key={cr.slotId}>
                  <p className="text-[11px] text-warm-700 mb-1">
                    <span className="font-semibold text-secondary-800">{classesById[cr.classId] ?? 'Classe'}</span>
                    {' · '}{cr.startTime}-{cr.endTime}
                  </p>
                  <FloatSelect
                    label="REMPLACÉ PAR"
                    value={remplacants[cr.slotId] ?? ''}
                    onChange={e => setRemplacants(r => ({ ...r, [cr.slotId]: e.target.value }))}
                  >
                    {/* Placeholder SANS TEXTE, comme « Membre equipe ». Le libelle
                        flottant ne monte que si la valeur est non vide
                        (`hasValue` dans FloatSelect) : une option porteuse de
                        texte se retrouve donc ecrite SOUS le libelle. */}
                    <option value="" disabled hidden></option>
                    <option value={AUCUN}>Aucun membre</option>
                    {/* TOUS les membres actifs sauf l'absent — `staffList`
                        exclut deja admin, parent et super_admin. La direction ou
                        la secretaire depanne quand aucun enseignant n'est libre :
                        la saisie etant DIRECTE, aucune fiche enseignant n'est
                        requise. */}
                    {staffList
                      .filter(m => m.id !== profileId)
                      .map(m => {
                        const empeche = indisponibilite(m.id, cr)
                        return (
                          <option key={m.id} value={m.id} disabled={!!empeche}>
                            {m.last_name} {m.first_name}
                            {empeche ? ` · ${empeche}` : ''}
                          </option>
                        )
                      })}
                  </FloatSelect>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <FloatTextarea
            label="NOTES"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Commentaire optionnel..."
          />

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-warm-100">
          <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
          <div className="flex-1" />
          <FloatButton variant="secondary" type="button" onClick={onClose}>Annuler</FloatButton>
          <FloatButton
            variant={isEdit ? 'edit' : 'submit'}
            type="button"
            onClick={handleSave}
            loading={saving}
            disabled={!canSave}
          >
            {isEdit ? 'Modifier' : 'Valider'}
          </FloatButton>
        </div>
      </div>
    </div>
  )
}
