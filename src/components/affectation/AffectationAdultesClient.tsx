'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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
import { Search, X, Users, CheckCircle2, GripVertical, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const POOL_PAGE_SIZE = 20

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherInfo { civilite: string | null; first_name: string; last_name: string }
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
  cotisation_types: { label: string; is_adult: boolean } | null
}

interface ParentRow {
  id:                    string
  tutor1_last_name:      string
  tutor1_first_name:     string
  tutor1_relationship:   string | null
  tutor1_adult_courses:  boolean
  tutor2_last_name:      string | null
  tutor2_first_name:     string | null
  tutor2_relationship:   string | null
  tutor2_adult_courses:  boolean
}

interface EnrollmentRow {
  parent_id:    string
  class_id:     string
  tutor_number: number
}

// Item dans le pool : un tuteur (T1 ou T2) d'une famille
interface TutorItem {
  id:           string  // `${parent_id}-${tutor_number}`
  parent_id:    string
  tutor_number: 1 | 2
  last_name:    string
  first_name:   string
  relationship: string | null
}

interface Props {
  classes:     ClassRow[]
  parents:     ParentRow[]
  enrollments: EnrollmentRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genderFromRelationship(rel: string | null): 'male' | 'female' | null {
  if (rel === 'père' || rel === 'tuteur') return 'male'
  if (rel === 'mère') return 'female'
  return null
}

const DAYS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

function fmtTime(t: string | null) { return t ? t.slice(0, 5) : null }

// ─── Badge genre ──────────────────────────────────────────────────────────────

function GenderBadge({ gender }: { gender: 'male' | 'female' | null }) {
  if (gender === 'male') return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex-shrink-0">M</span>
  )
  if (gender === 'female') return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pink-100 text-pink-500 text-[9px] font-bold flex-shrink-0">F</span>
  )
  return null
}

// ─── Carte tuteur draggable ───────────────────────────────────────────────────

function buildClassTooltip(cls: ClassRow): string | null {
  const main = cls.class_teachers.find(t => t.is_main_teacher)
  const teacherName = main?.teachers
    ? [main.teachers.civilite, main.teachers.last_name, main.teachers.first_name].filter(Boolean).join(' ')
    : null
  const day   = cls.day_of_week ? (DAYS[cls.day_of_week] ?? cls.day_of_week) : null
  const start = fmtTime(cls.start_time)
  const end   = fmtTime(cls.end_time)
  const schedule = day
    ? `${day}${start ? ` ${start}${end ? `–${end}` : ''}` : ''}`
    : null
  const parts = [teacherName, cls.cotisation_types?.label, cls.level ? `Niveau ${cls.level}` : null, schedule].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function DraggableTutorCard({
  tutor, disabled, assignedClassName, assignedClassTooltip,
}: {
  tutor:                TutorItem
  disabled:             boolean
  assignedClassName?:   string
  assignedClassTooltip?: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:       tutor.id,
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

      <span className="truncate font-medium flex-1 min-w-0">
        {tutor.last_name} {tutor.first_name}
      </span>

      <GenderBadge gender={genderFromRelationship(tutor.relationship)} />

      {assignedClassName && (
        <span
          title={assignedClassTooltip ?? undefined}
          className="text-[10px] bg-warm-200 text-warm-600 px-1.5 py-px rounded-full whitespace-nowrap flex-shrink-0"
        >
          {assignedClassName}
        </span>
      )}
    </div>
  )
}

// ─── Zone de dépôt ────────────────────────────────────────────────────────────

function DropZone({
  rosterTutors,
  maxStudents,
  onRemove,
}: {
  rosterTutors: TutorItem[]
  maxStudents:  number
  onRemove:     (id: string) => void
}) {
  const isFull = rosterTutors.length >= maxStudents
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
      {rosterTutors.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-warm-400">
          <Users size={28} className="text-warm-300" />
          <p className="text-sm">Glisser des participants ici</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rosterTutors.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-warm-100 text-sm"
            >
              <span className="truncate font-medium text-secondary-800 flex-1 min-w-0">
                {t.last_name} {t.first_name}
              </span>
              <GenderBadge gender={genderFromRelationship(t.relationship)} />
              <button
                onClick={() => onRemove(t.id)}
                className="p-0.5 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                title="Retirer du cours"
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

export default function AffectationAdultesClient({ classes, parents, enrollments }: Props) {
  const router  = useRouter()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Construire la liste des tuteurs inscrits aux cours adultes uniquement
  const tutors: TutorItem[] = parents.flatMap(p => {
    const items: TutorItem[] = []
    if (p.tutor1_adult_courses) {
      items.push({
        id:           `${p.id}-1`,
        parent_id:    p.id,
        tutor_number: 1,
        last_name:    p.tutor1_last_name,
        first_name:   p.tutor1_first_name,
        relationship: p.tutor1_relationship,
      })
    }
    if (p.tutor2_adult_courses && p.tutor2_last_name && p.tutor2_first_name) {
      items.push({
        id:           `${p.id}-2`,
        parent_id:    p.id,
        tutor_number: 2,
        last_name:    p.tutor2_last_name,
        first_name:   p.tutor2_first_name,
        relationship: p.tutor2_relationship ?? null,
      })
    }
    return items
  })

  // serverMap : `${parent_id}-${tutor_number}` → class_id
  const serverMap = Object.fromEntries(
    enrollments.map(e => [`${e.parent_id}-${e.tutor_number}`, e.class_id])
  )

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [classDropOpen,   setClassDropOpen]   = useState(false)
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

  const [roster,         setRoster]         = useState<string[]>([])
  const [originalRoster, setOriginalRoster] = useState<string[]>([])
  const [search,   setSearch]   = useState('')
  const [poolPage, setPoolPage] = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const selectedClass = classes.find(c => c.id === selectedClassId) ?? null
  const hasChanges    = JSON.stringify([...roster].sort()) !== JSON.stringify([...originalRoster].sort())

  const selectClass = useCallback((classId: string | null) => {
    if (hasChanges) {
      if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return
    }
    setSelectedClassId(classId)
    const newRoster = classId
      ? enrollments.filter(e => e.class_id === classId).map(e => `${e.parent_id}-${e.tutor_number}`)
      : []
    setRoster(newRoster)
    setOriginalRoster(newRoster)
    setError(null)
    setSuccess(false)
  }, [hasChanges, enrollments])

  function handleDragStart(event: DragStartEvent) { setActiveId(event.active.id as string) }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || !selectedClass) return
    const tutorId = active.id as string
    if (over.id === 'class-zone') {
      if (roster.includes(tutorId)) return
      if (roster.length >= selectedClass.max_students) return
      setRoster(prev => [...prev, tutorId])
    }
  }

  const removeFromRoster = (tutorId: string) =>
    setRoster(prev => prev.filter(id => id !== tutorId))

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

      // Supprimer les inscriptions retirées
      if (toRemove.length > 0) {
        for (const tutorId of toRemove) {
          const sep          = tutorId.lastIndexOf('-')
          const parent_id    = tutorId.slice(0, sep)
          const tutor_number = parseInt(tutorId.slice(sep + 1), 10)
          const { error: errRm } = await supabase
            .from('parent_class_enrollments')
            .delete()
            .eq('class_id', selectedClassId)
            .eq('parent_id', parent_id)
            .eq('tutor_number', tutor_number)
          if (errRm) throw errRm
        }
      }

      // Insérer les nouvelles inscriptions
      if (toAdd.length > 0) {
        const rows = toAdd.map(tutorId => {
          const sep = tutorId.lastIndexOf('-')
          const parent_id    = tutorId.slice(0, sep)
          const tutor_number = parseInt(tutorId.slice(sep + 1), 10)
          return {
            parent_id,
            class_id:        selectedClassId,
            tutor_number,
            status:          'active' as const,
            enrollment_date: today,
          }
        })
        const { error: errAdd } = await supabase
          .from('parent_class_enrollments')
          .insert(rows)
        if (errAdd) throw errAdd
      }

      setOriginalRoster([...roster])
      setSuccess(true)
      router.refresh()
    } catch (err: unknown) {
      const e = err as Record<string, unknown>
      const msg = (e?.message as string) || (e?.details as string) || (e?.hint as string) || 'Une erreur est survenue. Veuillez réessayer.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Données dérivées ──────────────────────────────────────────────────────
  const rosterTutors = tutors
    .filter(t => roster.includes(t.id))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))

  const q = search.trim().toLowerCase()
  const poolTutors = tutors.filter(t => {
    if (q) return t.last_name.toLowerCase().includes(q) || t.first_name.toLowerCase().includes(q)
    return true
  })

  const poolTotalPages = Math.ceil(poolTutors.length / POOL_PAGE_SIZE)
  const poolCurPage    = Math.min(poolPage, poolTotalPages || 1)
  const pagedTutors    = poolTutors.slice((poolCurPage - 1) * POOL_PAGE_SIZE, poolCurPage * POOL_PAGE_SIZE)

  const activeTutor = activeId ? tutors.find(t => t.id === activeId) : null
  const isFull      = selectedClass ? roster.length >= selectedClass.max_students : false

  function ClassInfo() {
    if (!selectedClass) return null
    const mainTeacher = selectedClass.class_teachers.find(t => t.is_main_teacher)
    const teacherName = mainTeacher?.teachers
      ? [mainTeacher.teachers.civilite, mainTeacher.teachers.last_name, mainTeacher.teachers.first_name].filter(Boolean).join(' ')
      : null
    const day   = selectedClass.day_of_week ? (DAYS[selectedClass.day_of_week] ?? selectedClass.day_of_week) : null
    const start = fmtTime(selectedClass.start_time)
    const end   = fmtTime(selectedClass.end_time)
    const parts = [
      teacherName,
      selectedClass.cotisation_types?.label,
      selectedClass.level ? `Niveau ${selectedClass.level}` : null,
      day && start ? `${day} ${start}${end ? `–${end}` : ''}` : day,
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

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-3">

      {/* Sélecteur cours adulte */}
      <div className="card p-4 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div ref={classDropRef} className="relative w-72">
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
                    const t = main?.teachers ? [main.teachers.civilite, main.teachers.last_name, main.teachers.first_name].filter(Boolean).join(' ') : null
                    return t ? <span className="text-warm-400 text-xs truncate">{t}</span> : null
                  })()}
                </span>
              ) : (
                <span className="text-warm-400">— Sélectionner une classe —</span>
              )}
              <ChevronDown size={13} className={clsx('text-warm-400 flex-shrink-0 transition-transform', classDropOpen && 'rotate-180')} />
            </button>

            {classDropOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-warm-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { selectClass(null); setClassDropOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-warm-400 hover:bg-warm-50 transition-colors"
                >
                  — Sélectionner une classe —
                </button>
                {classes.length === 0 && (
                  <p className="px-3 py-4 text-sm text-warm-400 text-center">
                    Aucun cours adulte configuré.
                  </p>
                )}
                {classes.map(c => {
                  const main    = c.class_teachers.find(t => t.is_main_teacher)
                  const teacher = main?.teachers
                    ? [main.teachers.civilite, main.teachers.last_name, main.teachers.first_name].filter(Boolean).join(' ')
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
              isFull ? 'bg-red-100 text-red-600' : 'bg-primary-50 text-primary-700'
            )}>
              {roster.length} / {selectedClass.max_students} participants
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
          <p className="text-warm-400 text-sm">Sélectionnez un cours adulte pour commencer l'affectation</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">

            {/* ── Panel gauche : participants disponibles ── */}
            <div className="card p-3 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-warm-500 uppercase tracking-wide">
                  Participants ({tutors.length})
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
                {poolTutors.length === 0 && q && (
                  <p className="text-xs text-warm-400 text-center py-6">Aucun résultat</p>
                )}
                {pagedTutors.map(t => {
                  const isInCurrentClass      = roster.includes(t.id)
                  const isSavedInCurrentClass = originalRoster.includes(t.id)
                  const assignedClassId       = isInCurrentClass ? null : serverMap[t.id]
                  const assignedClass         = assignedClassId ? classes.find(c => c.id === assignedClassId) : null
                  const isInOtherClass        = !!assignedClass
                  const isDisabled            = isInCurrentClass || isInOtherClass || (!isInCurrentClass && !isInOtherClass && isFull)
                  const badgeClass            = isInOtherClass ? assignedClass : (isSavedInCurrentClass ? selectedClass : null)
                  const badgeName             = badgeClass?.name
                  const badgeTooltip          = badgeClass ? buildClassTooltip(badgeClass) ?? undefined : undefined
                  return (
                    <DraggableTutorCard
                      key={t.id}
                      tutor={t}
                      disabled={isDisabled}
                      assignedClassName={badgeName}
                      assignedClassTooltip={badgeTooltip}
                    />
                  )
                })}
              </div>

              {/* Pagination */}
              {poolTotalPages > 1 && (
                <div className="flex-shrink-0 flex items-center justify-between pt-2 border-t border-warm-100">
                  <span className="text-[11px] text-warm-400">
                    {(poolCurPage - 1) * POOL_PAGE_SIZE + 1}–{Math.min(poolCurPage * POOL_PAGE_SIZE, poolTutors.length)} / {poolTutors.length}
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

            {/* ── Panel droit : participants dans le cours ── */}
            <div className="card p-3 flex flex-col gap-3 min-h-0">
              <div className="flex-shrink-0 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-secondary-800">{selectedClass?.name}</h3>
                  {isFull && (
                    <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Complet</span>
                  )}
                </div>
                <ClassInfo />
              </div>

              <DropZone
                rosterTutors={rosterTutors}
                maxStudents={selectedClass?.max_students ?? 0}
                onRemove={removeFromRoster}
              />
            </div>

          </div>

          {/* DragOverlay */}
          <DragOverlay>
            {activeTutor && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-primary-300 rounded-lg shadow-lg text-sm font-medium text-secondary-800 cursor-grabbing opacity-90">
                <GripVertical size={14} className="text-primary-400" />
                {activeTutor.last_name} {activeTutor.first_name}
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

    </div>
  )
}
