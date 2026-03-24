'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { clsx } from 'clsx'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Check, X, GripVertical } from 'lucide-react'
import SlotCapsule from './SlotCapsule'
import DayColumn from './DayColumn'
import SlotFormModal from './SlotFormModal'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi',
  4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi',
}

const DAY_LABELS_SHORT: Record<number, string> = {
  0: 'Dim', 1: 'Lun', 2: 'Mar', 3: 'Mer',
  4: 'Jeu', 5: 'Ven', 6: 'Sam',
}

const SLOT_COLORS: Record<string, string> = {
  cours: 'bg-blue-100 border-blue-300 text-blue-800',
  activite: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  pause: 'bg-warm-100 border-warm-300 text-warm-600',
  autre: 'bg-purple-100 border-purple-300 text-purple-800',
}

const DEFAULT_START = 7  // 07:00
const DEFAULT_END = 19   // 19:00

// Lundi(1) → Dimanche(0)
const FIXED_DAYS = [1, 2, 3, 4, 5, 6, 0]

const SIDEBAR_COLOR = '#2e4550'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  color: string | null
  // Joined
  classes?: { name: string }
  teachers?: { first_name: string; last_name: string; civilite?: string }
  cours?: { nom_fr: string } | null
  rooms?: { name: string } | null
}

interface ClassData {
  id: string
  name: string
  level: string
  room_id?: string | null
  day_of_week?: string | null
  start_time?: string | null
  end_time?: string | null
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

interface CoursData {
  id: string
  nom_fr: string
  unite_enseignement_id: string
  unites_enseignement?: { nom_fr: string }
}

interface ValidationData {
  id: string
  schedule_slot_id: string
  profile_id: string
  validation_date: string
  time_entry_id: string | null
}

type ViewMode = 'global' | 'class' | 'teacher'

interface Props {
  currentUserId: string
  currentUserName: string
  role: string
  canEdit: boolean
  schoolYearId: string
  classes: ClassData[]
  teachers: TeacherData[]
  slots: SlotData[]
  rooms: RoomData[]
  coursList: CoursData[]
  todayValidations: ValidationData[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function teacherLabel(p: { first_name: string; last_name: string; civilite?: string } | undefined): string {
  if (!p) return ''
  const civ = p.civilite === 'Mme' ? 'Mme' : 'M.'
  return `${civ} ${p.first_name} ${p.last_name}`
}

function classInfoLine(c: ClassData): string {
  const mainT = c.class_teachers?.find(ct => ct.is_main_teacher)
  const parts: string[] = []
  if (mainT?.teachers) parts.push(teacherLabel(mainT.teachers))
  if (c.cotisation_types?.label) parts.push(c.cotisation_types.label)
  if (c.level) parts.push(`Niveau ${c.level}`)
  if (c.day_of_week && c.start_time && c.end_time) {
    parts.push(`${c.day_of_week} ${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}`)
  }
  return parts.join(' · ')
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmploiDuTempsClient({
  currentUserId, currentUserName, role, canEdit, schoolYearId,
  classes, teachers, slots: initialSlots, rooms, coursList, todayValidations: initialValidations,
}: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const [slots, setSlots] = useState<SlotData[]>(initialSlots)
  const [validations, setValidations] = useState<ValidationData[]>(initialValidations)
  const [viewMode, setViewMode] = useState<ViewMode>(
    role === 'enseignant' ? 'teacher' : 'global'
  )
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    role === 'enseignant' ? currentUserId : ''
  )

  // Day filter
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Today string (stable across renders)
  const todayStr = new Date().toISOString().split('T')[0]

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<SlotData | null>(null)
  const [prefillDay, setPrefillDay] = useState<number | null>(null)
  const [prefillTime, setPrefillTime] = useState<string | null>(null)

  // Drag
  const [activeSlot, setActiveSlot] = useState<SlotData | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Custom dropdowns
  const [classDropOpen, setClassDropOpen] = useState(false)
  const [teacherDropOpen, setTeacherDropOpen] = useState(false)
  const classDropRef = useRef<HTMLDivElement>(null)
  const teacherDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (classDropRef.current && !classDropRef.current.contains(e.target as Node)) setClassDropOpen(false)
      if (teacherDropRef.current && !teacherDropRef.current.contains(e.target as Node)) setTeacherDropOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ─── Computed ────────────────────────────────────────────────────────────

  const activeDays = selectedDay !== null ? [selectedDay] : FIXED_DAYS
  const startHour = DEFAULT_START
  const endHour = DEFAULT_END

  const hours = useMemo(() => {
    const arr: number[] = []
    for (let h = startHour; h < endHour; h++) arr.push(h)
    return arr
  }, [startHour, endHour])

  // Filter slots by view
  const filteredSlots = useMemo(() => {
    if (viewMode === 'class' && selectedClassId) {
      return slots.filter(s => s.class_id === selectedClassId)
    }
    if (viewMode === 'teacher' && selectedTeacherId) {
      return slots.filter(s => s.teacher_id === selectedTeacherId)
    }
    return slots // global without filter
  }, [slots, viewMode, selectedClassId, selectedTeacherId])

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map: Record<number, SlotData[]> = {}
    for (const d of activeDays) map[d] = []
    for (const s of filteredSlots) {
      if (map[s.day_of_week]) map[s.day_of_week].push(s)
    }
    return map
  }, [filteredSlots, activeDays])

  // ─── CRUD ────────────────────────────────────────────────────────────────

  const handleSaveSlot = useCallback(async (data: {
    id?: string
    class_id: string
    teacher_id: string
    cours_id: string | null
    room_id: string | null
    day_of_week: number
    start_time: string
    end_time: string
    slot_type: string
  }) => {
    const payload = {
      school_year_id: schoolYearId,
      class_id: data.class_id,
      teacher_id: data.teacher_id,
      cours_id: data.cours_id || null,
      room_id: data.room_id || null,
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      slot_type: data.slot_type,
    }

    if (data.id) {
      // Update
      const { error } = await supabase
        .from('schedule_slots')
        .update(payload)
        .eq('id', data.id)
      if (error) { alert('Erreur : ' + error.message); return }
    } else {
      // Insert
      const { error } = await supabase
        .from('schedule_slots')
        .insert(payload)
      if (error) { alert('Erreur : ' + error.message); return }
    }

    // Refresh slots
    const { data: fresh } = await supabase
      .from('schedule_slots')
      .select('*, classes(name), teachers(first_name, last_name, civilite), cours(nom_fr), rooms(name)')
      .eq('school_year_id', schoolYearId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time')
    if (fresh) setSlots(fresh as any[])
    setModalOpen(false)
    setEditingSlot(null)
  }, [supabase, schoolYearId])

  const handleDeleteSlot = useCallback(async (slotId: string) => {
    if (!confirm('Supprimer ce créneau ?')) return
    await supabase.from('schedule_slots').delete().eq('id', slotId)
    setSlots(prev => prev.filter(s => s.id !== slotId))
  }, [supabase])

  // ─── Drag & Drop ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const slot = slots.find(s => s.id === e.active.id)
    setActiveSlot(slot ?? null)
  }, [slots])

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveSlot(null)
    if (!e.over) return
    const slotId = e.active.id as string
    const newDay = Number(String(e.over.id).replace('day-', ''))
    const slot = slots.find(s => s.id === slotId)
    if (!slot || slot.day_of_week === newDay) return

    // Optimistic
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, day_of_week: newDay } : s))

    const { error } = await supabase
      .from('schedule_slots')
      .update({ day_of_week: newDay })
      .eq('id', slotId)

    if (error) {
      // Revert
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, day_of_week: slot.day_of_week } : s))
      alert('Erreur : ' + error.message)
    }
  }, [slots, supabase])

  // ─── Validation présence ─────────────────────────────────────────────────

  const handleValidate = useCallback(async (slotId: string) => {
    const slot = slots.find(s => s.id === slotId)
    if (!slot) return

    const durationMin = timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time)

    // 1. Créer entrée temps de présence
    const { data: timeEntry, error: teErr } = await supabase
      .from('staff_time_entries')
      .insert({
        profile_id: currentUserId,
        entry_date: todayStr,
        entry_type: slot.slot_type === 'pause' ? 'activite' : slot.slot_type,
        start_time: slot.start_time,
        end_time: slot.end_time,
        duration_minutes: durationMin,
        recorded_by: currentUserId,
      })
      .select('id')
      .single()

    if (teErr) { alert('Erreur : ' + teErr.message); return }

    // 2. Créer validation
    const { data: val, error: valErr } = await supabase
      .from('schedule_validations')
      .insert({
        schedule_slot_id: slotId,
        profile_id: currentUserId,
        validation_date: todayStr,
        time_entry_id: timeEntry?.id ?? null,
      })
      .select('*')
      .single()

    if (valErr) { alert('Erreur : ' + valErr.message); return }
    if (val) setValidations(prev => [...prev, val as any])
  }, [slots, supabase, currentUserId, todayStr])

  const handleCancelValidation = useCallback(async (slotId: string) => {
    const v = validations.find(v => v.schedule_slot_id === slotId && v.validation_date === todayStr)
    if (!v) return

    // Supprimer l'entrée temps de présence liée
    if (v.time_entry_id) {
      await supabase.from('staff_time_entries').delete().eq('id', v.time_entry_id)
    }
    // Supprimer la validation
    await supabase.from('schedule_validations').delete().eq('id', v.id)
    setValidations(prev => prev.filter(x => x.id !== v.id))
  }, [validations, supabase, todayStr])

  const isValidated = useCallback((slotId: string) => {
    return validations.some(v => v.schedule_slot_id === slotId && v.validation_date === todayStr)
  }, [validations, todayStr])

  // ─── Open modal helpers ──────────────────────────────────────────────────

  const openNewSlot = (day?: number, time?: string) => {
    setEditingSlot(null)
    setPrefillDay(day ?? null)
    setPrefillTime(time ?? null)
    setModalOpen(true)
  }

  const openEditSlot = (slot: SlotData) => {
    setEditingSlot(slot)
    setModalOpen(true)
  }

  // ─── Week navigation ────────────────────────────────────────────────────

  const MONTH_NAMES = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

  const getMondayOf = (d: Date) => {
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.getFullYear(), d.getMonth(), diff)
  }
  const getWeekNumber = (d: Date) => {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
    return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  const [weekOffset, setWeekOffset] = useState(0)

  const currentMonday = useMemo(() => {
    const m = getMondayOf(new Date())
    m.setDate(m.getDate() + weekOffset * 7)
    return m
  }, [weekOffset])

  const currentSunday = useMemo(() => {
    const s = new Date(currentMonday)
    s.setDate(currentMonday.getDate() + 6)
    return s
  }, [currentMonday])

  const weekNum = getWeekNumber(currentMonday)
  const fmtDateFull = (d: Date) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`

  // Today's day of week (based on real today, not navigated week)
  const todayRealDow = new Date().getDay()
  const isCurrentWeek = weekOffset === 0
  const todayDow = isCurrentWeek ? todayRealDow : -1

  // Date for each day of the week (dow → "DD/MM/YYYY")
  const dayDates = useMemo(() => {
    const map: Record<number, string> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday)
      d.setDate(currentMonday.getDate() + i)
      const dow = d.getDay()
      map[dow] = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }
    return map
  }, [currentMonday])

  // ─── Selected labels ────────────────────────────────────────────────────

  const selectedClass = classes.find(c => c.id === selectedClassId)
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId)

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-2 p-2">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="card flex items-center gap-3 px-4 py-2 flex-shrink-0">
        {/* View tabs */}
        <div className="flex rounded-lg overflow-hidden text-xs font-medium border border-warm-200">
          {(['global', 'class', 'teacher'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => {
                setViewMode(v)
                if (v === 'global') { setSelectedClassId(''); setSelectedTeacherId(''); setSelectedDay(null) }
                if (v === 'class') { setSelectedClassId(''); setSelectedTeacherId(''); setSelectedDay(null) }
                if (v === 'teacher') { setSelectedClassId(''); setSelectedTeacherId(role === 'enseignant' ? currentUserId : ''); setSelectedDay(null) }
              }}
              className={clsx(
                'px-3 py-1.5 transition-colors',
                viewMode === v
                  ? 'text-white'
                  : 'bg-white text-warm-600 hover:bg-warm-50'
              )}
              style={viewMode === v ? { backgroundColor: SIDEBAR_COLOR } : undefined}
            >
              {v === 'global' ? 'Globale' : v === 'class' ? 'Par classe' : 'Par enseignant'}
            </button>
          ))}
        </div>

        {/* Class select (class view only) */}
        {viewMode === 'class' && (
          <div ref={classDropRef} className="relative">
            <button
              type="button"
              onClick={() => setClassDropOpen(o => !o)}
              className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 hover:border-warm-300 transition-colors whitespace-nowrap"
            >
              {selectedClassId ? (() => {
                const cls = classes.find(c => c.id === selectedClassId)
                if (!cls) return <span className="text-warm-400">— Sélectionner une classe —</span>
                const mainT = cls.class_teachers?.find(ct => ct.is_main_teacher)
                const teacher = mainT?.teachers ? teacherLabel(mainT.teachers) : ''
                return (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-secondary-800">{cls.name}</span>
                    {teacher && <span className="text-warm-400 text-xs">{teacher}</span>}
                  </span>
                )
              })() : (
                <span className="text-warm-400">{classes.length === 0 ? 'Aucune classe' : '— Sélectionner une classe —'}</span>
              )}
              <ChevronDown size={13} className={clsx('text-warm-400 flex-shrink-0 transition-transform', classDropOpen && 'rotate-180')} />
            </button>
            {classDropOpen && (
              <div className="absolute top-full left-0 mt-1 min-w-full w-max bg-white border border-warm-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                {classes.map(c => {
                  const mainT = c.class_teachers?.find(ct => ct.is_main_teacher)
                  const teacher = mainT?.teachers ? teacherLabel(mainT.teachers) : ''
                  const infoParts = [teacher, c.cotisation_types?.label].filter(Boolean)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedClassId(c.id); setClassDropOpen(false) }}
                      className={clsx(
                        'w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-primary-50 transition-colors',
                        selectedClassId === c.id && 'bg-primary-50'
                      )}
                    >
                      <span className="font-semibold text-secondary-800 text-sm">{c.name}</span>
                      {infoParts.length > 0 && <span className="text-warm-400 text-xs truncate">{infoParts.join(' · ')}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Teacher select */}
        {viewMode === 'teacher' && (
          <div ref={teacherDropRef} className="relative">
            <button
              type="button"
              onClick={() => setTeacherDropOpen(o => !o)}
              className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 hover:border-warm-300 transition-colors whitespace-nowrap"
            >
              {selectedTeacher ? (
                <span className="font-semibold text-secondary-800">
                  {selectedTeacher.last_name} {selectedTeacher.first_name}
                </span>
              ) : (
                <span className="text-warm-400">— Sélectionner un enseignant —</span>
              )}
              <ChevronDown size={13} className={clsx('text-warm-400 flex-shrink-0 transition-transform', teacherDropOpen && 'rotate-180')} />
            </button>
            {teacherDropOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-warm-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                {teachers.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelectedTeacherId(t.id); setTeacherDropOpen(false) }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors',
                      t.id === selectedTeacherId && 'bg-primary-50'
                    )}
                  >
                    {t.last_name} {t.first_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Class info line (when a class is selected in class view) */}
        {selectedClassId && viewMode === 'class' && (() => {
          const cls = classes.find(c => c.id === selectedClassId)
          if (!cls) return null
          const info = classInfoLine(cls)
          return info ? <span className="text-sm font-medium text-warm-600 whitespace-nowrap">{info}</span> : null
        })()}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="p-1 rounded-lg hover:bg-warm-100 text-warm-400 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={clsx(
              'text-xs font-medium whitespace-nowrap px-2 py-1 rounded-lg transition-colors',
              isCurrentWeek ? 'text-warm-500' : 'text-amber-600 hover:bg-amber-50 cursor-pointer'
            )}
            title={isCurrentWeek ? 'Semaine courante' : 'Revenir à cette semaine'}
          >
            S{weekNum} — {fmtDateFull(currentMonday)} au {fmtDateFull(currentSunday)} {currentSunday.getFullYear()}
          </button>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="p-1 rounded-lg hover:bg-warm-100 text-warm-400 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Add slot button */}
        {canEdit && (
          <button
            onClick={() => openNewSlot()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors"
          >
            <Plus size={14} />
            Nouveau créneau
          </button>
        )}
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Day headers */}
          <div
            className="grid border-b border-warm-100 flex-shrink-0"
            style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, 1fr)` }}
          >
            <div className="p-2 text-xs text-warm-400" />
            {activeDays.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                className={clsx(
                  'p-2 text-center text-xs font-semibold uppercase tracking-wide border-l border-warm-100 transition-colors cursor-pointer',
                  selectedDay === d
                    ? 'text-white'
                    : d === todayDow ? 'text-amber-600 bg-amber-50/50 hover:bg-amber-50' : 'text-warm-500 hover:bg-warm-50'
                )}
                style={selectedDay === d ? { backgroundColor: SIDEBAR_COLOR } : undefined}
              >
                {selectedDay !== null ? DAY_LABELS[d] : DAY_LABELS_SHORT[d]}
                <span className="text-[10px] font-normal opacity-60 ml-1">{dayDates[d]}</span>
              </button>
            ))}
          </div>

          {/* Time grid */}
          <div
            className="grid flex-1 min-h-0"
            style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, 1fr)` }}
          >
            {/* Time axis */}
            <div className="relative border-r border-warm-100">
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute w-full text-right pr-2 text-[10px] text-warm-400 -translate-y-1/2"
                  style={{ top: `${(i / hours.length) * 100}%` }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {activeDays.map(d => (
              <DayColumn
                key={d}
                day={d}
                slots={slotsByDay[d] ?? []}
                startHour={startHour}
                endHour={endHour}
                isToday={d === todayDow}
                canEdit={canEdit}
                viewMode={viewMode}
                isTeacher={role === 'enseignant'}
                isValidated={isValidated}
                onValidate={handleValidate}
                onCancelValidation={handleCancelValidation}
                onClickSlot={openEditSlot}
                onClickEmpty={(day, time) => canEdit && openNewSlot(day, time)}
                onDeleteSlot={handleDeleteSlot}
              />
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeSlot && (
            <div className={clsx(
              'rounded-lg border px-2 py-1 text-xs shadow-lg opacity-80',
              SLOT_COLORS[activeSlot.slot_type] ?? SLOT_COLORS.cours
            )}>
              <div className="font-semibold">{activeSlot.cours?.nom_fr ?? activeSlot.slot_type}</div>
              <div className="text-[10px] opacity-70">{activeSlot.classes?.name}</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <SlotFormModal
          slot={editingSlot}
          prefillDay={prefillDay ?? selectedDay}
          prefillTime={prefillTime}
          prefillClassId={selectedClassId}
          prefillTeacherId={viewMode === 'teacher' && teachers.some(t => t.id === selectedTeacherId) ? selectedTeacherId : ''}
          classes={classes}
          teachers={teachers}
          rooms={rooms}
          existingSlots={slots}
          onSave={handleSaveSlot}
          onClose={() => { setModalOpen(false); setEditingSlot(null) }}
        />
      )}
    </div>
  )
}
