'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { EntryType, TimeEntry } from './TempsPresenceClient'

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
  existingEntries: TimeEntry[]
  onClose: () => void
  onSaved: () => void
}

const TYPE_OPTIONS: { value: EntryType; label: string; color: string }[] = [
  { value: 'cours',    label: 'Cours',    color: 'peer-checked:bg-blue-500 peer-checked:text-white' },
  { value: 'activite', label: 'Activite', color: 'peer-checked:bg-green-500 peer-checked:text-white' },
  { value: 'menage',   label: 'Menage',   color: 'peer-checked:bg-purple-500 peer-checked:text-white' },
  { value: 'absence',  label: 'Absence',  color: 'peer-checked:bg-red-500 peer-checked:text-white' },
]

export default function TimeEntryModal({ date, entry, currentUserId, canManageAll, staffList, existingEntries, onClose, onSaved }: Props) {
  const supabase = createClient()
  const isEdit = !!entry

  const [profileId, setProfileId] = useState(entry?.profile_id ?? currentUserId)
  const [entryType, setEntryType] = useState<EntryType>(entry?.entry_type ?? 'cours')
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? '12:00')
  const [isReplacement, setIsReplacement] = useState(entry?.is_replacement ?? false)
  const [replacedId, setReplacedId] = useState(entry?.replaced_profile_id ?? '')
  const [absenceReason, setAbsenceReason] = useState(entry?.absence_reason ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAbsence = entryType === 'absence'

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
            <div>
              <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Membre du staff</label>
              <select value={profileId} onChange={e => setProfileId(e.target.value)} className="input text-sm py-1.5 w-full mt-1">
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-warm-600">
              <span className="font-bold">{staffList.find(s => s.id === currentUserId)?.last_name} {staffList.find(s => s.id === currentUserId)?.first_name}</span>
            </p>
          )}

          {/* Type */}
          <div>
            <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Type</label>
            <div className="flex gap-2 mt-1">
              {TYPE_OPTIONS.map(opt => (
                <label key={opt.value} className="flex-1">
                  <input
                    type="radio"
                    name="entry_type"
                    value={opt.value}
                    checked={entryType === opt.value}
                    onChange={() => setEntryType(opt.value)}
                    className="peer sr-only"
                  />
                  <span className={clsx(
                    'block text-center text-xs font-bold py-1.5 rounded-lg border-2 border-warm-200 cursor-pointer transition-all',
                    'peer-checked:border-transparent',
                    opt.color,
                  )}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Horaires (sauf absence) */}
          {!isAbsence && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Debut</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input text-sm py-1.5 w-full mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Fin</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="input text-sm py-1.5 w-full mt-1" />
              </div>
            </div>
          )}

          {/* Remplacement (sauf absence) */}
          {!isAbsence && (
            <div>
              <label className="flex items-center gap-2 text-xs text-warm-600 cursor-pointer">
                <input type="checkbox" checked={isReplacement} onChange={e => setIsReplacement(e.target.checked)} className="rounded border-warm-300" />
                <span className="font-medium">Remplacement</span>
              </label>
              {isReplacement && (
                <select value={replacedId} onChange={e => setReplacedId(e.target.value)} className="input text-sm py-1.5 w-full mt-2">
                  <option value="">— Staff remplace —</option>
                  {staffList.filter(s => s.id !== profileId).map(s => (
                    <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Motif absence */}
          {isAbsence && (
            <div>
              <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Motif</label>
              <input type="text" value={absenceReason} onChange={e => setAbsenceReason(e.target.value)} className="input text-sm py-1.5 w-full mt-1" placeholder="Maladie, conge..." />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input text-sm py-1.5 w-full mt-1 resize-none" placeholder="Commentaire optionnel..." />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-warm-100">
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-1.5">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-4 py-1.5">
            {saving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
