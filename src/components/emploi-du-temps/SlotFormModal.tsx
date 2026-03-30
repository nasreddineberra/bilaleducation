'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { FloatSelect, FloatInput, FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface SlotData {
  id: string
  class_id: string
  teacher_id: string
  cours_id: string | null
  room_id: string | null
  is_recurring: boolean
  day_of_week: number | null
  slot_date: string | null
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
  { value: 1, label: 'Lundi', recurring: 'Tous les lundis' },
  { value: 2, label: 'Mardi', recurring: 'Tous les mardis' },
  { value: 3, label: 'Mercredi', recurring: 'Tous les mercredis' },
  { value: 4, label: 'Jeudi', recurring: 'Tous les jeudis' },
  { value: 5, label: 'Vendredi', recurring: 'Tous les vendredis' },
  { value: 6, label: 'Samedi', recurring: 'Tous les samedis' },
  { value: 0, label: 'Dimanche', recurring: 'Tous les dimanches' },
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
  editMode: 'all' | 'this_only' | null
  editDate: string | null
  prefillDay: number | null
  prefillTime: string | null
  prefillDate: string | null
  prefillClassId: string
  prefillTeacherId: string
  weekDayDates: Record<number, string>
  classes: ClassData[]
  teachers: TeacherData[]
  rooms: RoomData[]
  existingSlots: SlotData[]
  vacations?: { start_date: string; end_date: string; label: string }[]
  onSave: (data: {
    id?: string
    class_id: string
    teacher_id: string
    cours_id: string | null
    room_id: string | null
    day_of_week: number | null
    slot_date: string | null
    is_recurring: boolean
    start_time: string
    end_time: string
    slot_type: string
    editAll?: boolean
    pivotDate?: string
  }) => void
  onSaveException: (data: {
    schedule_slot_id: string
    exception_date: string
    start_time: string
    end_time: string
    teacher_id: string
    room_id: string | null
  }) => void
  onClose: () => void
}

export default function SlotFormModal({
  slot, editMode, editDate, prefillDay, prefillTime, prefillDate, prefillClassId, prefillTeacherId,
  weekDayDates, classes, teachers, rooms, existingSlots, vacations = [], onSave, onSaveException, onClose,
}: Props) {
  const isEditingThisOnly = editMode === 'this_only' && !!editDate && !!slot

  const initialClass = classes.find(c => c.id === (slot?.class_id ?? prefillClassId))
  const initialMainTeacherId = initialClass?.class_teachers?.find(ct => ct.is_main_teacher)?.teachers?.id

  const [classId, setClassId] = useState(slot?.class_id ?? prefillClassId ?? '')
  const [teacherId, setTeacherId] = useState(slot?.teacher_id ?? (prefillTeacherId || initialMainTeacherId || ''))
  const [roomId, setRoomId] = useState(slot?.room_id ?? initialClass?.room_id ?? '')
  const [slotType, setSlotType] = useState(slot?.slot_type ?? 'cours')
  const [startTime, setStartTime] = useState(slot?.start_time?.slice(0, 5) ?? prefillTime ?? '')
  const [endTime, setEndTime] = useState(slot?.end_time?.slice(0, 5) ?? (prefillTime ? addHour(prefillTime) : ''))
  const [saving, setSaving] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  // Recurring vs Ponctuel (null = pas encore choisi)
  const isEditingAll = editMode === 'all' && !!slot
  const isEditMode = !!slot
  const [isRecurring, setIsRecurring] = useState<boolean | null>(slot ? slot.is_recurring : null)
  const [dayOfWeek, setDayOfWeek] = useState<number | ''>(slot?.day_of_week ?? prefillDay ?? '')
  const [slotDate, setSlotDate] = useState<string>(
    slot?.slot_date ?? prefillDate ?? (prefillDay !== null && prefillDay !== undefined ? (weekDayDates[prefillDay] ?? '') : '')
  )

  // Track initial values for change detection in edit mode
  const initVals = useMemo(() => ({
    classId: slot?.class_id ?? prefillClassId ?? '',
    teacherId: slot?.teacher_id ?? (prefillTeacherId || initialMainTeacherId || ''),
    roomId: slot?.room_id ?? initialClass?.room_id ?? '',
    slotType: slot?.slot_type ?? 'cours',
    startTime: slot?.start_time?.slice(0, 5) ?? prefillTime ?? '',
    endTime: slot?.end_time?.slice(0, 5) ?? (prefillTime ? addHour(prefillTime) : ''),
    dayOfWeek: slot?.day_of_week ?? prefillDay ?? '',
    slotDate: slot?.slot_date ?? prefillDate ?? (prefillDay !== null && prefillDay !== undefined ? (weekDayDates[prefillDay] ?? '') : ''),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  const hasChanges = !isEditMode || (
    classId !== initVals.classId ||
    teacherId !== initVals.teacherId ||
    roomId !== initVals.roomId ||
    slotType !== initVals.slotType ||
    startTime !== initVals.startTime ||
    endTime !== initVals.endTime ||
    dayOfWeek !== initVals.dayOfWeek ||
    slotDate !== initVals.slotDate
  )

  const selectedClass = classes.find(c => c.id === classId)

  // Auto-fill room + teacher from class
  useEffect(() => {
    if (!selectedClass || slot) return
    if (selectedClass.room_id) setRoomId(selectedClass.room_id)
    const mainT = selectedClass.class_teachers?.find(ct => ct.is_main_teacher)
    if (mainT?.teachers?.id) setTeacherId(mainT.teachers.id)
  }, [classId, selectedClass, slot])

  // Sync slotDate when changing dayOfWeek (week view only, pas quand prefillDate est fourni)
  useEffect(() => {
    if (!isRecurring && !prefillDate && prefillDay !== null && dayOfWeek !== '' && weekDayDates[dayOfWeek]) {
      setSlotDate(weekDayDates[dayOfWeek])
    }
  }, [dayOfWeek, isRecurring, prefillDay, prefillDate, weekDayDates])

  // Vérifier si une date est en vacances
  const isVacationDate = useCallback((dateStr: string) => {
    for (const v of vacations) {
      if (dateStr >= v.start_date && dateStr <= v.end_date) return true
    }
    return false
  }, [vacations])

  const dateInVacation = !isRecurring && slotDate ? isVacationDate(slotDate) : false

  const isValid = useMemo(() => {
    if (isRecurring === null) return false
    if (!classId || !teacherId) return false
    if (!startTime || !endTime) return false
    if (startTime >= endTime) return false
    if (isRecurring && dayOfWeek === '') return false
    if (!isRecurring && !slotDate) return false
    if (dateInVacation) return false
    return true
  }, [classId, teacherId, startTime, endTime, isRecurring, slotDate, dayOfWeek, dateInVacation])

  // Conflict detection
  const conflicts = useMemo(() => {
    const msgs: string[] = []
    if (!classId || !startTime || !endTime) return msgs

    for (const s of existingSlots) {
      if (slot?.id === s.id) continue

      // Match day: for recurring check day_of_week, for ponctual check slot_date
      let sameDay = false
      if (isRecurring && s.is_recurring && s.day_of_week === dayOfWeek) sameDay = true
      if (!isRecurring && !s.is_recurring && s.slot_date === slotDate) sameDay = true
      if (isRecurring && !s.is_recurring) {
        // recurring vs ponctual: check if ponctual falls on same dow
        if (s.slot_date) {
          const d = new Date(s.slot_date)
          if (d.getDay() === dayOfWeek) sameDay = true
        }
      }
      if (!sameDay) continue

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
  }, [existingSlots, slot, classId, teacherId, roomId, dayOfWeek, slotDate, startTime, endTime, isRecurring])

  const handleSubmit = async () => {
    if (!isValid || isRecurring === null) return

    const doSave = async () => {
      setSaving(true)
      if (isEditingThisOnly && slot) {
        await onSaveException({
          schedule_slot_id: slot.id,
          exception_date: editDate!,
          start_time: startTime,
          end_time: endTime,
          teacher_id: teacherId,
          room_id: roomId || null,
        })
      } else {
        await onSave({
          id: slot?.id,
          class_id: classId,
          teacher_id: teacherId,
          cours_id: null,
          room_id: roomId || null,
          day_of_week: isRecurring && dayOfWeek !== '' ? dayOfWeek : null,
          slot_date: isRecurring ? null : slotDate,
          is_recurring: isRecurring,
          start_time: startTime,
          end_time: endTime,
          slot_type: slotType,
          editAll: isEditingAll,
          pivotDate: editDate ?? undefined,
        })
      }
      setSaving(false)
    }

    // Confirmation pour récurrent (création)
    if (isRecurring && !slot) {
      const day = DAY_OPTIONS.find(d => d.value === dayOfWeek)?.label ?? ''
      setPendingConfirm({ message: `Ce créneau sera répété chaque ${day} pour toute l'année scolaire. Continuer ?`, onConfirm: doSave })
      return
    }

    // Confirmation pour modification de tous les créneaux
    if (isEditingAll && hasChanges) {
      const day = DAY_OPTIONS.find(d => d.value === dayOfWeek)?.label ?? ''
      setPendingConfirm({
        message: `Tous les créneaux récurrents seront modifiés à partir d'aujourd'hui.\nLa fiche classe sera mise à jour avec : ${day} ${startTime}–${endTime}.\n\nContinuer ?`,
        onConfirm: doSave,
      })
      return
    }

    await doSave()
  }

  const modalTitle = isEditingThisOnly
    ? `Modifier le ${new Date(editDate! + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} uniquement`
    : slot ? 'Modifier le créneau' : 'Nouveau créneau'

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
          <h3 className="text-sm font-bold text-warm-800">{modalTitle}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-warm-100 text-warm-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Type + Fréquence (greyed in edit mode) */}
          {!isEditingThisOnly && (
            <>
              <div className="flex justify-between">
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Type</label>
                  <div className="flex gap-2 mt-1">
                    {SLOT_TYPES.map(st => (
                      <button
                        key={st.value}
                        onClick={() => !isEditMode && setSlotType(st.value)}
                        disabled={isEditMode}
                        className={clsx(
                          'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                          slotType === st.value
                            ? 'text-white border-[#2e4550]'
                            : 'bg-white text-warm-600 border-warm-200 hover:bg-warm-50',
                          isEditMode && 'opacity-60 cursor-not-allowed'
                        )}
                        style={slotType === st.value ? { backgroundColor: SIDEBAR_COLOR } : undefined}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Fréquence <span className="text-red-400">*</span></label>
                  <div className="flex gap-2 mt-1">
                    {[
                      { value: false, label: 'Ponctuel' },
                      { value: true, label: 'Récurrent' },
                    ].map(opt => (
                      <button
                        key={String(opt.value)}
                        onClick={() => !isEditMode && setIsRecurring(opt.value)}
                        disabled={isEditMode}
                        className={clsx(
                          'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                          isRecurring === opt.value
                            ? 'text-white border-[#2e4550]'
                            : 'bg-white text-warm-600 border-warm-200 hover:bg-warm-50',
                          isEditMode && 'opacity-60 cursor-not-allowed'
                        )}
                        style={isRecurring === opt.value ? { backgroundColor: SIDEBAR_COLOR } : undefined}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Class */}
              <FloatSelect
                label="Classe"
                required
                value={classId}
                onChange={e => setClassId(e.target.value)}
              >
                <option value=""></option>
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
              </FloatSelect>
            </>
          )}

          {/* Teacher */}
          <FloatSelect
            label="Enseignant"
            required
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
          >
            <option value=""></option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
            ))}
          </FloatSelect>

          {/* Room */}
          <FloatSelect
            label="Salle"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
          >
            <option value=""></option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}{r.capacity ? ` (${r.capacity} places)` : ''}
              </option>
            ))}
          </FloatSelect>

          {/* Day / Date + Times — toujours visible */}
          {!isEditingThisOnly && (
            <div className={isRecurring === true ? 'grid grid-cols-[3fr_2fr_2fr] gap-3' : 'grid grid-cols-3 gap-3'}>
              <div>
                {isRecurring === true ? (
                  <FloatSelect
                    label="Jour"
                    required
                    value={String(dayOfWeek)}
                    onChange={e => setDayOfWeek(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value=""></option>
                    {DAY_OPTIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.recurring}</option>
                    ))}
                  </FloatSelect>
                ) : isRecurring === false ? (
                  <div>
                    <FloatInput
                      label="Date"
                      required
                      type="date"
                      value={slotDate}
                      onChange={e => setSlotDate(e.target.value)}
                    />
                    {dateInVacation && (
                      <p className="text-xs text-red-500 mt-1">Cette date tombe pendant les vacances scolaires</p>
                    )}
                  </div>
                ) : (
                  <FloatSelect
                    label="Jour"
                    required
                    value={String(dayOfWeek)}
                    onChange={e => setDayOfWeek(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value=""></option>
                    {DAY_OPTIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </FloatSelect>
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
          )}

          {/* Fréquence grisée pour modification ce créneau uniquement */}
          {isEditingThisOnly && (
            <div className="flex justify-between">
              <div>
                <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Type</label>
                <div className="flex gap-2 mt-1">
                  <span className="px-3 py-1 rounded-lg text-xs font-medium border text-white border-[#2e4550] opacity-60" style={{ backgroundColor: SIDEBAR_COLOR }}>
                    {SLOT_TYPES.find(st => st.value === slotType)?.label ?? 'Cours'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Fréquence</label>
                <div className="flex gap-2 mt-1">
                  <span className="px-3 py-1 rounded-lg text-xs font-medium border text-white border-[#2e4550] opacity-60" style={{ backgroundColor: SIDEBAR_COLOR }}>
                    Exception ponctuelle
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Times only for this_only edit */}
          {isEditingThisOnly && (
            <div className="grid grid-cols-2 gap-3">
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
          )}

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
        <div className="flex items-center gap-2 px-5 py-3 border-t border-warm-100">
          <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
          <div className="flex-1" />
          <FloatButton variant="secondary" type="button" onClick={onClose}>Annuler</FloatButton>
          <FloatButton
            variant={slot ? 'edit' : 'submit'}
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || !hasChanges}
            loading={saving}
          >
            {isEditingThisOnly ? 'Modifier ce créneau' : slot ? 'Modifier' : 'Valider'}
          </FloatButton>
        </div>
      </div>
    </div>

    <ConfirmModal
      open={!!pendingConfirm}
      message={pendingConfirm?.message ?? ''}
      confirmLabel="Continuer"
      onConfirm={() => { pendingConfirm?.onConfirm(); setPendingConfirm(null) }}
      onCancel={() => setPendingConfirm(null)}
    />
  </>
  )
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
