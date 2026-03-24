'use client'

import { useState, useMemo, useEffect } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface SlotData {
  id: string
  class_id: string
  teacher_id: string
  cours_id: string | null
  room_id: string | null
  day_of_week: number
  start_time: string
  end_time: string
  slot_type: string
}

interface ClassData {
  id: string
  name: string
  room_id?: string | null
  cotisation_types?: { label: string } | null
  class_teachers: {
    teacher_id: string
    is_main_teacher: boolean
    teachers: { id: string; first_name: string; last_name: string; civilite?: string }
  }[]
}

interface TeacherData {
  id: string
  first_name: string
  last_name: string
  civilite?: string
}

interface RoomData {
  id: string
  name: string
  room_type: string
  capacity: number | null
}

const DAY_OPTIONS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
]

const SLOT_TYPES = [
  { value: 'cours', label: 'Cours' },
  { value: 'activite', label: 'Activité' },
]

const SIDEBAR_COLOR = '#2e4550'

function teacherLabel(p: { first_name: string; last_name: string; civilite?: string }): string {
  const civ = p.civilite === 'Mme' ? 'Mme' : 'M.'
  return `${civ} ${p.first_name} ${p.last_name}`
}

interface Props {
  slot: SlotData | null
  prefillDay: number | null
  prefillTime: string | null
  prefillClassId: string
  prefillTeacherId: string
  classes: ClassData[]
  teachers: TeacherData[]
  rooms: RoomData[]
  existingSlots: SlotData[]
  onSave: (data: {
    id?: string
    class_id: string
    teacher_id: string
    cours_id: string | null
    room_id: string | null
    day_of_week: number
    start_time: string
    end_time: string
    slot_type: string
  }) => void
  onClose: () => void
}

export default function SlotFormModal({
  slot, prefillDay, prefillTime, prefillClassId, prefillTeacherId, classes, teachers, rooms, existingSlots, onSave, onClose,
}: Props) {
  const initialClass = classes.find(c => c.id === (slot?.class_id ?? prefillClassId))
  const initialMainTeacherId = initialClass?.class_teachers?.find(ct => ct.is_main_teacher)?.teachers?.id
  const [classId, setClassId] = useState(slot?.class_id ?? prefillClassId ?? '')
  const [teacherId, setTeacherId] = useState(slot?.teacher_id ?? (prefillTeacherId || initialMainTeacherId || ''))
  const [roomId, setRoomId] = useState(slot?.room_id ?? initialClass?.room_id ?? '')
  const [dayOfWeek, setDayOfWeek] = useState<number>(slot?.day_of_week ?? prefillDay ?? 1)
  const [startTime, setStartTime] = useState(slot?.start_time?.slice(0, 5) ?? prefillTime ?? '08:00')
  const [endTime, setEndTime] = useState(slot?.end_time?.slice(0, 5) ?? (prefillTime ? addHour(prefillTime) : '09:00'))
  const [slotType, setSlotType] = useState(slot?.slot_type ?? 'cours')
  const [saving, setSaving] = useState(false)

  const selectedClass = classes.find(c => c.id === classId)

  // Auto-fill room + teacher from class
  useEffect(() => {
    if (!selectedClass || slot) return
    // Room
    if (selectedClass.room_id) setRoomId(selectedClass.room_id)
    // Prof principal
    const mainT = selectedClass.class_teachers?.find(ct => ct.is_main_teacher)
    if (mainT?.teachers?.id) setTeacherId(mainT.teachers.id)
  }, [classId, selectedClass, slot])

  // Validation
  const isValid = useMemo(() => {
    if (!classId || !teacherId) return false
    if (!startTime || !endTime) return false
    if (startTime >= endTime) return false
    return true
  }, [classId, teacherId, startTime, endTime])

  // Conflict detection
  const conflicts = useMemo(() => {
    const msgs: string[] = []
    if (!classId || !startTime || !endTime) return msgs

    for (const s of existingSlots) {
      if (slot?.id === s.id) continue
      if (s.day_of_week !== dayOfWeek) continue

      const overlaps = s.start_time < endTime && s.end_time > startTime

      if (overlaps && s.class_id === classId) {
        msgs.push(`Conflit classe : ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`)
      }
      if (overlaps && s.teacher_id === teacherId && teacherId) {
        msgs.push(`Conflit enseignant : même créneau`)
      }
      if (overlaps && s.room_id === roomId && roomId) {
        msgs.push(`Conflit salle : même créneau`)
      }
    }
    return msgs
  }, [existingSlots, slot, classId, teacherId, roomId, dayOfWeek, startTime, endTime])

  const handleSubmit = async () => {
    if (!isValid) return
    setSaving(true)
    await onSave({
      id: slot?.id,
      class_id: classId,
      teacher_id: teacherId,
      cours_id: null,
      room_id: roomId || null,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_type: slotType,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
          <h3 className="text-sm font-bold text-warm-800">
            {slot ? 'Modifier le créneau' : 'Nouveau créneau'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-warm-100 text-warm-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Slot type */}
          <div>
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">TYPE</label>
            <div className="flex gap-2 mt-1">
              {SLOT_TYPES.map(st => (
                <button
                  key={st.value}
                  onClick={() => setSlotType(st.value)}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                    slotType === st.value
                      ? 'text-white border-[#2e4550]'
                      : 'bg-white text-warm-600 border-warm-200 hover:bg-warm-50'
                  )}
                  style={slotType === st.value ? { backgroundColor: SIDEBAR_COLOR } : undefined}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Class */}
          <div>
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Classe *</label>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="input mt-1 w-full text-sm"
            >
              <option value="">— Sélectionner —</option>
              {classes.map(c => {
                const mainT = c.class_teachers?.find(ct => ct.is_main_teacher)
                const teacher = mainT?.teachers ? teacherLabel(mainT.teachers) : ''
                const infoParts = [teacher, c.cotisation_types?.label].filter(Boolean)
                return (
                  <option key={c.id} value={c.id}>
                    {c.name}{infoParts.length > 0 ? ` — ${infoParts.join(' · ')}` : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Teacher */}
          <div>
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Enseignant *</label>
            <select
              value={teacherId}
              onChange={e => setTeacherId(e.target.value)}
              className="input mt-1 w-full text-sm"
            >
              <option value="">— Sélectionner —</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
              ))}
            </select>
          </div>

          {/* Room */}
          <div>
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Salle</label>
            <select
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              className="input mt-1 w-full text-sm"
            >
              <option value="">— Aucune —</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.capacity ? ` (${r.capacity} places)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Day + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Jour *</label>
              <select
                value={dayOfWeek}
                onChange={e => setDayOfWeek(Number(e.target.value))}
                className="input mt-1 w-full text-sm"
              >
                {DAY_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Début *</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Fin *</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </div>
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              {conflicts.map((c, i) => (
                <div key={i}>{c}</div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-warm-100">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-warm-600 hover:bg-warm-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-colors',
              isValid && !saving
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-warm-200 text-warm-400 cursor-not-allowed'
            )}
          >
            {saving ? 'Enregistrement...' : slot ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
