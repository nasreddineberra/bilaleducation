'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import { Search, X, Users, CheckCircle2, GripVertical, ChevronDown, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const POOL_PAGE_SIZE = 20

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherInfo { first_name: string; last_name: string }
interface ClassTeacherRow { is_main_teacher: boolean; subject: string | null; teachers: TeacherInfo | null }

interface ClassRow {
  id:           string
  name:         string
  level:        string
  max_students: number
  day_of_week:  string | null
  start_time:   string | null
  end_time:     string | null
  room_number:  string | null
  class_teachers: ClassTeacherRow[]
}

interface StudentRow {
  id:             string
  first_name:     string
  last_name:      string
  student_number: string
  has_pai:        boolean
  date_of_birth:  string
  gender:         string | null
  city:           string | null
  medical_notes:  string | null
}

interface EnrollmentRow {
  student_id: string
  class_id:   string
}

interface Props {
  classes:     ClassRow[]
  students:    StudentRow[]
  enrollments: EnrollmentRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const DAYS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

function fmtTime(t: string | null) { return t ? t.slice(0, 5) : null }

// ─── Badge genre ──────────────────────────────────────────────────────────────

function GenderBadge({ gender }: { gender: string | null }) {
  if (gender === 'male') return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex-shrink-0">M</span>
  )
  if (gender === 'female') return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pink-100 text-pink-500 text-[9px] font-bold flex-shrink-0">F</span>
  )
  return null
}

// ─── Tooltip identité (fixed, hors du conteneur scrollable) ──────────────────

function StudentTooltip({ student, top, left }: { student: StudentRow; top: number; left: number }) {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1200
  const t  = Math.max(8, Math.min(top, vh - 230))
  const l  = Math.min(left, vw - 220)

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ top: t, left: l }}
    >
      <div className="bg-secondary-800 text-white rounded-xl shadow-xl p-3 w-52 text-xs leading-relaxed">
        {/* Nom complet */}
        <span className="block font-bold text-white text-sm mb-1">
          {student.last_name} {student.first_name}
        </span>
        {/* N° élève */}
        <span className="block font-mono text-secondary-300 mb-2">{student.student_number}</span>
        <span className="block border-t border-white/10 mb-2" />
        {/* Naissance + âge */}
        <span className="block text-secondary-300">
          Né(e) le <span className="text-white font-medium">{fmtDate(student.date_of_birth)}</span>
          <span className="ml-1 text-secondary-400">({calcAge(student.date_of_birth)} ans)</span>
        </span>
        {/* PAI */}
        {student.has_pai && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-red-400 bg-red-900/40 px-1.5 py-0.5 rounded">
            PAI
          </span>
        )}
        {/* Notes médicales */}
        {student.medical_notes && (
          <span className="block text-secondary-400 mt-1 text-[10px] italic line-clamp-2">
            {student.medical_notes}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Carte élève draggable ────────────────────────────────────────────────────

function DraggableCard({
  student, disabled, assignedClassName, assignedClassTeacher, onInfoEnter, onInfoLeave,
}: {
  student:               StudentRow
  disabled:              boolean
  assignedClassName?:    string
  assignedClassTeacher?: string | null
  onInfoEnter?:          (student: StudentRow, e: React.MouseEvent<HTMLSpanElement>) => void
  onInfoLeave?:          () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:       student.id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...(!disabled ? { ...listeners, ...attributes } : {})}
      className={clsx(
        'flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-colors select-none',
        isDragging && 'opacity-30',
        disabled
          ? 'bg-warm-50 border-warm-100 text-warm-400 cursor-not-allowed'
          : 'bg-white border-warm-200 text-secondary-800 cursor-grab active:cursor-grabbing hover:border-primary-300 hover:bg-primary-50/30',
      )}
    >
      <span className={clsx('flex-shrink-0', disabled ? 'text-warm-300' : 'text-warm-400')}>
        <GripVertical size={12} />
      </span>

      {/* Nom + icône info */}
      <span className="flex items-center gap-1 flex-1 min-w-0">
        <span className="truncate font-medium">
          {student.last_name} {student.first_name}
        </span>
        <span
          className="flex-shrink-0 cursor-default"
          onMouseEnter={e => onInfoEnter?.(student, e)}
          onMouseLeave={onInfoLeave}
        >
          <Info size={11} className="text-warm-300 hover:text-primary-400 transition-colors" />
        </span>
      </span>

      {/* Badge genre */}
      <GenderBadge gender={student.gender} />

      {/* Badge PAI */}
      {student.has_pai && (
        <span
          title="Projet d'Accueil Individualisé"
          className="text-[9px] font-bold text-red-500 bg-red-100 px-1 py-px rounded flex-shrink-0"
        >
          PAI
        </span>
      )}

      {/* Âge */}
      <span className="text-[10px] text-warm-400 flex-shrink-0">{calcAge(student.date_of_birth)} ans</span>

      {/* Classe assignée */}
      {assignedClassName && (
        <span
          title={assignedClassTeacher ?? undefined}
          className="text-[10px] bg-warm-200 text-warm-600 px-1.5 py-px rounded-full whitespace-nowrap flex-shrink-0"
        >
          {assignedClassName}
        </span>
      )}
    </div>
  )
}

// ─── Zone de dépôt (panel droit) ──────────────────────────────────────────────

function DropZone({
  rosterStudents,
  maxStudents,
  onRemove,
  onInfoEnter,
  onInfoLeave,
}: {
  rosterStudents: StudentRow[]
  maxStudents:    number
  onRemove:       (id: string) => void
  onInfoEnter?:   (student: StudentRow, e: React.MouseEvent<HTMLSpanElement>) => void
  onInfoLeave?:   () => void
}) {
  const isFull = rosterStudents.length >= maxStudents
  const { setNodeRef, isOver } = useDroppable({ id: 'class-zone' })

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex-1 min-h-0 rounded-xl border-2 border-dashed transition-colors flex flex-col overflow-hidden',
        isFull
          ? 'border-red-200 bg-red-50/30'
          : isOver
            ? 'border-primary-400 bg-primary-50/40'
            : 'border-warm-200 bg-warm-50/30',
      )}
    >
      {rosterStudents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-warm-400">
          <Users size={28} className="text-warm-300" />
          <p className="text-sm">Glisser des élèves ici</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rosterStudents.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-warm-100 text-sm"
            >
              {/* Nom + icône info */}
              <span className="flex items-center gap-1 flex-1 min-w-0">
                <span className="truncate font-medium text-secondary-800">
                  {s.last_name} {s.first_name}
                </span>
                <span
                  className="flex-shrink-0 cursor-default"
                  onMouseEnter={e => onInfoEnter?.(s, e)}
                  onMouseLeave={onInfoLeave}
                >
                  <Info size={13} className="text-warm-300 hover:text-primary-400 transition-colors" />
                </span>
              </span>

              {/* Badge genre */}
              <GenderBadge gender={s.gender} />

              {/* Badge PAI */}
              {s.has_pai && (
                <span
                  title="Projet d'Accueil Individualisé"
                  className="text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded flex-shrink-0"
                >
                  PAI
                </span>
              )}

              {/* Âge */}
              <span className="text-xs text-warm-400 flex-shrink-0">{calcAge(s.date_of_birth)} ans</span>

              {/* Retirer */}
              <button
                onClick={() => onRemove(s.id)}
                className="p-0.5 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                title="Retirer de la classe"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AffectationClient({ classes, students, enrollments }: Props) {
  const router  = useRouter()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Carte rapide : student_id → class_id (état serveur)
  const serverMap = Object.fromEntries(enrollments.map(e => [e.student_id, e.class_id]))

  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(null)
  const [classDropOpen,    setClassDropOpen]    = useState(false)
  const classDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!classDropOpen) return
    const handler = (e: MouseEvent) => {
      if (classDropRef.current && !classDropRef.current.contains(e.target as Node)) {
        setClassDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [classDropOpen])
  const [roster,         setRoster]         = useState<string[]>(() =>
    selectedClassId
      ? enrollments.filter(e => e.class_id === selectedClassId).map(e => e.student_id)
      : []
  )
  const [originalRoster, setOriginalRoster] = useState<string[]>(() =>
    selectedClassId
      ? enrollments.filter(e => e.class_id === selectedClassId).map(e => e.student_id)
      : []
  )
  const [search,   setSearch]   = useState('')
  const [poolPage, setPoolPage] = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Tooltip fixe hors du conteneur scrollable
  const [tooltip, setTooltip] = useState<{ student: StudentRow; top: number; left: number } | null>(null)

  const showTooltip = useCallback((student: StudentRow, e: React.MouseEvent<HTMLSpanElement>) => {
    setTooltip({ student, top: e.clientY, left: e.clientX + 50 })
  }, [])
  const hideTooltip = useCallback(() => setTooltip(null), [])

  const selectedClass  = classes.find(c => c.id === selectedClassId) ?? null
  const hasChanges     = JSON.stringify([...roster].sort()) !== JSON.stringify([...originalRoster].sort())

  // ── Sélection de classe ───────────────────────────────────────────────────
  const selectClass = useCallback((classId: string | null) => {
    if (hasChanges) {
      if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return
    }
    setSelectedClassId(classId)
    const newRoster = classId
      ? enrollments.filter(e => e.class_id === classId).map(e => e.student_id)
      : []
    setRoster(newRoster)
    setOriginalRoster(newRoster)
    setError(null)
    setSuccess(false)
  }, [hasChanges, enrollments])

  // ── DnD ───────────────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
    setTooltip(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || !selectedClass) return

    const studentId = active.id as string
    if (over.id === 'class-zone') {
      if (roster.includes(studentId)) return
      if (roster.length >= selectedClass.max_students) return
      setRoster(prev => [...prev, studentId])
    }
  }

  // ── Retrait depuis le panel droit ─────────────────────────────────────────
  const removeFromRoster = (studentId: string) =>
    setRoster(prev => prev.filter(id => id !== studentId))

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  const save = async () => {
    if (!selectedClassId) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const today    = new Date().toISOString().slice(0, 10)

      const toAdd    = roster.filter(id => !originalRoster.includes(id))
      const toRemove = originalRoster.filter(id => !roster.includes(id))

      if (toAdd.length > 0) {
        const rows = toAdd.map(student_id => ({
          student_id,
          class_id:        selectedClassId,
          status:          'active' as const,
          enrollment_date: today,
        }))
        const { error: errAdd } = await supabase
          .from('enrollments')
          .upsert(rows, { onConflict: 'student_id,class_id' })
        if (errAdd) throw errAdd
      }

      if (toRemove.length > 0) {
        const { error: errRm } = await supabase
          .from('enrollments')
          .delete()
          .eq('class_id', selectedClassId)
          .in('student_id', toRemove)
        if (errRm) throw errRm
      }

      setOriginalRoster([...roster])
      setSuccess(true)
      router.refresh()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message
      setError(msg || 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setSaving(false)
    }
  }

  // ── Données dérivées ──────────────────────────────────────────────────────
  const rosterStudents = students
    .filter(s => roster.includes(s.id))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))

  const q = search.trim().toLowerCase()
  const poolStudents = students.filter(s => {
    if (q) {
      return s.last_name.toLowerCase().includes(q) || s.first_name.toLowerCase().includes(q)
    }
    return true
  })

  const poolTotalPages = Math.ceil(poolStudents.length / POOL_PAGE_SIZE)
  const poolCurPage    = Math.min(poolPage, poolTotalPages || 1)
  const pagedStudents  = poolStudents.slice((poolCurPage - 1) * POOL_PAGE_SIZE, poolCurPage * POOL_PAGE_SIZE)

  const activeStudent = activeId ? students.find(s => s.id === activeId) : null

  // ── Infos classe ──────────────────────────────────────────────────────────
  function ClassInfo() {
    if (!selectedClass) return null
    const mainTeacher = selectedClass.class_teachers.find(t => t.is_main_teacher)
    const teacherName = mainTeacher?.teachers
      ? `${mainTeacher.teachers.last_name} ${mainTeacher.teachers.first_name}`
      : null
    const day   = selectedClass.day_of_week ? (DAYS[selectedClass.day_of_week] ?? selectedClass.day_of_week) : null
    const start = fmtTime(selectedClass.start_time)
    const end   = fmtTime(selectedClass.end_time)

    const parts = [
      teacherName,
      day && start ? `${day} ${start}${end ? `–${end}` : ''}` : day,
      selectedClass.room_number ? `Salle ${selectedClass.room_number}` : null,
    ].filter(Boolean)

    if (parts.length === 0) return null

    return (
      <div className="flex items-center gap-2 text-xs text-warm-500 flex-wrap">
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-warm-300">·</span>}
            {p}
          </span>
        ))}
      </div>
    )
  }

  const isFull = selectedClass ? roster.length >= selectedClass.max_students : false

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-3">

      {/* Sélecteur classe */}
      <div className="card p-4 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div ref={classDropRef} className="relative w-72">
            {/* Trigger */}
            <button
              type="button"
              onClick={() => setClassDropOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-white border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 hover:border-warm-300 transition-colors"
            >
              {selectedClass ? (
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-secondary-800 truncate">{selectedClass.name}</span>
                  {(() => {
                    const main = selectedClass.class_teachers.find(t => t.is_main_teacher)
                    const t = main?.teachers ? `${main.teachers.last_name} ${main.teachers.first_name}` : null
                    return t ? <span className="text-warm-400 text-xs truncate">{t}</span> : null
                  })()}
                </span>
              ) : (
                <span className="text-warm-400">— Sélectionner une classe —</span>
              )}
              <ChevronDown size={13} className={clsx('text-warm-400 flex-shrink-0 transition-transform', classDropOpen && 'rotate-180')} />
            </button>

            {/* Liste déroulante custom */}
            {classDropOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-warm-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { selectClass(null); setClassDropOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-warm-400 hover:bg-warm-50 transition-colors"
                >
                  — Sélectionner une classe —
                </button>
                {classes.map(c => {
                  const main = c.class_teachers.find(t => t.is_main_teacher)
                  const teacher = main?.teachers
                    ? `${main.teachers.last_name} ${main.teachers.first_name}`
                    : null
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { selectClass(c.id); setClassDropOpen(false) }}
                      className={clsx(
                        'w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-primary-50 transition-colors',
                        selectedClassId === c.id && 'bg-primary-50'
                      )}
                    >
                      <span className="font-semibold text-secondary-800 text-sm">{c.name}</span>
                      {teacher && <span className="text-warm-400 text-xs">{teacher}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedClass && (
            <span className={clsx(
              'text-sm font-semibold px-3 py-1 rounded-full',
              isFull
                ? 'bg-red-100 text-red-600'
                : 'bg-primary-50 text-primary-700'
            )}>
              {roster.length} / {selectedClass.max_students} élèves
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex-shrink-0 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex-shrink-0 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 size={15} />
          Affectations enregistrées avec succès.
        </div>
      )}

      {/* Panels DnD */}
      {!selectedClassId ? (
        <div className="flex-1 min-h-0 card flex flex-col items-center justify-center">
          <Users size={32} className="text-warm-300 mb-3" />
          <p className="text-warm-400 text-sm">Sélectionnez une classe pour commencer l'affectation</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">

            {/* ── Panel gauche : élèves disponibles ── */}
            <div className="card p-3 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-warm-500 uppercase tracking-wide">
                  Élèves ({students.length} actifs)
                </h3>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPoolPage(1) }}
                    placeholder="Rechercher..."
                    className="pl-7 pr-6 py-1.5 text-xs bg-warm-50 border border-warm-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-300 w-40"
                  />
                  {search && (
                    <button onClick={() => { setSearch(''); setPoolPage(1) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-warm-400">
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                {poolStudents.length === 0 && q && (
                  <p className="text-xs text-warm-400 text-center py-6">Aucun résultat</p>
                )}
                {pagedStudents.map(s => {
                  const isInCurrentClass      = roster.includes(s.id)
                  const isSavedInCurrentClass = originalRoster.includes(s.id)
                  const assignedClassId       = isInCurrentClass ? null : serverMap[s.id]
                  const assignedClass         = assignedClassId ? classes.find(c => c.id === assignedClassId) : null
                  const isInOtherClass        = !!assignedClass
                  const isDisabled            = isInCurrentClass || isInOtherClass || (!isInCurrentClass && !isInOtherClass && isFull)
                  // Badge classe : autre classe OU classe courante si déjà sauvegardée
                  const badgeClass            = isInOtherClass ? assignedClass : isSavedInCurrentClass ? selectedClass : null
                  const badgeName             = badgeClass?.name
                  const badgeMain             = badgeClass?.class_teachers.find(t => t.is_main_teacher)
                  const badgeTeacherName      = badgeMain?.teachers
                    ? `${badgeMain.teachers.last_name} ${badgeMain.teachers.first_name}`
                    : null
                  const badgeDay             = badgeClass?.day_of_week
                    ? (DAYS[badgeClass.day_of_week] ?? badgeClass.day_of_week)
                    : null
                  const badgeStart           = fmtTime(badgeClass?.start_time ?? null)
                  const badgeEnd             = fmtTime(badgeClass?.end_time   ?? null)
                  const badgeSchedule        = badgeDay
                    ? `${badgeDay}${badgeStart ? ` ${badgeStart}${badgeEnd ? `–${badgeEnd}` : ''}` : ''}`
                    : null
                  const badgeTeacher         = [badgeTeacherName, badgeSchedule].filter(Boolean).join('\n') || null
                  return (
                    <DraggableCard
                      key={s.id}
                      student={s}
                      disabled={isDisabled}
                      assignedClassName={badgeName}
                      assignedClassTeacher={badgeTeacher}
                      onInfoEnter={showTooltip}
                      onInfoLeave={hideTooltip}
                    />
                  )
                })}
              </div>
              {/* Pagination panel gauche */}
              {poolTotalPages > 1 && (
                <div className="flex-shrink-0 flex items-center justify-between pt-2 border-t border-warm-100">
                  <span className="text-[11px] text-warm-400">
                    {(poolCurPage - 1) * POOL_PAGE_SIZE + 1}–{Math.min(poolCurPage * POOL_PAGE_SIZE, poolStudents.length)} / {poolStudents.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPoolPage(p => Math.max(1, p - 1))}
                      disabled={poolCurPage === 1}
                      className="p-1 rounded text-warm-400 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    {Array.from({ length: poolTotalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === poolTotalPages || Math.abs(p - poolCurPage) <= 1)
                      .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('…')
                        acc.push(p)
                        return acc
                      }, [])
                      .map((p, i) =>
                        p === '…' ? (
                          <span key={`e${i}`} className="text-[11px] text-warm-400 px-0.5">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPoolPage(p as number)}
                            className={clsx(
                              'w-6 h-6 rounded text-[11px] font-medium transition-colors',
                              p === poolCurPage
                                ? 'bg-primary-600 text-white'
                                : 'text-warm-500 hover:bg-warm-100 hover:text-secondary-700'
                            )}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => setPoolPage(p => Math.min(poolTotalPages, p + 1))}
                      disabled={poolCurPage === poolTotalPages}
                      className="p-1 rounded text-warm-400 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Panel droit : élèves dans la classe ── */}
            <div className="card p-3 flex flex-col gap-3 min-h-0">
              <div className="flex-shrink-0 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-secondary-800">
                    {selectedClass?.name}
                  </h3>
                  {isFull && (
                    <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                      Complet
                    </span>
                  )}
                </div>
                <ClassInfo />
              </div>

              <DropZone
                rosterStudents={rosterStudents}
                maxStudents={selectedClass?.max_students ?? 0}
                onRemove={removeFromRoster}
                onInfoEnter={showTooltip}
                onInfoLeave={hideTooltip}
              />
            </div>

          </div>

          {/* DragOverlay : carte fantôme sous le curseur */}
          <DragOverlay>
            {activeStudent && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-primary-300 rounded-lg shadow-lg text-sm font-medium text-secondary-800 cursor-grabbing opacity-90">
                <GripVertical size={14} className="text-primary-400" />
                {activeStudent.last_name} {activeStudent.first_name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Bouton enregistrer */}
      {selectedClassId && (
        <div className="flex-shrink-0 flex justify-end">
          <button
            onClick={save}
            disabled={!hasChanges || saving}
            className={clsx(
              'btn btn-primary',
              (!hasChanges || saving) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la classe'}
          </button>
        </div>
      )}

      {/* Tooltip identité — rendu dans document.body via portal (évite les ancêtres avec transform) */}
      {tooltip && typeof document !== 'undefined' && createPortal(
        <StudentTooltip student={tooltip.student} top={tooltip.top} left={tooltip.left} />,
        document.body
      )}

    </div>
  )
}
