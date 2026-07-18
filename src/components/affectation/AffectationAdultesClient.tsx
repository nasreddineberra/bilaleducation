'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { X, Users, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { FloatSelect, SearchField, FloatButton } from '@/components/ui/FloatFields'
import { saveParentEnrollments } from '@/app/dashboard/affectation/actions'

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

function GenderBadge({ gender }: { gender: 'male' | 'female' | null }) {
  if (gender === 'male') return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex-shrink-0">M</span>
  )
  if (gender === 'female') return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pink-100 text-pink-500 text-[9px] font-bold flex-shrink-0">F</span>
  )
  return null
}

// Libellé classe une ligne : « Prof · Cotisation · Niveau · Jour HH:MM-HH:MM »
function classInfoLine(cls: ClassRow): string {
  const main = cls.class_teachers.find(t => t.is_main_teacher)
  const teacher = main?.teachers
    ? [main.teachers.civilite, main.teachers.last_name, main.teachers.first_name].filter(Boolean).join(' ')
    : undefined
  const day   = cls.day_of_week ? (DAYS[cls.day_of_week] ?? cls.day_of_week) : null
  const start = fmtTime(cls.start_time)
  const end   = fmtTime(cls.end_time)
  const schedule = day ? `${day}${start ? ` ${start}${end ? `-${end}` : ''}` : ''}` : undefined
  return [teacher, cls.cotisation_types?.label, cls.level || undefined, schedule].filter(Boolean).join(' · ')
}

// ─── Carte tuteur (bouton cliquable) ──────────────────────────────────────────

function TutorCard({
  tutor, disabled, onAdd, assignedClassName, assignedClassLine,
}: {
  tutor:              TutorItem
  disabled:           boolean
  onAdd:              (id: string) => void
  assignedClassName?: string
  assignedClassLine?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAdd(tutor.id)}
      aria-label={disabled
        ? `${tutor.last_name} ${tutor.first_name} (non disponible)`
        : `Affecter ${tutor.last_name} ${tutor.first_name} au cours`}
      className={clsx(
        'w-full flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-colors select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
        disabled
          ? 'bg-warm-50 border-warm-100 text-warm-700 cursor-not-allowed'
          : 'bg-white border-warm-200 text-secondary-800 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30',
      )}
    >
      <span className="truncate font-medium flex-1 min-w-0">
        {tutor.last_name} {tutor.first_name}
      </span>

      <GenderBadge gender={genderFromRelationship(tutor.relationship)} />

      {assignedClassName && (
        assignedClassLine
          ? (
            <Tooltip content={<span className="whitespace-nowrap">{assignedClassLine}</span>} maxWidth="max-w-none">
              <span className="text-[10px] bg-warm-200 text-warm-700 px-1.5 py-px rounded-full whitespace-nowrap flex-shrink-0">
                {assignedClassName}
              </span>
            </Tooltip>
          ) : (
            <span className="text-[10px] bg-warm-200 text-warm-700 px-1.5 py-px rounded-full whitespace-nowrap flex-shrink-0">
              {assignedClassName}
            </span>
          )
      )}
    </button>
  )
}

// ─── Liste des participants du cours (panel droit) ───────────────────────────

function ClassRoster({
  rosterTutors,
  onRemove,
}: {
  rosterTutors: TutorItem[]
  onRemove:     (id: string) => void
}) {
  return (
    <div className="flex-1 min-h-0 rounded-xl flex flex-col overflow-hidden">
      {rosterTutors.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-warm-700">
          <Users size={28} className="text-warm-700" />
          <p className="text-sm">Cliquez un participant à gauche pour l&apos;affecter</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {rosterTutors.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-warm-100 text-xs"
            >
              <span className="truncate font-medium text-secondary-800 flex-1 min-w-0">
                {t.last_name} {t.first_name}
              </span>
              <GenderBadge gender={genderFromRelationship(t.relationship)} />
              <Tooltip content="Retirer du cours">
                <button
                  onClick={() => onRemove(t.id)}
                  aria-label={`Retirer ${t.last_name} ${t.first_name}`}
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

export default function AffectationAdultesClient({ classes, parents, enrollments }: Props) {
  const router = useRouter()
  const toast  = useToast()

  // Liste des tuteurs inscrits aux cours adultes
  const tutors: TutorItem[] = parents.flatMap(p => {
    const items: TutorItem[] = []
    if (p.tutor1_adult_courses) {
      items.push({ id: `${p.id}-1`, parent_id: p.id, tutor_number: 1, last_name: p.tutor1_last_name, first_name: p.tutor1_first_name, relationship: p.tutor1_relationship })
    }
    if (p.tutor2_adult_courses && p.tutor2_last_name && p.tutor2_first_name) {
      items.push({ id: `${p.id}-2`, parent_id: p.id, tutor_number: 2, last_name: p.tutor2_last_name, first_name: p.tutor2_first_name, relationship: p.tutor2_relationship ?? null })
    }
    return items
  })

  const serverMap = Object.fromEntries(enrollments.map(e => [`${e.parent_id}-${e.tutor_number}`, e.class_id]))

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [roster,         setRoster]         = useState<string[]>([])
  const [originalRoster, setOriginalRoster] = useState<string[]>([])
  const [search,   setSearch]   = useState('')
  const [poolPage, setPoolPage] = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const selectedClass = classes.find(c => c.id === selectedClassId) ?? null
  const hasChanges    = JSON.stringify([...roster].sort()) !== JSON.stringify([...originalRoster].sort())

  const selectClass = useCallback((classId: string | null) => {
    const doSelect = () => {
      setSelectedClassId(classId)
      const newRoster = classId
        ? enrollments.filter(e => e.class_id === classId).map(e => `${e.parent_id}-${e.tutor_number}`)
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

  const reloadClass = () => selectClass(selectedClassId)

  const addToRoster = (tutorId: string) => {
    if (!selectedClass) return
    if (roster.includes(tutorId)) return
    if (roster.length >= selectedClass.max_students) return
    setRoster(prev => [...prev, tutorId])
  }

  const removeFromRoster = (tutorId: string) =>
    setRoster(prev => prev.filter(id => id !== tutorId))

  const save = async () => {
    if (!selectedClassId) return
    setSaving(true)
    const toAdd    = roster.filter(id => !originalRoster.includes(id))
    const toRemove = originalRoster.filter(id => !roster.includes(id))
    const { error } = await saveParentEnrollments(selectedClassId, toAdd, toRemove)
    setSaving(false)
    if (error) { toast.error(error); return }
    setOriginalRoster([...roster])
    toast.success('Affectations enregistrées avec succès.')
    router.refresh()
  }

  // ── Données dérivées ──────────────────────────────────────────────────────
  const unassignedCount = tutors.filter(t => !serverMap[t.id]).length

  const rosterTutors = tutors
    .filter(t => roster.includes(t.id))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))

  const q = search.trim().toLowerCase()
  const poolTutors = tutors.filter(t => {
    if (onlyUnassigned && serverMap[t.id]) return false
    if (q) return t.last_name.toLowerCase().includes(q) || t.first_name.toLowerCase().includes(q)
    return true
  })

  const poolTotalPages = Math.ceil(poolTutors.length / POOL_PAGE_SIZE)
  const poolCurPage    = Math.min(poolPage, poolTotalPages || 1)
  const pagedTutors    = poolTutors.slice((poolCurPage - 1) * POOL_PAGE_SIZE, poolCurPage * POOL_PAGE_SIZE)

  const isFull = selectedClass ? roster.length >= selectedClass.max_students : false

  function ClassInfo() {
    if (!selectedClass) return null
    const line = classInfoLine(selectedClass)
    if (!line) return null
    return <div className="text-xs text-warm-700">{line}</div>
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-3">

      {/* Sélecteur cours adulte */}
      <div className="card px-3 py-2 flex-shrink-0 flex items-center gap-3 flex-wrap">
        <FloatSelect
          label="Classe adulte"
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
                {[c.name, teacher, c.cotisation_types?.label].filter(Boolean).join(' · ')}
              </option>
            )
          })}
        </FloatSelect>

        {selectedClass && (
          <span className={clsx(
            'text-sm font-semibold px-3 py-1 rounded-full',
            isFull ? 'bg-red-100 text-red-600' : 'bg-primary-50 text-primary-700'
          )}>
            {roster.length} / {selectedClass.max_students} participants
          </span>
        )}
      </div>

      {/* Panels */}
      {!selectedClassId ? (
        <div className="flex-1 min-h-0 card flex flex-col items-center justify-center">
          <Users size={32} className="text-warm-700 mb-3" />
          <p className="text-warm-700 text-sm">Sélectionnez un cours adulte pour commencer l'affectation</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">

            {/* ── Panel gauche : participants disponibles ── */}
            <div className="card p-3 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-bold text-warm-700 uppercase tracking-wide">
                  Participants ({tutors.length} inscrit{tutors.length > 1 ? 's' : ''} · {unassignedCount} non affecté{unassignedCount > 1 ? 's' : ''})
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
                  <SearchField value={search} onChange={v => { setSearch(v); setPoolPage(1) }} />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                {poolTutors.length === 0 && q && (
                  <p className="text-xs text-warm-700 text-center py-6">Aucun résultat</p>
                )}
                {pagedTutors.map(t => {
                  const isInCurrentClass      = roster.includes(t.id)
                  const isSavedInCurrentClass = originalRoster.includes(t.id)
                  const assignedClassId       = isInCurrentClass ? null : serverMap[t.id]
                  const assignedClass         = assignedClassId ? classes.find(c => c.id === assignedClassId) : null
                  const isInOtherClass        = !!assignedClass
                  const isDisabled            = isInCurrentClass || isInOtherClass || (!isInCurrentClass && !isInOtherClass && isFull)
                  const badgeClass            = isInOtherClass ? assignedClass : (isSavedInCurrentClass ? selectedClass : null)
                  return (
                    <TutorCard
                      key={t.id}
                      tutor={t}
                      disabled={isDisabled}
                      onAdd={addToRoster}
                      assignedClassName={badgeClass?.name}
                      assignedClassLine={badgeClass ? classInfoLine(badgeClass) : undefined}
                    />
                  )
                })}
              </div>

              {/* Pagination */}
              {poolTotalPages > 1 && (
                <div className="flex-shrink-0 flex items-center justify-between pt-2 border-t border-warm-100">
                  <span className="text-[11px] text-warm-700">
                    {(poolCurPage - 1) * POOL_PAGE_SIZE + 1}-{Math.min(poolCurPage * POOL_PAGE_SIZE, poolTutors.length)} / {poolTutors.length}
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
                              p === poolCurPage ? 'bg-primary-600 text-white' : 'text-warm-700 hover:bg-warm-100 hover:text-secondary-700'
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

            {/* ── Panel droit : participants dans le cours ── */}
            <div className="card p-3 flex flex-col gap-3 min-h-0">
              <div className="flex-shrink-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-secondary-800 truncate">{selectedClass?.name}</h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isFull && (
                      <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Complet</span>
                    )}
                    <Tooltip content="Recharger depuis la base">
                      <button
                        type="button"
                        onClick={reloadClass}
                        aria-label="Recharger le cours depuis la base"
                        className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                      >
                        <RotateCcw size={15} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                <ClassInfo />
              </div>

              <ClassRoster rosterTutors={rosterTutors} onRemove={removeFromRoster} />
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

    </div>
  )
}
