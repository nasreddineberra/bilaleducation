'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { clsx } from 'clsx'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Check, RotateCcw, CalendarDays, LayoutGrid } from 'lucide-react'
import { logAudit } from '@/lib/audit'
import SlotCapsule from './SlotCapsule'
import DayColumn from './DayColumn'
import MonthGrid from './MonthGrid'
import SlotFormModal from './SlotFormModal'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi',
  4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi',
}

const DAY_LABELS_SHORT: Record<number, string> = {
  0: 'DIM', 1: 'LUN', 2: 'MAR', 3: 'MER',
  4: 'JEU', 5: 'VEN', 6: 'SAM',
}

const SLOT_COLORS: Record<string, string> = {
  cours: 'bg-blue-100 border-blue-300 text-blue-800',
  activite: 'bg-emerald-100 border-emerald-300 text-emerald-800',
}

const DEFAULT_START = 7
const DEFAULT_END = 19

// Ordre des jours dynamique selon weekStartDay
function buildDayOrder(startDay: number): number[] {
  const days: number[] = []
  for (let i = 0; i < 7; i++) days.push((startDay + i) % 7)
  return days
}

const SIDEBAR_COLOR = '#2e4550'

const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SlotData {
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
  color: string | null
  effective_from: string | null
  effective_until: string | null
  classes?: { name: string }
  teachers?: { first_name: string; last_name: string; civilite?: string }
  cours?: { nom_fr: string } | null
  rooms?: { name: string } | null
}

export interface ExceptionData {
  id: string
  schedule_slot_id: string
  exception_date: string
  exception_type: 'cancelled' | 'modified'
  override_start_time: string | null
  override_end_time: string | null
  override_teacher_id: string | null
  override_room_id: string | null
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
  user_id?: string | null
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

/** A "resolved" slot for display — can be a recurring slot (possibly modified) or a ponctual slot */
export interface ResolvedSlot {
  id: string
  sourceSlotId: string
  isRecurring: boolean
  isModified: boolean
  exceptionId?: string
  date: string // YYYY-MM-DD of the actual day
  dayOfWeek: number
  class_id: string
  teacher_id: string
  cours_id: string | null
  room_id: string | null
  start_time: string
  end_time: string
  slot_type: string
  color: string | null
  classes?: { name: string }
  teachers?: { first_name: string; last_name: string; civilite?: string }
  cours?: { nom_fr: string } | null
  rooms?: { name: string } | null
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
  exceptions: ExceptionData[]
  rooms: RoomData[]
  coursList: CoursData[]
  todayValidations: ValidationData[]
  weekStartDay?: number  // 0=Dimanche, 1=Lundi, 6=Samedi
  schoolYearStartDate?: string | null  // YYYY-MM-DD
  schoolYearEndDate?: string | null    // YYYY-MM-DD
  vacations?: { start_date: string; end_date: string; label: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
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

function getWeekStartOf(d: Date, startDay: number) {
  const day = d.getDay()
  const diff = (day - startDay + 7) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
}

function getWeekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateFull(d: Date) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

/** Vérifie si un créneau récurrent est effectif à une date donnée */
function isSlotEffective(slot: SlotData, dateStr: string): boolean {
  if (slot.effective_from && dateStr < slot.effective_from) return false
  if (slot.effective_until && dateStr > slot.effective_until) return false
  return true
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmploiDuTempsClient({
  currentUserId, currentUserName, role, canEdit, schoolYearId,
  classes, teachers, slots: initialSlots, exceptions: initialExceptions,
  rooms, coursList, todayValidations: initialValidations,
  weekStartDay = 1,
  schoolYearStartDate, schoolYearEndDate, vacations = [],
}: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const classesRef = useRef(classes)
  classesRef.current = classes

  const [slots, setSlots] = useState<SlotData[]>(initialSlots)
  const [exceptions, setExceptions] = useState<ExceptionData[]>(initialExceptions)
  const [validations, setValidations] = useState<ValidationData[]>(initialValidations)
  const [viewMode, setViewMode] = useState<ViewMode>(
    role === 'enseignant' ? 'teacher' : 'global'
  )
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    role === 'enseignant' ? currentUserId : ''
  )
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  // Map teacher_id (teachers table) → profile_id (profiles/user_id)
  const teacherProfileMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const t of teachers) {
      if (t.user_id) map[t.id] = t.user_id
    }
    return map
  }, [teachers])

  // View type: week or month
  const [viewType, setViewType] = useState<'week' | 'month'>('month')
  const [monthOffset, setMonthOffset] = useState(0)

  const currentMonth = useMemo(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    return { month: d.getMonth(), year: d.getFullYear() }
  }, [monthOffset])

  const isCurrentMonth = monthOffset === 0

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<SlotData | null>(null)
  const [editMode, setEditMode] = useState<'all' | 'this_only' | null>(null)
  const [editDate, setEditDate] = useState<string | null>(null)
  const [prefillDay, setPrefillDay] = useState<number | null>(null)
  const [prefillTime, setPrefillTime] = useState<string | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slot: ResolvedSlot; isLastCol: boolean } | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)

  // Custom dropdowns
  const [classDropOpen, setClassDropOpen] = useState(false)
  const [teacherDropOpen, setTeacherDropOpen] = useState(false)
  const classDropRef = useRef<HTMLDivElement>(null)
  const teacherDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (classDropRef.current && !classDropRef.current.contains(e.target as Node)) setClassDropOpen(false)
      if (teacherDropRef.current && !teacherDropRef.current.contains(e.target as Node)) setTeacherDropOpen(false)
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ─── Week navigation ──────────────────────────────────────────────────────

  const [weekOffset, setWeekOffset] = useState(0)
  const orderedDays = useMemo(() => buildDayOrder(weekStartDay), [weekStartDay])

  const currentWeekStart = useMemo(() => {
    const m = getWeekStartOf(new Date(), weekStartDay)
    m.setDate(m.getDate() + weekOffset * 7)
    return m
  }, [weekOffset, weekStartDay])

  const currentWeekEnd = useMemo(() => {
    const s = new Date(currentWeekStart)
    s.setDate(currentWeekStart.getDate() + 6)
    return s
  }, [currentWeekStart])

  const weekNum = getWeekNumber(currentWeekStart)
  const isCurrentWeek = weekOffset === 0

  // Map: dayOfWeek → date string "YYYY-MM-DD"
  const weekDayDates = useMemo(() => {
    const map: Record<number, string> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart)
      d.setDate(currentWeekStart.getDate() + i)
      map[d.getDay()] = formatDate(d)
    }
    return map
  }, [currentWeekStart])

  // Map: dayOfWeek → "DD/MM/YYYY" for display
  const dayDatesDisplay = useMemo(() => {
    const map: Record<number, string> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart)
      d.setDate(currentWeekStart.getDate() + i)
      map[d.getDay()] = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }
    return map
  }, [currentWeekStart])

  const todayRealDow = new Date().getDay()
  const todayDow = isCurrentWeek ? todayRealDow : -1

  // ─── Resolve slots for this week ──────────────────────────────────────────

  // Helper : la date est-elle en vacances ?
  const getVacationLabel = useCallback((dateStr: string): string | null => {
    for (const v of vacations) {
      if (dateStr >= v.start_date && dateStr <= v.end_date) return v.label || 'Vacances'
    }
    return null
  }, [vacations])

  // Helper : la date est-elle dans la période scolaire et hors vacances ?
  const isSchoolDay = useCallback((dateStr: string) => {
    if (schoolYearStartDate && dateStr < schoolYearStartDate) return false
    if (schoolYearEndDate && dateStr > schoolYearEndDate) return false
    if (getVacationLabel(dateStr)) return false
    return true
  }, [schoolYearStartDate, schoolYearEndDate, getVacationLabel])

  const resolvedSlots = useMemo(() => {
    const result: ResolvedSlot[] = []
    const weekDates = Object.values(weekDayDates)

    // 1. Recurring slots
    for (const slot of slots) {
      if (!slot.is_recurring || slot.day_of_week === null) continue
      const date = weekDayDates[slot.day_of_week]
      if (!date) continue

      // Ne pas afficher si hors période effective du créneau
      if (!isSlotEffective(slot, date)) continue

      // Ne pas afficher hors période scolaire ou en vacances
      if (!isSchoolDay(date)) continue

      // Check for exception on this date
      const exception = exceptions.find(
        ex => ex.schedule_slot_id === slot.id && ex.exception_date === date
      )

      if (exception?.exception_type === 'cancelled') continue // Don't show

      if (exception?.exception_type === 'modified') {
        // Show with overrides
        result.push({
          id: `${slot.id}-${date}`,
          sourceSlotId: slot.id,
          isRecurring: true,
          isModified: true,
          exceptionId: exception.id,
          date,
          dayOfWeek: slot.day_of_week,
          class_id: slot.class_id,
          teacher_id: exception.override_teacher_id ?? slot.teacher_id,
          cours_id: slot.cours_id,
          room_id: exception.override_room_id ?? slot.room_id,
          start_time: exception.override_start_time ?? slot.start_time,
          end_time: exception.override_end_time ?? slot.end_time,
          slot_type: slot.slot_type,
          color: slot.color,
          classes: slot.classes,
          teachers: exception.override_teacher_id
            ? teachers.find(t => t.id === exception.override_teacher_id) as any
            : slot.teachers,
          cours: slot.cours,
          rooms: exception.override_room_id
            ? rooms.find(r => r.id === exception.override_room_id) as any
            : slot.rooms,
        })
      } else {
        // Normal recurring
        result.push({
          id: `${slot.id}-${date}`,
          sourceSlotId: slot.id,
          isRecurring: true,
          isModified: false,
          date,
          dayOfWeek: slot.day_of_week,
          class_id: slot.class_id,
          teacher_id: slot.teacher_id,
          cours_id: slot.cours_id,
          room_id: slot.room_id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          slot_type: slot.slot_type,
          color: slot.color,
          classes: slot.classes,
          teachers: slot.teachers,
          cours: slot.cours,
          rooms: slot.rooms,
        })
      }
    }

    // 2. Ponctual slots
    for (const slot of slots) {
      if (slot.is_recurring || !slot.slot_date) continue
      if (!weekDates.includes(slot.slot_date)) continue

      const d = new Date(slot.slot_date)
      result.push({
        id: slot.id,
        sourceSlotId: slot.id,
        isRecurring: false,
        isModified: false,
        date: slot.slot_date,
        dayOfWeek: d.getDay(),
        class_id: slot.class_id,
        teacher_id: slot.teacher_id,
        cours_id: slot.cours_id,
        room_id: slot.room_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        slot_type: slot.slot_type,
        color: slot.color,
        classes: slot.classes,
        teachers: slot.teachers,
        cours: slot.cours,
        rooms: slot.rooms,
      })
    }

    return result
  }, [slots, exceptions, weekDayDates, teachers, rooms, isSchoolDay])

  // ─── Month-scoped resolved slots ─────────────────────────────────────────

  const resolvedMonthSlots = useMemo(() => {
    if (viewType !== 'month') return []

    const result: ResolvedSlot[] = []
    const firstOfMonth = new Date(currentMonth.year, currentMonth.month, 1)
    const lastOfMonth = new Date(currentMonth.year, currentMonth.month + 1, 0)

    // Extend to full calendar weeks
    const firstDow = firstOfMonth.getDay()
    const offset = (firstDow - weekStartDay + 7) % 7
    const calStart = new Date(currentMonth.year, currentMonth.month, 1 - offset)
    const cursor = new Date(calStart)
    const allDates: string[] = []
    while (cursor <= lastOfMonth || allDates.length % 7 !== 0) {
      allDates.push(formatDate(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    // Build a datesByDow map for recurring lookup
    const datesByDow: Record<number, string[]> = {}
    for (const dateStr of allDates) {
      const d = new Date(dateStr + 'T00:00:00')
      const dow = d.getDay()
      if (!datesByDow[dow]) datesByDow[dow] = []
      datesByDow[dow].push(dateStr)
    }

    // 1. Recurring slots
    for (const slot of slots) {
      if (!slot.is_recurring || slot.day_of_week === null) continue
      const dates = datesByDow[slot.day_of_week] ?? []

      for (const date of dates) {
        if (!isSlotEffective(slot, date)) continue
        if (!isSchoolDay(date)) continue

        const exception = exceptions.find(
          ex => ex.schedule_slot_id === slot.id && ex.exception_date === date
        )

        if (exception?.exception_type === 'cancelled') continue

        if (exception?.exception_type === 'modified') {
          result.push({
            id: `${slot.id}-${date}`,
            sourceSlotId: slot.id,
            isRecurring: true,
            isModified: true,
            exceptionId: exception.id,
            date,
            dayOfWeek: slot.day_of_week,
            class_id: slot.class_id,
            teacher_id: exception.override_teacher_id ?? slot.teacher_id,
            cours_id: slot.cours_id,
            room_id: exception.override_room_id ?? slot.room_id,
            start_time: exception.override_start_time ?? slot.start_time,
            end_time: exception.override_end_time ?? slot.end_time,
            slot_type: slot.slot_type,
            color: slot.color,
            classes: slot.classes,
            teachers: exception.override_teacher_id
              ? teachers.find(t => t.id === exception.override_teacher_id) as any
              : slot.teachers,
            cours: slot.cours,
            rooms: exception.override_room_id
              ? rooms.find(r => r.id === exception.override_room_id) as any
              : slot.rooms,
          })
        } else {
          result.push({
            id: `${slot.id}-${date}`,
            sourceSlotId: slot.id,
            isRecurring: true,
            isModified: false,
            date,
            dayOfWeek: slot.day_of_week,
            class_id: slot.class_id,
            teacher_id: slot.teacher_id,
            cours_id: slot.cours_id,
            room_id: slot.room_id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            slot_type: slot.slot_type,
            color: slot.color,
            classes: slot.classes,
            teachers: slot.teachers,
            cours: slot.cours,
            rooms: slot.rooms,
          })
        }
      }
    }

    // 2. Ponctual slots
    for (const slot of slots) {
      if (slot.is_recurring || !slot.slot_date) continue
      if (!allDates.includes(slot.slot_date)) continue

      const d = new Date(slot.slot_date + 'T00:00:00')
      result.push({
        id: slot.id,
        sourceSlotId: slot.id,
        isRecurring: false,
        isModified: false,
        date: slot.slot_date,
        dayOfWeek: d.getDay(),
        class_id: slot.class_id,
        teacher_id: slot.teacher_id,
        cours_id: slot.cours_id,
        room_id: slot.room_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        slot_type: slot.slot_type,
        color: slot.color,
        classes: slot.classes,
        teachers: slot.teachers,
        cours: slot.cours,
        rooms: slot.rooms,
      })
    }

    return result
  }, [viewType, currentMonth, slots, exceptions, teachers, rooms, isSchoolDay, weekStartDay])

  // Filter month slots by view mode
  const filteredMonthSlots = useMemo(() => {
    if (viewMode === 'class' && selectedClassId) {
      return resolvedMonthSlots.filter(s => s.class_id === selectedClassId)
    }
    if (viewMode === 'teacher' && selectedTeacherId) {
      return resolvedMonthSlots.filter(s => s.teacher_id === selectedTeacherId)
    }
    return resolvedMonthSlots
  }, [resolvedMonthSlots, viewMode, selectedClassId, selectedTeacherId])

  // ─── Computed ─────────────────────────────────────────────────────────────

  const activeDays = selectedDay !== null ? [selectedDay] : orderedDays

  // Semaine entière en vacances ?
  const isFullWeekVacation = useMemo(() => {
    return orderedDays.every(d => {
      const dateStr = weekDayDates[d]
      return dateStr ? !isSchoolDay(dateStr) : false
    })
  }, [orderedDays, weekDayDates, isSchoolDay])
  const startHour = DEFAULT_START
  const endHour = DEFAULT_END

  const hours = useMemo(() => {
    const arr: number[] = []
    for (let h = startHour; h < endHour; h++) arr.push(h)
    return arr
  }, [startHour, endHour])

  // Filter by view
  const filteredSlots = useMemo(() => {
    if (viewMode === 'class' && selectedClassId) {
      return resolvedSlots.filter(s => s.class_id === selectedClassId)
    }
    if (viewMode === 'teacher' && selectedTeacherId) {
      return resolvedSlots.filter(s => s.teacher_id === selectedTeacherId)
    }
    return resolvedSlots
  }, [resolvedSlots, viewMode, selectedClassId, selectedTeacherId])

  // Group by day
  const slotsByDay = useMemo(() => {
    const map: Record<number, ResolvedSlot[]> = {}
    for (const d of activeDays) map[d] = []
    for (const s of filteredSlots) {
      if (map[s.dayOfWeek]) map[s.dayOfWeek].push(s)
    }
    return map
  }, [filteredSlots, activeDays])

  // ─── Refresh data ─────────────────────────────────────────────────────────

  const refreshData = useCallback(async () => {
    const [{ data: freshSlots }, { data: freshExceptions }] = await Promise.all([
      supabase
        .from('schedule_slots')
        .select('*, classes(name), teachers(first_name, last_name, civilite), cours(nom_fr), rooms(name)')
        .eq('school_year_id', schoolYearId)
        .eq('is_active', true)
        .order('start_time'),
      supabase
        .from('schedule_exceptions')
        .select('*'),
    ])
    if (freshSlots) setSlots(freshSlots as any[])
    if (freshExceptions) setExceptions(freshExceptions as any[])
  }, [supabase, schoolYearId])

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  // Date effective : aujourd'hui si en cours d'année, sinon date de rentrée
  const getEffectiveDate = useCallback(() => {
    const today = formatDate(new Date())
    if (schoolYearStartDate && schoolYearEndDate && today >= schoolYearStartDate && today <= schoolYearEndDate) {
      return today
    }
    return schoolYearStartDate ?? today
  }, [schoolYearStartDate, schoolYearEndDate])

  const handleSaveSlot = useCallback(async (data: {
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
    pivotDate?: string // date du créneau cliqué (EDT) — si absent, on utilise aujourd'hui/rentrée
  }) => {
    // Date pivot : celle du créneau (EDT) ou aujourd'hui/rentrée (ClassForm)
    const pivotDate = data.pivotDate ?? getEffectiveDate()
    const isInSchoolYear = schoolYearStartDate && schoolYearEndDate
      && pivotDate >= schoolYearStartDate && pivotDate <= schoolYearEndDate

    const basePayload = {
      school_year_id: schoolYearId,
      class_id: data.class_id,
      teacher_id: data.teacher_id,
      cours_id: data.cours_id || null,
      room_id: data.room_id || null,
      is_recurring: data.is_recurring,
      day_of_week: data.is_recurring ? data.day_of_week : null,
      slot_date: data.is_recurring ? null : data.slot_date,
      start_time: data.start_time,
      end_time: data.end_time,
      slot_type: data.slot_type,
    }

    if (data.id && data.editAll && data.is_recurring) {
      // ── Modifier tous les créneaux (récurrent) ──
      const oldSlot = slots.find(s => s.id === data.id)

      if (isInSchoolYear && oldSlot) {
        // En cours d'année : clôturer l'ancien (veille du pivot) + créer un nouveau (à partir du pivot)
        const pivotD = new Date(pivotDate + 'T00:00:00')
        pivotD.setDate(pivotD.getDate() - 1)
        const dayBefore = formatDate(pivotD)

        // Clôturer l'ancien
        await supabase
          .from('schedule_slots')
          .update({ effective_until: dayBefore })
          .eq('id', data.id)

        // Créer le nouveau créneau avec effective_from = pivotDate
        const { error } = await supabase.from('schedule_slots').insert({
          ...basePayload,
          effective_from: pivotDate,
          effective_until: null,
        })
        if (error) { alert('Erreur : ' + error.message); return }
      } else {
        // Hors année scolaire : simple mise à jour + effective_from = rentrée
        const effectiveFrom = schoolYearStartDate ?? pivotDate
        const { error } = await supabase.from('schedule_slots').update({
          ...basePayload,
          effective_from: effectiveFrom,
        }).eq('id', data.id)
        if (error) { alert('Erreur : ' + error.message); return }
      }

      // Mettre à jour la fiche classe
      if (data.day_of_week !== null) {
        const dayName = DAY_LABELS[data.day_of_week] ?? ''
        await supabase
          .from('classes')
          .update({ day_of_week: dayName, start_time: data.start_time, end_time: data.end_time })
          .eq('id', data.class_id)
      }

      // Supprimer les exceptions à partir du pivot (liées à l'ancien créneau)
      await supabase
        .from('schedule_exceptions')
        .delete()
        .eq('schedule_slot_id', data.id)
        .gte('exception_date', pivotDate)

      // Log détaillé
      const cls = classesRef.current.find(c => c.id === data.class_id)
      const dayLabel = data.day_of_week !== null ? DAY_LABELS[data.day_of_week] : ''
      logAudit(supabase, {
        action: 'UPDATE',
        entityType: 'schedule_slots',
        entityId: data.id,
        description: `Modification créneau EDT pour ${cls?.name ?? 'classe'} : ${dayLabel} ${data.start_time}–${data.end_time}, à partir du ${new Date(pivotDate + 'T00:00:00').toLocaleDateString('fr-FR')}`,
      })

    } else if (data.id) {
      // ── Modifier un créneau existant (ponctuel ou this_only via exception) ──
      const { error } = await supabase.from('schedule_slots').update(basePayload).eq('id', data.id)
      if (error) { alert('Erreur : ' + error.message); return }

      const cls = classesRef.current.find(c => c.id === data.class_id)
      const dayLabel = data.day_of_week !== null ? DAY_LABELS[data.day_of_week] : ''
      const dateInfo = data.slot_date ? ` le ${new Date(data.slot_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''
      logAudit(supabase, {
        action: 'UPDATE',
        entityType: 'schedule_slots',
        entityId: data.id,
        description: `Modification créneau ${data.is_recurring ? 'récurrent' : 'ponctuel'} pour ${cls?.name ?? 'classe'} : ${dayLabel} ${data.start_time}–${data.end_time}${dateInfo}`,
      })

    } else {
      // ── Nouveau créneau ──
      const effectiveFrom = data.is_recurring ? getEffectiveDate() : null
      const { error } = await supabase.from('schedule_slots').insert({
        ...basePayload,
        effective_from: effectiveFrom,
        effective_until: null,
      })
      if (error) { alert('Erreur : ' + error.message); return }

      const cls = classesRef.current.find(c => c.id === data.class_id)
      const dayLabel = data.day_of_week !== null ? DAY_LABELS[data.day_of_week] : ''
      const dateInfo = data.slot_date ? ` le ${new Date(data.slot_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''
      const fromInfo = effectiveFrom ? `, à partir du ${new Date(effectiveFrom + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''
      logAudit(supabase, {
        action: 'INSERT',
        entityType: 'schedule_slots',
        description: `Nouveau créneau ${data.is_recurring ? 'récurrent' : 'ponctuel'} pour ${cls?.name ?? 'classe'} : ${dayLabel} ${data.start_time}–${data.end_time}${dateInfo}${fromInfo}`,
      })
    }

    await refreshData()
    setModalOpen(false)
    setEditingSlot(null)
    setEditMode(null)
    setEditDate(null)
  }, [supabase, schoolYearId, slots, schoolYearStartDate, schoolYearEndDate, getEffectiveDate, refreshData])

  /** Save a "this day only" modification as an exception */
  const handleSaveException = useCallback(async (data: {
    schedule_slot_id: string
    exception_date: string
    start_time: string
    end_time: string
    teacher_id: string
    room_id: string | null
  }) => {
    const slot = slots.find(s => s.id === data.schedule_slot_id)
    if (!slot) return

    const needsOverride =
      data.start_time !== slot.start_time.slice(0, 5) ||
      data.end_time !== slot.end_time.slice(0, 5) ||
      data.teacher_id !== slot.teacher_id ||
      (data.room_id ?? null) !== (slot.room_id ?? null)

    if (!needsOverride) {
      setModalOpen(false)
      return
    }

    // Check if exception already exists
    const existing = exceptions.find(
      ex => ex.schedule_slot_id === data.schedule_slot_id && ex.exception_date === data.exception_date
    )

    const payload = {
      schedule_slot_id: data.schedule_slot_id,
      exception_date: data.exception_date,
      exception_type: 'modified' as const,
      override_start_time: data.start_time !== slot.start_time.slice(0, 5) ? data.start_time : null,
      override_end_time: data.end_time !== slot.end_time.slice(0, 5) ? data.end_time : null,
      override_teacher_id: data.teacher_id !== slot.teacher_id ? data.teacher_id : null,
      override_room_id: (data.room_id ?? null) !== (slot.room_id ?? null) ? data.room_id : null,
    }

    if (existing) {
      const { error } = await supabase.from('schedule_exceptions').update(payload).eq('id', existing.id)
      if (error) { alert('Erreur : ' + error.message); return }
    } else {
      const { error } = await supabase.from('schedule_exceptions').insert(payload)
      if (error) { alert('Erreur : ' + error.message); return }
    }

    // Log détaillé
    const cls = classesRef.current.find(c => c.id === slot.class_id)
    const dateStr = new Date(data.exception_date + 'T00:00:00').toLocaleDateString('fr-FR')
    logAudit(supabase, {
      action: existing ? 'UPDATE' : 'INSERT',
      entityType: 'schedule_exceptions',
      description: `Modification ponctuelle créneau ${cls?.name ?? 'classe'} du ${dateStr} : ${data.start_time}–${data.end_time}`,
    })

    await refreshData()
    setModalOpen(false)
    setEditingSlot(null)
    setEditMode(null)
    setEditDate(null)
  }, [supabase, slots, exceptions, refreshData])

  const handleDeleteSlot = useCallback(async (slotId: string, pivotDate?: string) => {
    const slot = slots.find(s => s.id === slotId)
    if (!slot) return

    const className = slot.classes?.name ?? 'la classe'
    // Date pivot : date du créneau (EDT) ou aujourd'hui (ClassForm)
    const pivot = pivotDate ?? formatDate(new Date())
    const isInSchoolYear = schoolYearStartDate && schoolYearEndDate
      && pivot >= schoolYearStartDate && pivot <= schoolYearEndDate

    if (slot.is_recurring && isInSchoolYear) {
      // En cours d'année : clôturer le créneau (conserver l'historique)
      if (!confirm(`Supprimer tous les créneaux à partir de cette date ?\n\nLe planning passé de ${className} sera conservé. La fiche classe sera réinitialisée.`)) return

      const pivotD = new Date(pivot + 'T00:00:00')
      pivotD.setDate(pivotD.getDate() - 1)
      const dayBefore = formatDate(pivotD)

      await supabase
        .from('schedule_slots')
        .update({ effective_until: dayBefore })
        .eq('id', slotId)

      // Supprimer les exceptions à partir du pivot
      await supabase
        .from('schedule_exceptions')
        .delete()
        .eq('schedule_slot_id', slotId)
        .gte('exception_date', pivot)
    } else {
      // Hors année scolaire ou ponctuel : suppression définitive
      if (!confirm(`Supprimer tous les créneaux définitivement ?\n\nCela va également réinitialiser le planning (jour/horaires) de la fiche ${className}.`)) return

      await supabase.from('schedule_exceptions').delete().eq('schedule_slot_id', slotId)
      await supabase.from('schedule_slots').delete().eq('id', slotId)
    }

    // Réinitialiser le planning de la fiche classe
    if (slot.is_recurring) {
      await supabase
        .from('classes')
        .update({ day_of_week: null, start_time: null, end_time: null })
        .eq('id', slot.class_id)
    }

    // Log détaillé
    const dayLabel = slot.day_of_week !== null ? DAY_LABELS[slot.day_of_week] : ''
    const pivotInfo = isInSchoolYear ? `, à partir du ${new Date(pivot + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''
    logAudit(supabase, {
      action: 'DELETE',
      entityType: 'schedule_slots',
      entityId: slotId,
      description: `Suppression créneau EDT pour ${className} (${dayLabel} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)})${pivotInfo}. Fiche classe réinitialisée.`,
    })

    await refreshData()
  }, [supabase, slots, schoolYearStartDate, schoolYearEndDate, refreshData])

  const handleCancelForDate = useCallback(async (slotId: string, date: string) => {
    const existing = exceptions.find(
      ex => ex.schedule_slot_id === slotId && ex.exception_date === date
    )

    if (existing) {
      const { error } = await supabase.from('schedule_exceptions')
        .update({ exception_type: 'cancelled', override_start_time: null, override_end_time: null, override_teacher_id: null, override_room_id: null })
        .eq('id', existing.id)
      if (error) { alert('Erreur : ' + error.message); return }
    } else {
      const { error } = await supabase.from('schedule_exceptions')
        .insert({ schedule_slot_id: slotId, exception_date: date, exception_type: 'cancelled' })
      if (error) { alert('Erreur : ' + error.message); return }
    }

    // Log détaillé
    const slot = slots.find(s => s.id === slotId)
    const cls = classesRef.current.find(c => c.id === slot?.class_id)
    const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR')
    logAudit(supabase, {
      action: 'UPDATE',
      entityType: 'schedule_exceptions',
      description: `Annulation créneau ${cls?.name ?? 'classe'} du ${dateStr}`,
    })

    await refreshData()
    setContextMenu(null)
  }, [supabase, slots, exceptions, refreshData])

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  // ─── Validation présence ──────────────────────────────────────────────────

  const handleValidate = useCallback(async (resolved: ResolvedSlot) => {
    const teacherName = resolved.teachers
      ? `${resolved.teachers.civilite === 'Mme' ? 'Mme' : 'M.'} ${resolved.teachers.last_name}`
      : 'cet enseignant'
    const slotDate = resolved.date
    const [y, m, d] = slotDate.split('-')
    const dateLabel = `${d}/${m}/${y}`

    if (!confirm(`Valider la presence de ${teacherName} le ${dateLabel} (${resolved.start_time.slice(0, 5)}-${resolved.end_time.slice(0, 5)}) ?`)) return

    const teacherProfileId = teacherProfileMap[resolved.teacher_id]
    if (!teacherProfileId) {
      alert(`${teacherName} n'a pas de compte utilisateur lie. Veuillez d'abord lier un compte dans la fiche enseignant.`)
      return
    }
    const durationMin = timeToMinutes(resolved.end_time) - timeToMinutes(resolved.start_time)

    const { data: timeEntry, error: teErr } = await supabase
      .from('staff_time_entries')
      .insert({
        profile_id: teacherProfileId,
        entry_date: slotDate,
        entry_type: resolved.slot_type,
        start_time: resolved.start_time,
        end_time: resolved.end_time,
        duration_minutes: durationMin,
        recorded_by: currentUserId,
      })
      .select('id')
      .single()

    if (teErr) { alert('Erreur : ' + teErr.message); return }

    const { data: val, error: valErr } = await supabase
      .from('schedule_validations')
      .insert({
        schedule_slot_id: resolved.sourceSlotId,
        profile_id: teacherProfileId,
        validation_date: slotDate,
        time_entry_id: timeEntry?.id ?? null,
      })
      .select('*')
      .single()

    if (valErr) { alert('Erreur : ' + valErr.message); return }
    if (val) setValidations(prev => [...prev, val as any])
  }, [supabase, currentUserId, teacherProfileMap])

  const handleCancelValidation = useCallback(async (sourceSlotId: string, slotDate: string) => {
    if (!confirm('Annuler cette validation de presence ?')) return
    const v = validations.find(v => v.schedule_slot_id === sourceSlotId && v.validation_date === slotDate)
    if (!v) return
    if (v.time_entry_id) {
      await supabase.from('staff_time_entries').delete().eq('id', v.time_entry_id)
    }
    await supabase.from('schedule_validations').delete().eq('id', v.id)
    setValidations(prev => prev.filter(x => x.id !== v.id))
  }, [validations, supabase])

  const isValidated = useCallback((sourceSlotId: string, slotDate: string) => {
    return validations.some(v => v.schedule_slot_id === sourceSlotId && v.validation_date === slotDate)
  }, [validations])

  // ─── Open modal helpers ───────────────────────────────────────────────────

  const openNewSlot = (day?: number, time?: string, date?: string) => {
    setEditingSlot(null)
    setEditMode(null)
    setEditDate(null)
    setPrefillDay(day ?? null)
    setPrefillTime(time ?? null)
    setPrefillDate(date ?? null)
    setModalOpen(true)
  }

  const openEditAll = (resolved: ResolvedSlot) => {
    const source = slots.find(s => s.id === resolved.sourceSlotId)
    if (!source) return
    setEditingSlot(source)
    setEditMode('all')
    setEditDate(resolved.date)
    setModalOpen(true)
    setContextMenu(null)
  }

  const openEditThisOnly = (resolved: ResolvedSlot) => {
    const source = slots.find(s => s.id === resolved.sourceSlotId)
    if (!source) return
    setEditingSlot(source)
    setEditMode('this_only')
    setEditDate(resolved.date)
    setModalOpen(true)
    setContextMenu(null)
  }

  // Context menu for right-click on recurring slot
  const handleSlotContextMenu = (e: React.MouseEvent, resolved: ResolvedSlot) => {
    if (!canEdit || !resolved.isRecurring) return
    e.preventDefault()
    e.stopPropagation()
    const dayIndex = activeDays.indexOf(resolved.dayOfWeek)
    const isLastCol = dayIndex === activeDays.length - 1
    // Use nativeEvent for accurate mouse position (dnd-kit can alter React event)
    const x = e.nativeEvent.clientX
    const y = e.nativeEvent.clientY
    setContextMenu({ x, y, slot: resolved, isLastCol })
  }

  const handleSlotClick = (resolved: ResolvedSlot) => {
    if (!canEdit) return
    if (resolved.isRecurring) {
      // For recurring: show context menu options inline
      // Actually open edit all by default, context menu for other options
      openEditAll(resolved)
    } else {
      // For ponctual: direct edit
      const source = slots.find(s => s.id === resolved.sourceSlotId)
      if (source) {
        setEditingSlot(source)
        setEditMode('all')
        setEditDate(null)
        setModalOpen(true)
      }
    }
  }

  // ─── Selected labels ──────────────────────────────────────────────────────

  const selectedClass = classes.find(c => c.id === selectedClassId)
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-2 p-2">
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
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

        {/* Class select */}
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
                <span className="text-warm-400">— Sélectionner une classe —</span>
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

        {/* Class info line */}
        {selectedClassId && viewMode === 'class' && (() => {
          const cls = classes.find(c => c.id === selectedClassId)
          if (!cls) return null
          const info = classInfoLine(cls)
          return info ? <span className="text-sm font-medium text-warm-600 whitespace-nowrap">{info}</span> : null
        })()}

        <div className="flex-1" />

        {/* View type toggle: Semaine / Mois */}
        <div className="flex rounded-lg overflow-hidden text-xs font-medium border border-warm-200">
          <button
            onClick={() => setViewType('week')}
            className={clsx(
              'flex items-center gap-1 px-2.5 py-1.5 transition-colors',
              viewType === 'week' ? 'bg-warm-700 text-white' : 'bg-white text-warm-500 hover:bg-warm-50',
            )}
          >
            <LayoutGrid size={12} />
            Semaine
          </button>
          <button
            onClick={() => setViewType('month')}
            className={clsx(
              'flex items-center gap-1 px-2.5 py-1.5 transition-colors',
              viewType === 'month' ? 'bg-warm-700 text-white' : 'bg-white text-warm-500 hover:bg-warm-50',
            )}
          >
            <CalendarDays size={12} />
            Mois
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => viewType === 'week' ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1)}
            className="p-1 rounded-lg hover:bg-warm-100 text-warm-400 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium whitespace-nowrap px-2 py-1 text-warm-500 select-none capitalize">
            {viewType === 'week'
              ? `S${weekNum} — ${fmtDateFull(currentWeekStart)} au ${fmtDateFull(currentWeekEnd)} ${currentWeekEnd.getFullYear()}`
              : `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`
            }
          </span>
          <button
            onClick={() => viewType === 'week' ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1)}
            className="p-1 rounded-lg hover:bg-warm-100 text-warm-400 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          {((viewType === 'week' && !isCurrentWeek) || (viewType === 'month' && !isCurrentMonth)) && (
            <button
              onClick={() => viewType === 'week' ? setWeekOffset(0) : setMonthOffset(0)}
              className="p-1 rounded-lg hover:bg-warm-100 text-amber-600 transition-colors"
              title={viewType === 'week' ? 'Revenir à la semaine courante' : 'Revenir au mois courant'}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Add slot button */}
        {canEdit && (
          <button
            onClick={() => openNewSlot()}
            disabled={viewType === 'week' && isFullWeekVacation}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              viewType === 'week' && isFullWeekVacation
                ? 'bg-warm-200 text-warm-400 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            )}
          >
            <Plus size={14} />
            Nouveau créneau
          </button>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      {viewType === 'week' ? (
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
                <span className="text-[10px] font-normal opacity-60 ml-1">{dayDatesDisplay[d]}</span>
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
            {activeDays.map(d => {
              const dateStr = weekDayDates[d]
              const vacLabel = dateStr ? getVacationLabel(dateStr) : null
              const canValidate = !!dateStr && dateStr <= todayStr
              return (
                <DayColumn
                  key={d}
                  day={d}
                  dateStr={dateStr ?? ''}
                  slots={slotsByDay[d] ?? []}
                  startHour={startHour}
                  endHour={endHour}
                  isToday={d === todayDow}
                  canValidate={canValidate}
                  canEdit={canEdit}
                  viewMode={viewMode}
                  isTeacher={role === 'enseignant'}
                  vacationLabel={vacLabel}
                  isValidated={(sourceSlotId, slotDate) => isValidated(sourceSlotId, slotDate)}
                  onValidate={(resolved) => handleValidate(resolved)}
                  onCancelValidation={(sourceSlotId, slotDate) => handleCancelValidation(sourceSlotId, slotDate)}
                  onClickSlot={handleSlotClick}
                  onContextMenuSlot={handleSlotContextMenu}
                  onClickEmpty={(day, time) => canEdit && openNewSlot(day, time)}
                  onDeleteSlot={(sourceSlotId) => handleDeleteSlot(sourceSlotId)}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
          <MonthGrid
            month={currentMonth.month}
            year={currentMonth.year}
            orderedDays={orderedDays}
            slots={filteredMonthSlots}
            viewMode={viewMode}
            canEdit={canEdit}
            isSchoolDay={isSchoolDay}
            getVacationLabel={getVacationLabel}
            onClickSlot={handleSlotClick}
            onContextMenuSlot={handleSlotContextMenu}
            onClickEmpty={(day, time, date) => canEdit && openNewSlot(day, time, date)}
          />
        </div>
      )}


      {/* ── Context menu (portal pour éviter le containing block de animate-fade-in) ── */}
      {contextMenu && createPortal(
        <div
          ref={contextRef}
          className="fixed bg-white rounded-xl shadow-xl border border-warm-200 z-[100] py-1 w-56"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            ...(contextMenu.isLastCol
              ? { right: window.innerWidth - contextMenu.x }
              : { left: contextMenu.x }),
          }}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-warm-50 text-warm-700"
            onClick={() => openEditThisOnly(contextMenu.slot)}
          >
            Modifier ce créneau
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-warm-50 text-warm-700"
            onClick={() => {
              handleCancelForDate(contextMenu.slot.sourceSlotId, contextMenu.slot.date)
            }}
          >
            Supprimer ce créneau
          </button>
          <div className="border-t border-warm-100 my-1" />
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-warm-50 text-warm-700"
            onClick={() => openEditAll(contextMenu.slot)}
          >
            Modifier tous les créneaux
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-warm-50 text-red-600"
            onClick={() => {
              handleDeleteSlot(contextMenu.slot.sourceSlotId, contextMenu.slot.date)
              setContextMenu(null)
            }}
          >
            Supprimer tous les créneaux
          </button>
        </div>,
        document.body
      )}

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {modalOpen && (
        <SlotFormModal
          key={`${editingSlot?.id ?? 'new'}-${prefillDate}-${prefillDay}-${prefillTime}`}
          slot={editingSlot}
          editMode={editMode}
          editDate={editDate}
          prefillDay={prefillDay ?? selectedDay}
          prefillTime={prefillTime}
          prefillDate={prefillDate}
          prefillClassId={selectedClassId}
          prefillTeacherId={viewMode === 'teacher' && teachers.some(t => t.id === selectedTeacherId) ? selectedTeacherId : ''}
          weekDayDates={weekDayDates}
          classes={classes}
          teachers={teachers}
          rooms={rooms}
          existingSlots={slots}
          vacations={vacations}
          onSave={handleSaveSlot}
          onSaveException={handleSaveException}
          onClose={() => { setModalOpen(false); setEditingSlot(null); setEditMode(null); setEditDate(null) }}
        />
      )}
    </div>
  )
}
