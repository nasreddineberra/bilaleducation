'use client'

import { useState } from 'react'
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
  canManageAll: boolean
  staffList: StaffMember[]
  presenceTypes: PresenceType[]
  existingEntries: TimeEntry[]
  onClose: () => void
  onSaved: () => void
}

export default function TimeEntryModal({ date, entry, currentUserId, canManageAll, staffList, presenceTypes, existingEntries, onClose, onSaved }: Props) {
  const supabase = createClient()
  const isEdit = !!entry

  const defaultType = entry?.entry_type ?? ''

  const [profileId, setProfileId] = useState(entry?.profile_id ?? (canManageAll ? '' : currentUserId))
  const [entryType, setEntryType] = useState<string>(defaultType)
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? '12:00')
  const [isReplacement, setIsReplacement] = useState(entry?.is_replacement ?? false)
  const [replacedId, setReplacedId] = useState(entry?.replaced_profile_id ?? '')
  const [absenceReason, setAbsenceReason] = useState(entry?.absence_reason ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAbsence = presenceTypes.find(p => p.code.toUpperCase() === entryType.toUpperCase())?.is_absence ?? false

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

  const canSave = isDirty
    && (!canManageAll || !!profileId)
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
        setError('L\'heure de fin doit etre superieure a l\'heure de debut')
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
        if (e.entry_type === 'absence' || !e.start_time || !e.end_time) return false
        const eStart = e.start_time.slice(0, 5)
        const eEnd = e.end_time.slice(0, 5)
        return newStart < eEnd && newEnd > eStart
      })
      if (overlap) {
        const s = staffList.find(st => st.id === profileId)
        const name = s ? `${s.last_name} ${s.first_name}` : 'Cette personne'
        setError(`${name} a deja un creneau de ${overlap.start_time?.slice(0, 5)} a ${overlap.end_time?.slice(0, 5)} ce jour. Les creneaux ne peuvent pas se chevaucher.`)
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
          <h3 className="text-sm font-bold text-secondary-800">
            {isEdit ? 'Modifier la saisie' : 'Nouvelle saisie'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-warm-100 text-warm-400"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          <p className="text-xs text-warm-500 capitalize">{dateLabel}</p>

          {/* Staff select */}
          {canManageAll ? (
            <FloatSelect
              label="MEMBRE ÉQUIPE"
              required
              value={profileId}
              onChange={e => {
                const val = e.target.value
                setProfileId(val)
                if (val && val === replacedId) setReplacedId('')
              }}
            >
              <option value=""></option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
              ))}
            </FloatSelect>
          ) : (
            <p className="text-xs text-warm-600">
              <span className="font-bold">{staffList.find(s => s.id === currentUserId)?.last_name} {staffList.find(s => s.id === currentUserId)?.first_name}</span>
            </p>
          )}

          {/* Type */}
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
                      onChange={() => setEntryType(pt.code)}
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
                <FloatSelect
                  label=""
                  value={replacedId}
                  onChange={e => setReplacedId(e.target.value)}
                >
                  <option value=""></option>
                  {staffList.filter(s => s.id !== profileId).map(s => (
                    <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                  ))}
                </FloatSelect>
              )}
            </div>
          )}

          {/* Motif absence */}
          {isAbsence && (
            <FloatInput
              label="MOTIF"
              value={absenceReason}
              onChange={e => setAbsenceReason(e.target.value)}
              placeholder="Maladie, conge..."
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
            <p className="text-xs text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{error}</p>
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
