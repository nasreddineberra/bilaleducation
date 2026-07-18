'use client'

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { X, Users, Info, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Tooltip from '@/components/ui/Tooltip'
import { useToast } from '@/lib/toast-context'
import { FloatSelect, SearchField, FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { saveStudentEnrollments } from '@/app/dashboard/affectation/actions'

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
  cotisation_types: { label: string; is_adult: boolean } | null
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
  classes:       ClassRow[]
  students:      StudentRow[]
  enrollments:   EnrollmentRow[]
  currentYearId: string | null
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

function GenderText({ gender }: { gender: string | null }) {
  if (gender === 'male')          return <span className="text-[10px] text-secondary-600 flex-shrink-0">Masculin</span>
  if (gender === 'female')        return <span className="text-[10px] text-secondary-600 flex-shrink-0">Féminin</span>
  if (gender === 'non_specified') return <span className="text-[10px] text-warm-700 flex-shrink-0">Non spéc.</span>
  return null
}

function StudentAvatar({ lastName, firstName, gender, size = 'sm' }: {
  lastName: string; firstName: string; gender: string | null; size?: 'sm' | 'md'
}) {
  const initiales = (lastName[0] ?? '').toUpperCase() + (firstName[0] ?? '').toUpperCase()
  const dim = size === 'sm' ? 'w-5 h-5 text-[9px] rounded' : 'w-6 h-6 text-[10px] rounded-md'
  if (gender === 'male')
    return <span className={`inline-flex items-center justify-center font-bold flex-shrink-0 bg-blue-600 text-white ${dim}`}>{initiales}</span>
  if (gender === 'female')
    return <span className={`inline-flex items-center justify-center font-bold flex-shrink-0 bg-pink-500 text-white ${dim}`}>{initiales}</span>
  return <span className={`inline-flex items-center justify-center font-bold flex-shrink-0 border border-warm-300 text-warm-700 ${dim}`}>{initiales}</span>
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

function StudentCard({
  student, disabled, onAdd, assignedClassName, assignedClassInfo, onInfoEnter, onInfoLeave,
}: {
  student:               StudentRow
  disabled:              boolean
  onAdd:                 (id: string) => void
  assignedClassName?:    string
  assignedClassInfo?:    { teacher?: string; schedule?: string; level?: string; cotisation?: string } | null
  onInfoEnter?:          (student: StudentRow, e: React.MouseEvent<HTMLSpanElement>) => void
  onInfoLeave?:          () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAdd(student.id)}
      aria-label={disabled
        ? `${student.last_name} ${student.first_name} (non disponible)`
        : `Affecter ${student.last_name} ${student.first_name} à la classe`}
      className={clsx(
        'w-full flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs transition-colors select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
        disabled
          ? 'bg-warm-50 border-warm-100 text-warm-700 cursor-not-allowed'
          : 'bg-white border-warm-200 text-secondary-800 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30',
      )}
    >
      {/* Avatar + Nom + icône info */}
      <StudentAvatar lastName={student.last_name} firstName={student.first_name} gender={student.gender} size="sm" />
      <span className="flex items-center gap-1 flex-1 min-w-0">
        <span className="truncate font-medium">
          {student.last_name} {student.first_name}
        </span>
        <span
          className="flex-shrink-0 cursor-default"
          onMouseEnter={e => onInfoEnter?.(student, e)}
          onMouseLeave={onInfoLeave}
        >
          <Info size={11} className="text-warm-700 hover:text-primary-400 transition-colors" />
        </span>
      </span>

      {/* Genre */}
      <GenderText gender={student.gender} />

      {/* Badge PAI */}
      {student.has_pai && (
        <Tooltip content="Projet d'Accueil Individualisé">
          <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1 py-px rounded flex-shrink-0">
            PAI
          </span>
        </Tooltip>
      )}

      {/* Âge */}
      <span className="text-[10px] text-warm-700 flex-shrink-0">{calcAge(student.date_of_birth)} ans</span>

      {/* Classe assignée */}
      {assignedClassName && (() => {
        const line = assignedClassInfo
          ? [assignedClassInfo.teacher, assignedClassInfo.cotisation, assignedClassInfo.level, assignedClassInfo.schedule].filter(Boolean).join(' · ')
          : ''
        const badge = (
          <span className="text-[10px] bg-warm-200 text-warm-700 px-1.5 py-px rounded-full whitespace-nowrap flex-shrink-0">
            {assignedClassName}
          </span>
        )
        return line
          ? <Tooltip content={<span className="whitespace-nowrap">{line}</span>} maxWidth="max-w-none">{badge}</Tooltip>
          : badge
      })()}
    </button>
  )
}

// ─── Liste des élèves de la classe (panel droit) ─────────────────────────────

function DropZone({
  rosterStudents,
  onRemove,
  onInfoEnter,
  onInfoLeave,
}: {
  rosterStudents: StudentRow[]
  onRemove:       (id: string) => void
  onInfoEnter?:   (student: StudentRow, e: React.MouseEvent<HTMLSpanElement>) => void
  onInfoLeave?:   () => void
}) {
  return (
    <div className="flex-1 min-h-0 rounded-xl flex flex-col overflow-hidden">
      {rosterStudents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-warm-700">
          <Users size={28} className="text-warm-700" />
          <p className="text-sm">Cliquez un élève à gauche pour l&apos;affecter</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {rosterStudents.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-white rounded-md border border-warm-100 text-xs"
            >
              {/* Avatar + Nom + icône info */}
              <StudentAvatar lastName={s.last_name} firstName={s.first_name} gender={s.gender} size="sm" />
              <span className="flex items-center gap-1 flex-1 min-w-0">
                <span className="truncate font-medium text-secondary-800">
                  {s.last_name} {s.first_name}
                </span>
                <span
                  className="flex-shrink-0 cursor-default"
                  onMouseEnter={e => onInfoEnter?.(s, e)}
                  onMouseLeave={onInfoLeave}
                >
                  <Info size={11} className="text-warm-700 hover:text-primary-400 transition-colors" />
                </span>
              </span>

              {/* Genre */}
              <GenderText gender={s.gender} />

              {/* Badge PAI */}
              {s.has_pai && (
                <Tooltip content="Projet d'Accueil Individualisé">
                  <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1 py-px rounded flex-shrink-0">
                    PAI
                  </span>
                </Tooltip>
              )}

              {/* Âge */}
              <span className="text-[10px] text-warm-700 flex-shrink-0">{calcAge(s.date_of_birth)} ans</span>

              {/* Retirer */}
              <Tooltip content="Retirer de la classe">
                <button
                  onClick={() => onRemove(s.id)}
                  className="p-0.5 text-warm-700 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                >
                  <X size={13} />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AffectationClient({ classes, students, enrollments, currentYearId }: Props) {
  const router  = useRouter()
  const toast   = useToast()

  // Carte rapide : student_id → class_id (état serveur)
  const serverMap = Object.fromEntries(enrollments.map(e => [e.student_id, e.class_id]))

  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
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
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)

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
    const doSelect = () => {
      setSelectedClassId(classId)
      const newRoster = classId
        ? enrollments.filter(e => e.class_id === classId).map(e => e.student_id)
        : []
      setRoster(newRoster)
      setOriginalRoster(newRoster)
    }
    if (hasChanges) {
      setPendingConfirm({ message: 'Des modifications non sauvegardées seront perdues. Continuer ?', onConfirm: doSelect })
    } else {
      doSelect()
    }
  }, [hasChanges, enrollments])

  // ── Ajout par clic ────────────────────────────────────────────────────────
  const addToRoster = (studentId: string) => {
    if (!selectedClass) return
    if (roster.includes(studentId)) return
    if (roster.length >= selectedClass.max_students) return
    setRoster(prev => [...prev, studentId])
  }

  // ── Recharger la classe depuis la base = re-sélectionner la même classe ─────
  //    (re-dérive le roster des inscriptions, avec confirmation si modifs non enregistrées).
  const reloadClass = () => selectClass(selectedClassId)

  // ── Retrait depuis le panel droit ─────────────────────────────────────────
  const removeFromRoster = async (studentId: string) => {
    if (currentYearId) {
      const supabase = createClient()

      // Vérifier grades sur l'année courante (via evaluations → period → school_year)
      const { count: gradesCount } = await supabase
        .from('grades')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .in(
          'evaluation_id',
          (await supabase
            .from('evaluations')
            .select('id')
            .in(
              'period_id',
              (await supabase
                .from('periods')
                .select('id')
                .eq('school_year_id', currentYearId)
              ).data?.map(p => p.id) ?? []
            )
          ).data?.map(e => e.id) ?? []
        )

      // Vérifier bulletins archivés sur l'année courante
      const { count: bulletinsCount } = await supabase
        .from('bulletin_archives')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .in(
          'period_id',
          (await supabase
            .from('periods')
            .select('id')
            .eq('school_year_id', currentYearId)
          ).data?.map(p => p.id) ?? []
        )

      if ((gradesCount ?? 0) > 0 || (bulletinsCount ?? 0) > 0) {
        toast.error('Impossible de retirer cet élève : il a des évaluations ou des bulletins enregistrés sur l\'année en cours.')
        return
      }
    }
    setRoster(prev => prev.filter(id => id !== studentId))
  }

  // ── Sauvegarde (server action + traçabilité journal) ───────────────────────
  const save = async () => {
    if (!selectedClassId) return
    setSaving(true)

    const toAdd    = roster.filter(id => !originalRoster.includes(id))
    const toRemove = originalRoster.filter(id => !roster.includes(id))

    const { error } = await saveStudentEnrollments(selectedClassId, toAdd, toRemove)
    setSaving(false)
    if (error) { toast.error(error); return }

    setOriginalRoster([...roster])
    toast.success('Affectations enregistrées avec succès.')
    router.refresh()
  }

  // ── Données dérivées ──────────────────────────────────────────────────────
  // Non affectés = aucun élève inscrit dans une classe de l'année (état serveur)
  const unassignedCount = students.filter(s => !serverMap[s.id]).length

  const rosterStudents = students
    .filter(s => roster.includes(s.id))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))

  const q = search.trim().toLowerCase()
  const poolStudents = students.filter(s => {
    // Filtre « non affectés » : masquer les élèves déjà inscrits dans une classe de l'année
    if (onlyUnassigned && serverMap[s.id]) return false
    if (q) {
      return s.last_name.toLowerCase().includes(q) || s.first_name.toLowerCase().includes(q)
    }
    return true
  })

  const poolTotalPages = Math.ceil(poolStudents.length / POOL_PAGE_SIZE)
  const poolCurPage    = Math.min(poolPage, poolTotalPages || 1)
  const pagedStudents  = poolStudents.slice((poolCurPage - 1) * POOL_PAGE_SIZE, poolCurPage * POOL_PAGE_SIZE)

  // ── Infos classe ──────────────────────────────────────────────────────────
  function ClassInfo() {
    if (!selectedClass) return null
    const mainTeacher = selectedClass.class_teachers.find(t => t.is_main_teacher)
    const teacherName = mainTeacher?.teachers
      ? [mainTeacher.teachers.civilite, mainTeacher.teachers.last_name, mainTeacher.teachers.first_name].filter(Boolean).join(' ')
      : null
    const cotisationLabel = selectedClass.cotisation_types?.label ?? null
    const day   = selectedClass.day_of_week ? (DAYS[selectedClass.day_of_week] ?? selectedClass.day_of_week) : null
    const start = fmtTime(selectedClass.start_time)
    const end   = fmtTime(selectedClass.end_time)

    const parts = [
      teacherName,
      cotisationLabel,
      selectedClass.level ? `Niveau ${selectedClass.level}` : undefined,
      day && start ? `${day} ${start}${end ? `–${end}` : ''}` : day,
    ].filter(Boolean)

    if (parts.length === 0) return null

    return (
      <div className="flex items-center gap-2 text-xs text-warm-700 flex-wrap">
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-warm-700">·</span>}
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
      <div className="card px-3 py-2 flex-shrink-0 flex items-center gap-3 flex-wrap">
        <FloatSelect
          label="Classe"
          value={selectedClassId ?? ''}
          onChange={e => selectClass(e.target.value || null)}
          wrapperClassName="w-fit"
        >
          <option value=""></option>
          {classes.map(c => {
            const main = c.class_teachers.find(t => t.is_main_teacher)
            const teacher = main?.teachers
              ? [main.teachers.civilite, main.teachers.last_name, main.teachers.first_name].filter(Boolean).join(' ')
              : null
            return (
              <option key={c.id} value={c.id}>
                {[c.name, teacher].filter(Boolean).join(' · ')}
              </option>
            )
          })}
        </FloatSelect>

        {selectedClass && (
          <span className={clsx(
            'text-sm font-semibold px-3 py-1 rounded-full',
            isFull ? 'bg-red-100 text-red-600' : 'bg-primary-50 text-primary-700'
          )}>
            {roster.length} / {selectedClass.max_students} élèves
          </span>
        )}
      </div>

      {/* Panels */}
      {!selectedClassId ? (
        <div className="flex-1 min-h-0 card flex flex-col items-center justify-center">
          <Users size={32} className="text-warm-700 mb-3" />
          <p className="text-warm-700 text-sm">Sélectionnez une classe pour commencer l'affectation</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">

            {/* ── Panel gauche : élèves disponibles ── */}
            <div className="card p-3 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-bold text-warm-700 uppercase tracking-wide">
                  Élèves ({students.length} actifs · {unassignedCount} non affecté{unassignedCount > 1 ? 's' : ''})
                </h3>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-warm-700 cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={onlyUnassigned}
                      onChange={e => { setOnlyUnassigned(e.target.checked); setPoolPage(1) }}
                      className="accent-primary-500 w-3.5 h-3.5"
                    />
                    Non affectés
                  </label>
                  <SearchField
                    value={search}
                    onChange={v => { setSearch(v); setPoolPage(1) }}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                {poolStudents.length === 0 && q && (
                  <p className="text-xs text-warm-700 text-center py-6">Aucun résultat</p>
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
                    ? [badgeMain.teachers.civilite, badgeMain.teachers.last_name, badgeMain.teachers.first_name].filter(Boolean).join(' ')
                    : undefined
                  const badgeDay             = badgeClass?.day_of_week
                    ? (DAYS[badgeClass.day_of_week] ?? badgeClass.day_of_week)
                    : null
                  const badgeStart           = fmtTime(badgeClass?.start_time ?? null)
                  const badgeEnd             = fmtTime(badgeClass?.end_time   ?? null)
                  const badgeSchedule        = badgeDay
                    ? `${badgeDay}${badgeStart ? ` ${badgeStart}${badgeEnd ? `–${badgeEnd}` : ''}` : ''}`
                    : undefined
                  const badgeInfo = badgeClass ? {
                    teacher: badgeTeacherName,
                    schedule: badgeSchedule,
                    level: badgeClass.level || undefined,
                    cotisation: badgeClass.cotisation_types?.label || undefined,
                  } : null
                  return (
                    <StudentCard
                      key={s.id}
                      student={s}
                      disabled={isDisabled}
                      onAdd={addToRoster}
                      assignedClassName={badgeName}
                      assignedClassInfo={badgeInfo}
                      onInfoEnter={showTooltip}
                      onInfoLeave={hideTooltip}
                    />
                  )
                })}
              </div>
              {/* Pagination panel gauche */}
              {poolTotalPages > 1 && (
                <div className="flex-shrink-0 flex items-center justify-between pt-2 border-t border-warm-100">
                  <span className="text-[11px] text-warm-700">
                    {(poolCurPage - 1) * POOL_PAGE_SIZE + 1}–{Math.min(poolCurPage * POOL_PAGE_SIZE, poolStudents.length)} / {poolStudents.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPoolPage(p => Math.max(1, p - 1))}
                      disabled={poolCurPage === 1}
                      className="p-1 rounded text-warm-700 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                          <span key={`e${i}`} className="text-[11px] text-warm-700 px-0.5">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPoolPage(p as number)}
                            className={clsx(
                              'w-6 h-6 rounded text-[11px] font-medium transition-colors',
                              p === poolCurPage
                                ? 'bg-primary-600 text-white'
                                : 'text-warm-700 hover:bg-warm-100 hover:text-secondary-700'
                            )}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => setPoolPage(p => Math.min(poolTotalPages, p + 1))}
                      disabled={poolCurPage === poolTotalPages}
                      className="p-1 rounded text-warm-700 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-secondary-800 truncate">
                    {selectedClass?.name}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isFull && (
                      <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                        Complet
                      </span>
                    )}
                    <Tooltip content="Recharger depuis la base">
                      <button
                        type="button"
                        onClick={reloadClass}
                        aria-label="Recharger la classe depuis la base"
                        className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                      >
                        <RotateCcw size={15} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                <ClassInfo />
              </div>

              <DropZone
                rosterStudents={rosterStudents}
                onRemove={removeFromRoster}
                onInfoEnter={showTooltip}
                onInfoLeave={hideTooltip}
              />
            </div>

          </div>
        </div>
      )}

      {/* Bouton enregistrer */}
      {selectedClassId && (
        <div className="flex-shrink-0 flex justify-end">
          <FloatButton
            variant={originalRoster.length > 0 ? 'edit' : 'submit'}
            type="button"
            onClick={save}
            disabled={!hasChanges}
            loading={saving}
          >
            {originalRoster.length > 0 ? 'Modifier' : 'Valider'}
          </FloatButton>
        </div>
      )}

      <ConfirmModal
        open={!!pendingConfirm}
        message={pendingConfirm?.message ?? ''}
        onConfirm={() => { pendingConfirm?.onConfirm(); setPendingConfirm(null) }}
        onCancel={() => setPendingConfirm(null)}
      />

      {/* Tooltip identité — rendu dans document.body via portal (évite les ancêtres avec transform) */}
      {tooltip && typeof document !== 'undefined' && createPortal(
        <StudentTooltip student={tooltip.student} top={tooltip.top} left={tooltip.left} />,
        document.body
      )}

    </div>
  )
}
