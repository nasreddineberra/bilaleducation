'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FloatInput, FloatSelect, FloatTextarea, FloatCheckbox, FloatButton } from '@/components/ui/FloatFields'
import type { TimeEntry } from './TempsPresenceClient'

interface PresenceType {
  id: string
  label: string
  code: string
  color: string
  is_absence: boolean
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
}

export default function TimeEntryModal({ date, entry, currentUserId, canManage, staffList, presenceTypes, existingEntries, onClose, onSaved }: Props) {
  const supabase = createClient()
  const isEdit = !!entry

  const defaultType = entry?.entry_type ?? ''

  const [profileId, setProfileId] = useState(entry?.profile_id ?? (canManage ? '' : currentUserId))
  const [entryType, setEntryType] = useState<string>(defaultType)
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? '12:00')
  const [isReplacement, setIsReplacement] = useState(entry?.is_replacement ?? false)
  const [replacedId, setReplacedId] = useState(entry?.replaced_profile_id ?? '')
  const [absenceReason, setAbsenceReason] = useState(entry?.absence_reason ?? '')
  const [absencePeriod, setAbsencePeriod] = useState<string>(entry?.absence_period ?? 'full')
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

  // Exclusivite sur une journee :
  //  - saisie d'ABSENCE  → exclure toute personne ayant DEJA une entree ce jour
  //    (absente ou presente : une seule absence/jour, pas de melange).
  //  - saisie de PRESENCE → exclure les personnes ABSENTES ce jour.
  // On garde toujours le membre en cours d'edition.
  const presentIds = new Set(
    existingEntries.filter(e => !isAbsenceType(e.entry_type)).map(e => e.profile_id),
  )
  const busyIds = new Set([...absentIds, ...presentIds]) // toute entree ce jour
  const excludedMemberIds = isAbsence ? busyIds : absentIds
  const selectableStaff = staffList.filter(
    s => !excludedMemberIds.has(s.id) || s.id === entry?.profile_id,
  )

  const isDirty = !isEdit || (
    profileId !== (entry?.profile_id ?? currentUserId) ||
    entryType !== defaultType ||
    startTime !== (entry?.start_time?.slice(0, 5) ?? '09:00') ||
    endTime !== (entry?.end_time?.slice(0, 5) ?? '12:00') ||
    isReplacement !== (entry?.is_replacement ?? false) ||
    replacedId !== (entry?.replaced_profile_id ?? '') ||
    absenceReason !== (entry?.absence_reason ?? '') ||
    absencePeriod !== (entry?.absence_period ?? 'full') ||
    notes !== (entry?.notes ?? '')
  )

  const canSave = isDirty
    && (!canManage || !!profileId)
    && !!entryType
    && (isAbsence || (!!startTime && !!endTime))
    && (!isReplacement || !!replacedId)

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    // Calcul duration
    let durationMinutes = 0
    if (!isAbsence && startTime && endTime) {
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

    const payload = {
      profile_id: profileId,
      entry_date: date,
      entry_type: entryType,
      start_time: isAbsence ? null : startTime,
      end_time: isAbsence ? null : endTime,
      duration_minutes: isAbsence ? 0 : durationMinutes,
      is_replacement: isReplacement,
      replaced_profile_id: isReplacement && replacedId ? replacedId : null,
      absence_reason: isAbsence ? absenceReason : null,
      absence_period: isAbsence ? absencePeriod : 'full',
      notes: notes || null,
      recorded_by: currentUserId,
    }

    const { error: err } = isEdit
      ? await supabase.from('staff_time_entries').update(payload).eq('id', entry!.id)
      : await supabase.from('staff_time_entries').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
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
          <button onClick={onClose} aria-label="Fermer" className="p-1 rounded-lg hover:bg-warm-100 text-warm-400 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          <p className="text-xs text-warm-500 capitalize">{dateLabel}</p>

          {/* Type (choisi en premier : conditionne la liste des membres) */}
          <div className="relative border border-warm-300 rounded-lg px-3 pt-6 pb-2.5">
            <span className="absolute top-1.5 left-3 text-[10px] font-semibold tracking-wide uppercase text-warm-500 pointer-events-none select-none">Type<span className="text-red-400 ml-0.5">*</span></span>
            <div className="flex flex-wrap gap-2">
              {presenceTypes.map(pt => {
                const selected = entryType.toUpperCase() === pt.code.toUpperCase()
                return (
                  <label key={pt.id} className="flex-1 min-w-[80px]">
                    <input
                      type="radio"
                      name="entry_type"
                      value={pt.code}
                      checked={selected}
                      onChange={() => {
                        setEntryType(pt.code)
                        // Reinitialiser le membre s'il devient incoherent avec le type.
                        const conflict = pt.is_absence ? busyIds : absentIds
                        if (profileId && profileId !== entry?.profile_id && conflict.has(profileId)) setProfileId('')
                      }}
                      className="sr-only"
                    />
                    <span
                      className={`block text-center text-xs font-semibold py-1.5 rounded-md border cursor-pointer transition-all ${!selected ? 'bg-white border-warm-300 text-warm-500 hover:border-warm-400' : ''}`}
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
            <p className="text-xs text-warm-600">
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
                  <p role="alert" className="text-xs text-warm-500 bg-warm-50 border border-warm-200 rounded-lg px-3 py-2">
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

          {/* Periode d'absence (journee / demi-journee) */}
          {isAbsence && (
            <div className="relative border border-warm-300 rounded-lg px-3 pt-6 pb-2.5">
              <span className="absolute top-1.5 left-3 text-[10px] font-semibold tracking-wide uppercase text-warm-500 pointer-events-none select-none">Période</span>
              <div className="flex gap-2" role="group" aria-label="Période d'absence">
                {(['full', 'am', 'pm'] as const).map(p => {
                  const selected = absencePeriod === p
                  const label = p === 'full' ? 'Journée' : p === 'am' ? 'Matin' : 'Après-midi'
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAbsencePeriod(p)}
                      aria-pressed={selected}
                      className={`flex-1 text-center text-xs font-semibold py-1.5 rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${selected ? 'bg-secondary-700 text-white border-secondary-700' : 'bg-white border-warm-300 text-warm-500 hover:border-warm-400'}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Motif absence */}
          {isAbsence && (
            <FloatInput
              label="MOTIF"
              value={absenceReason}
              onChange={e => setAbsenceReason(e.target.value)}
              placeholder="Maladie, congé..."
            />
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
            <p role="alert" className="text-xs text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{error}</p>
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
