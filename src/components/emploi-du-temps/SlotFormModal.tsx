'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { FloatSelect, FloatInput, FloatButton } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { nomEnseignantCivilite } from '@/lib/teachers/nom'
import { titulaireActuel } from '@/lib/teachers/titulaire'
import { NOM_ACTIVITE_MAX } from '@/lib/edt/intitule'

/**
 * NOUVELLE SEANCE PONCTUELLE (EDT).
 *
 * Depuis la conception du 27/10, l'emploi du temps ne cree que des seances
 * ponctuelles (une serie se cree dans la fiche classe) et ne modifie plus ni
 * l'horaire ni l'enseignant d'une seance ; le lot 5 (29/10) a retire le code
 * d'edition devenu mort. L'enseignant n'est jamais saisi : il se DEDUIT du
 * titulaire en poste a la date (`lib/edt/seance.ts`).
 */

interface SlotData {
  id: string
  class_id: string
  room_id: string | null
  is_recurring: boolean
  day_of_week: number | null
  slot_date: string | null
  start_time: string
  end_time: string
  effective_from?: string | null
  effective_until?: string | null
}

interface ClassData {
  id: string
  name: string
  room_id?: string | null
  cotisation_types?: { label: string } | null
  class_teachers: {
    teacher_id: string
    is_main_teacher: boolean | null
    effective_until?: string | null
    teachers: { id: string; first_name: string; last_name: string; civilite?: string | null }
  }[]
}

interface RoomData {
  id: string
  name: string
  room_type: string
  capacity: number | null
}

const SLOT_TYPES = [
  { value: 'cours', label: 'Cours' },
  { value: 'activite', label: 'Activité' },
]

interface Props {
  prefillDay: number | null
  prefillTime: string | null
  prefillDate: string | null
  prefillClassId: string
  weekDayDates: Record<number, string>
  classes: ClassData[]
  /** Salles de cours libres sur un creneau (date, debut, fin, seance exclue, salle actuelle). */
  sallesPour: (date: string, debut: string, fin: string, exclureSlotId?: string | null, salleActuelle?: string | null) => RoomData[]
  /** Unites d'enseignement du referentiel, dans leur ordre : matiere d'un cours. */
  matieres: { id: string; nom_fr: string }[]
  existingSlots: SlotData[]
  vacations?: { start_date: string; end_date: string; label: string }[]
  onSave: (data: {
    class_id: string
    unite_enseignement_id: string | null
    libelle: string | null
    room_id: string | null
    slot_date: string
    start_time: string
    end_time: string
    slot_type: string
  }) => void | Promise<void>
  onClose: () => void
}

export default function SlotFormModal({
  prefillDay, prefillTime, prefillDate, prefillClassId,
  weekDayDates, classes, sallesPour, matieres, existingSlots, vacations = [], onSave, onClose,
}: Props) {
  const initialClass = classes.find(c => c.id === prefillClassId)

  const [classId, setClassId] = useState(prefillClassId ?? '')
  const [roomId, setRoomId] = useState(initialClass?.room_id ?? '')
  const [slotType, setSlotType] = useState('cours')
  // Facultatifs : matiere d'un cours, nom d'une activite (chacun a sa place).
  const [ueId, setUeId] = useState('')
  const [libelle, setLibelle] = useState('')
  const [startTime, setStartTime] = useState(prefillTime ?? '')
  const [endTime, setEndTime] = useState(prefillTime ? addHour(prefillTime) : '')
  const [saving, setSaving] = useState(false)
  const [slotDate, setSlotDate] = useState<string>(
    prefillDate ?? (prefillDay !== null && prefillDay !== undefined ? (weekDayDates[prefillDay] ?? '') : '')
  )

  // Règle projet : fermeture par X / Annuler uniquement (ni Échap, ni clic hors
  // fenêtre) — une saisie de créneau ne doit pas se perdre sur une touche.

  const selectedClass = classes.find(c => c.id === classId)

  // Salle de la classe proposee a son choix.
  useEffect(() => {
    if (selectedClass?.room_id) setRoomId(selectedClass.room_id)
  }, [classId, selectedClass])

  // Vérifier si une date est en vacances
  const isVacationDate = useCallback((dateStr: string) => {
    for (const v of vacations) {
      if (dateStr >= v.start_date && dateStr <= v.end_date) return true
    }
    return false
  }, [vacations])

  const dateInVacation = slotDate ? isVacationDate(slotDate) : false

  const isValid = !!classId && !!startTime && !!endTime && startTime < endTime && !!slotDate && !dateInVacation

  // Conflits avec les seances de la meme date : seances ponctuelles, et series
  // du meme jour de semaine qui couvrent la date.
  const conflicts = useMemo(() => {
    const msgs: string[] = []
    if (!classId || !startTime || !endTime || !slotDate) return msgs
    const jour = new Date(slotDate + 'T00:00').getDay()
    for (const s of existingSlots) {
      const memeDate = s.is_recurring
        ? s.day_of_week === jour
          && (!s.effective_from || s.effective_from <= slotDate)
          && (!s.effective_until || s.effective_until >= slotDate)
        : s.slot_date === slotDate
      if (!memeDate) continue
      const overlaps = s.start_time < endTime && s.end_time > startTime
      if (overlaps && s.class_id === classId) {
        msgs.push(`Conflit classe : ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`)
      }
      if (overlaps && s.room_id === roomId && roomId) {
        msgs.push(`Conflit salle : même créneau`)
      }
    }
    return msgs
  }, [existingSlots, classId, roomId, slotDate, startTime, endTime])

  const handleSubmit = async () => {
    if (!isValid) return
    setSaving(true)
    await onSave({
      class_id: classId,
      unite_enseignement_id: slotType === 'cours' ? (ueId || null) : null,
      libelle: slotType === 'activite' ? (libelle.trim() || null) : null,
      room_id: roomId || null,
      slot_date: slotDate,
      start_time: startTime,
      end_time: endTime,
      slot_type: slotType,
    })
    setSaving(false)
  }

  return (
    <FormModal
      title="Nouvelle séance ponctuelle"
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={<>
        <span className="text-xs text-red-700"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton variant="secondary" type="button" onClick={onClose}>Annuler</FloatButton>
        <FloatButton variant="submit" type="button" onClick={handleSubmit} disabled={!isValid} loading={saving}>
          Valider
        </FloatButton>
      </>}
    >
      <div>
        <span className={LIBELLE_CHOIX}>Type</span>
        <div className="mt-1">
          <FiltreSwitch
            ariaLabel="Type de créneau"
            actif={slotType}
            onChange={setSlotType}
            options={SLOT_TYPES.map(st => ({ valeur: st.value, libelle: st.label }))}
          />
        </div>
      </div>

      {/* Intitule : matiere d'un cours, nom d'une activite. */}
      {slotType === 'cours' ? (
        <FloatSelect label="Matière" value={ueId} onChange={e => setUeId(e.target.value)}>
          <option value=""></option>
          {matieres.map(m => <option key={m.id} value={m.id}>{m.nom_fr}</option>)}
        </FloatSelect>
      ) : (
        <FloatInput
          label="Nom de l'activité"
          value={libelle}
          maxLength={NOM_ACTIVITE_MAX}
          onChange={e => setLibelle(e.target.value)}
        />
      )}

      <FloatSelect
        label="Classe"
        required
        value={classId}
        onChange={e => setClassId(e.target.value)}
      >
        <option value=""></option>
        {classes.map(c => {
          const mainT = titulaireActuel(c.class_teachers)
          const teacher = mainT?.teachers ? nomEnseignantCivilite(mainT.teachers) : ''
          const infoParts = [teacher, c.cotisation_types?.label].filter(Boolean)
          return (
            <option key={c.id} value={c.id}>
              {c.name}{infoParts.length > 0 ? ` · ${infoParts.join(' · ')}` : ''}
            </option>
          )
        })}
      </FloatSelect>

      <FloatSelect
        label="Salle"
        value={roomId}
        onChange={e => setRoomId(e.target.value)}
      >
        <option value=""></option>
        {sallesPour(slotDate, startTime, endTime, null, roomId || null).map(r => (
          <option key={r.id} value={r.id}>
            {r.name}{r.capacity ? ` (${r.capacity} places)` : ''}
          </option>
        ))}
      </FloatSelect>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <FloatInput
            label="Date"
            required
            type="date"
            value={slotDate}
            onChange={e => setSlotDate(e.target.value)}
          />
          {dateInVacation && (
            <p role="alert" className="text-xs text-red-700 mt-1">Cette date tombe pendant les vacances scolaires</p>
          )}
        </div>
        <FloatInput
          label="Début"
          required
          type="time"
          value={startTime}
          onChange={e => {
            setStartTime(e.target.value)
            if (endTime && e.target.value && endTime <= e.target.value) setEndTime('')
          }}
        />
        <FloatInput
          label="Fin"
          required
          type="time"
          value={endTime}
          onChange={e => { if (!startTime || e.target.value > startTime) setEndTime(e.target.value) }}
          min={startTime || undefined}
          disabled={!startTime}
        />
      </div>

      {conflicts.length > 0 && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          {conflicts.map((c, i) => (
            <div key={i}>{c}</div>
          ))}
        </div>
      )}
    </FormModal>
  )
}

const LIBELLE_CHOIX = 'text-xs font-semibold text-warm-700 uppercase tracking-wide'

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
