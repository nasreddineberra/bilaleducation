'use client'

import { useState, useMemo, useRef } from 'react'
import { clsx } from 'clsx'
import { Plus, ChevronRight, ChevronDown, FileCheck, AlertTriangle, Upload, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Period, Absence, AbsenceType } from '@/types/database'

// ─── Types props ─────────────────────────────────────────────────────────────

type ClassRow = {
  id: string
  name: string
  level: string
  day_of_week: string | null
  start_time: string | null
  end_time: string | null
  main_teacher_name: string | null
  main_teacher_civilite: string | null
}

type StudentRow = {
  student_id: string
  class_id: string
  first_name: string
  last_name: string
  student_number: string
}

interface AbsencesClientProps {
  classes: ClassRow[]
  periods: Period[]
  students: StudentRow[]
  initialAbsences: Absence[]
  etablissementId: string
  schoolYearId: string | null
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}

const ALERT_THRESHOLD = 3 // absences NJ

const fmtDate = (d: string) => {
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function AbsencesClient({
  classes,
  periods,
  students,
  initialAbsences,
  etablissementId,
  schoolYearId,
}: AbsencesClientProps) {
  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(classes[0]?.id ?? null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(periods[0]?.id ?? null)
  const [absences,         setAbsences]         = useState<Absence[]>(initialAbsences)
  const [expandedStudent,  setExpandedStudent]  = useState<string | null>(null)
  const [showSaisie,       setShowSaisie]       = useState(false)
  const [justifyTarget,    setJustifyTarget]    = useState<Absence | null>(null)

  // Élèves de la classe sélectionnée
  const classStudents = useMemo(
    () => students.filter(s => s.class_id === selectedClassId),
    [students, selectedClassId]
  )

  // Absences de la classe + période
  const periodAbsences = useMemo(
    () => absences.filter(a => a.class_id === selectedClassId && a.period_id === selectedPeriodId),
    [absences, selectedClassId, selectedPeriodId]
  )

  // Compteurs par élève
  const countsByStudent = useMemo(() => {
    const map = new Map<string, { abs: number; absNJ: number; ret: number }>()
    for (const s of classStudents) {
      map.set(s.student_id, { abs: 0, absNJ: 0, ret: 0 })
    }
    for (const a of periodAbsences) {
      const c = map.get(a.student_id)
      if (!c) continue
      if (a.absence_type === 'absence') {
        c.abs++
        if (!a.is_justified) c.absNJ++
      } else {
        c.ret++
      }
    }
    return map
  }, [classStudents, periodAbsences])

  // Résumé global
  const summary = useMemo(() => {
    let abs = 0, absNJ = 0, ret = 0
    for (const c of countsByStudent.values()) {
      abs += c.abs; absNJ += c.absNJ; ret += c.ret
    }
    return { abs, absNJ, ret }
  }, [countsByStudent])

  // Infos classe
  const noSchoolYear    = !schoolYearId
  const noClassOrPeriod = !selectedClassId || !selectedPeriodId

  // Callback après saisie (ajouts, mises à jour, suppressions)
  const handleSaisieComplete = (added: Absence[], updated: Absence[], deletedIds: string[]) => {
    setAbsences(prev => {
      const afterDelete = prev.filter(a => !deletedIds.includes(a.id))
      const afterUpdate = afterDelete.map(a => {
        const u = updated.find(u => u.id === a.id)
        return u ?? a
      })
      return [...afterUpdate, ...added]
    })
    setShowSaisie(false)
  }

  // Callback après justification
  const handleJustifyComplete = (updated: Absence) => {
    setAbsences(prev => prev.map(a => a.id === updated.id ? updated : a))
    setJustifyTarget(null)
  }

  // Retirer une justification
  const handleRemoveJustification = async (id: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('absences')
      .update({
        is_justified: false,
        justification_date: null,
        justification_comment: null,
        justification_document_url: null,
      })
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setAbsences(prev => prev.map(a => a.id === id ? (data as Absence) : a))
    }
  }

  // Suppression d'une absence
  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('absences').delete().eq('id', id)
    if (!error) setAbsences(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="h-full flex flex-col gap-2 animate-fade-in">

      {/* ── Barre de sélection ── */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide whitespace-nowrap">Classe</span>
          <select
            value={selectedClassId ?? ''}
            onChange={e => { setSelectedClassId(e.target.value || null); setExpandedStudent(null) }}
            className="input text-sm py-1.5"
            disabled={classes.length === 0}
          >
            {classes.length === 0
              ? <option value="">Aucune classe disponible</option>
              : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
            }
          </select>
        </div>

        {periods.length > 0 && (
          <div className="flex items-center gap-1">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPeriodId(p.id); setExpandedStudent(null) }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                  selectedPeriodId === p.id
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                )}
              >
                {PERIOD_LABELS[p.label] ?? p.label}
              </button>
            ))}
          </div>
        )}

        {noSchoolYear && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            Aucune année scolaire active.
          </p>
        )}

        {/* Infos classe — à droite */}
        {selectedClassId && (() => {
          const cls = classes.find(c => c.id === selectedClassId)
          if (!cls) return null
          const parts: string[] = []
          if (cls.main_teacher_name) {
            const display = cls.main_teacher_civilite
              ? `${cls.main_teacher_civilite} ${cls.main_teacher_name}`
              : cls.main_teacher_name
            parts.push(display)
          }
          if (cls.level) parts.push(`Niveau ${cls.level}`)
          const timeStr  = [cls.start_time, cls.end_time].filter(Boolean).map(t => t!.slice(0, 5)).join('–')
          const schedule = [cls.day_of_week, timeStr].filter(Boolean).join(' ')
          if (schedule) parts.push(schedule)
          if (parts.length === 0) return null
          return <span className="ml-auto text-sm font-medium text-warm-600 whitespace-nowrap">{parts.join(' · ')}</span>
        })()}
      </div>

      {/* ── Contenu principal ── */}
      <div className="card flex-1 min-h-0 flex flex-col">

        {noClassOrPeriod || noSchoolYear ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-warm-400">
              {noSchoolYear ? 'Aucune année scolaire active.' : 'Sélectionnez une classe et une période.'}
            </p>
          </div>
        ) : (
          <>
            {/* Barre résumé + bouton saisie */}
            <div className="px-3 py-1.5 flex items-center justify-between border-b border-warm-100 flex-shrink-0">
              <button
                onClick={() => setShowSaisie(true)}
                className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
              >
                <Plus size={14} /> Saisir
              </button>
              <div className="flex items-center gap-4 text-xs text-warm-500">
                <span>{summary.abs} absence{summary.abs > 1 ? 's' : ''} <span className="text-red-500 font-semibold">({summary.absNJ} NJ)</span></span>
                <span>{summary.ret} retard{summary.ret > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Tableau */}
            <div className="flex-1 overflow-y-auto">
              {classStudents.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-warm-400">Aucun élève inscrit dans cette classe.</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-warm-50 z-10">
                    <tr className="text-[11px] text-warm-500 uppercase tracking-wide">
                      <th className="text-left py-1 px-2 pl-3 font-semibold">Élèves</th>
                      <th className="text-center py-1 px-2 font-semibold w-14">Abs</th>
                      <th className="text-center py-1 px-2 font-semibold w-14">Abs NJ</th>
                      <th className="text-center py-1 px-2 font-semibold w-14">Ret</th>
                      <th className="text-center py-1 px-2 font-semibold w-14">Total</th>
                      <th className="text-center py-1 px-2 font-semibold w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map(s => {
                      const c = countsByStudent.get(s.student_id) ?? { abs: 0, absNJ: 0, ret: 0 }
                      const total = c.abs + c.ret
                      const isExpanded = expandedStudent === s.student_id
                      const studentAbsences = periodAbsences
                        .filter(a => a.student_id === s.student_id)
                        .sort((a, b) => a.absence_date.localeCompare(b.absence_date))
                      const hasAlert = c.absNJ >= ALERT_THRESHOLD

                      return (
                        <StudentRow
                          key={s.student_id}
                          student={s}
                          counts={c}
                          total={total}
                          hasAlert={hasAlert}
                          isExpanded={isExpanded}
                          absences={studentAbsences}
                          onToggle={() => setExpandedStudent(isExpanded ? null : s.student_id)}
                          onJustify={setJustifyTarget}
                          onRemoveJustification={handleRemoveJustification}
                          onDelete={handleDelete}
                        />
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modale Saisie ── */}
      {showSaisie && selectedClassId && selectedPeriodId && (
        <SaisieModal
          classStudents={classStudents}
          classId={selectedClassId}
          periodId={selectedPeriodId}
          etablissementId={etablissementId}
          existingAbsences={periodAbsences}
          onComplete={handleSaisieComplete}
          onClose={() => setShowSaisie(false)}
        />
      )}

      {/* ── Modale Justification ── */}
      {justifyTarget && (
        <JustificationModal
          absence={justifyTarget}
          studentName={(() => {
            const s = students.find(s => s.student_id === justifyTarget.student_id)
            return s ? `${s.last_name} ${s.first_name}` : ''
          })()}
          etablissementId={etablissementId}
          onComplete={handleJustifyComplete}
          onClose={() => setJustifyTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Ligne élève + accordéon ─────────────────────────────────────────────────

function StudentRow({
  student, counts, total, hasAlert, isExpanded, absences,
  onToggle, onJustify, onRemoveJustification, onDelete,
}: {
  student: StudentRow
  counts: { abs: number; absNJ: number; ret: number }
  total: number
  hasAlert: boolean
  isExpanded: boolean
  absences: Absence[]
  onToggle: () => void
  onJustify: (a: Absence) => void
  onRemoveJustification: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmRemoveJustId, setConfirmRemoveJustId] = useState<string | null>(null)

  return (
    <>
      <tr
        onClick={onToggle}
        className={clsx(
          'cursor-pointer transition-colors border-b border-warm-50',
          isExpanded ? 'bg-primary-50' : 'hover:bg-warm-50'
        )}
      >
        <td className="py-1 px-2 pl-3 font-medium text-secondary-700 flex items-center gap-1">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {student.last_name} {student.first_name}
        </td>
        <td className="text-center py-1 px-2">{counts.abs || '–'}</td>
        <td className={clsx('text-center py-1 px-2 font-semibold', counts.absNJ > 0 && 'text-red-600')}>{counts.absNJ || '–'}</td>
        <td className="text-center py-1 px-2">{counts.ret || '–'}</td>
        <td className="text-center py-1 px-2 font-semibold">{total || '–'}</td>
        <td className="text-center py-1 px-2">
          {hasAlert && <AlertTriangle size={12} className="text-amber-500 mx-auto" />}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-warm-50/50 px-3 py-2">
            {absences.length === 0 ? (
              <p className="text-xs text-warm-400 italic py-1">Aucune absence ou retard enregistré.</p>
            ) : (
              <div className="space-y-1">
                {absences.map(a => (
                  <div key={a.id} className="flex items-center gap-3 text-xs py-1 border-b border-warm-100 last:border-0">
                    <span className="font-mono text-warm-600 w-16 flex-shrink-0">{fmtDate(a.absence_date)}</span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0',
                      a.absence_type === 'absence'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    )}>
                      {a.absence_type === 'absence' ? 'Absence' : 'Retard'}
                    </span>
                    {a.comment && <span className="text-warm-500 truncate">{a.comment}</span>}
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                      {a.is_justified ? (
                        <span className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 text-green-600">
                            <FileCheck size={12} /> Justifié
                            {a.justification_date && <span className="text-warm-400">({fmtDate(a.justification_date)})</span>}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); onJustify(a) }}
                            className="text-primary-500 hover:text-primary-700 font-semibold transition-colors"
                          >
                            Modifier
                          </button>
                          {confirmRemoveJustId === a.id ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={e => { e.stopPropagation(); onRemoveJustification(a.id); setConfirmRemoveJustId(null) }}
                                className="text-red-600 font-semibold hover:text-red-800"
                              >
                                Confirmer ?
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmRemoveJustId(null) }}
                                className="text-warm-400 hover:text-warm-600"
                              >
                                Annuler
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmRemoveJustId(a.id) }}
                              className="text-warm-400 hover:text-red-500 font-semibold transition-colors"
                            >
                              Retirer
                            </button>
                          )}
                        </span>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); onJustify(a) }}
                          className="text-primary-600 hover:text-primary-800 font-semibold transition-colors"
                        >
                          Justifier
                        </button>
                      )}
                      {confirmDeleteId === a.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); onDelete(a.id); setConfirmDeleteId(null) }}
                            className="text-red-600 font-semibold hover:text-red-800"
                          >
                            Confirmer ?
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                            className="text-warm-400 hover:text-warm-600"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(a.id) }}
                          className="text-warm-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Modale Saisie ───────────────────────────────────────────────────────────

type SaisieEntry = {
  student_id: string
  status: 'present' | 'absence' | 'retard'
  comment: string
  existingId: string | null        // id de l'absence existante si déjà enregistrée
  existingType: AbsenceType | null // type original pour détecter les changements
}

function buildEntries(classStudents: StudentRow[], existingAbsences: Absence[], date: string): SaisieEntry[] {
  const dateAbsences = existingAbsences.filter(a => a.absence_date === date)
  return classStudents.map(s => {
    const existing = dateAbsences.find(a => a.student_id === s.student_id)
    if (existing) {
      return {
        student_id: s.student_id,
        status: existing.absence_type as 'absence' | 'retard',
        comment: existing.comment ?? '',
        existingId: existing.id,
        existingType: existing.absence_type,
      }
    }
    return { student_id: s.student_id, status: 'present' as const, comment: '', existingId: null, existingType: null }
  })
}

function SaisieModal({
  classStudents, classId, periodId, etablissementId, existingAbsences, onComplete, onClose,
}: {
  classStudents: StudentRow[]
  classId: string
  periodId: string
  etablissementId: string
  existingAbsences: Absence[]
  onComplete: (added: Absence[], updated: Absence[], deletedIds: string[]) => void
  onClose: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [date,         setDate]         = useState(today)
  const [entries,      setEntries]      = useState<SaisieEntry[]>(
    () => buildEntries(classStudents, existingAbsences, today)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    setEntries(buildEntries(classStudents, existingAbsences, newDate))
  }

  const setEntry = (idx: number, status: 'present' | 'absence' | 'retard') => {
    setEntries(prev => prev.map((e, i) => i === idx
      ? { ...e, status, comment: status === 'present' ? '' : e.comment }
      : e
    ))
  }

  const setComment = (idx: number, comment: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, comment } : e))
  }

  // Entrées à insérer (nouvelles absences)
  const toInsert = entries.filter(e => e.status !== 'present' && !e.existingId)
  // Entrées à mettre à jour (type ou commentaire changé)
  const toUpdate = entries.filter(e => e.status !== 'present' && e.existingId && (
    e.status !== e.existingType || e.comment.trim() !== (existingAbsences.find(a => a.id === e.existingId)?.comment ?? '')
  ))
  // Entrées à supprimer (repassées en présent alors qu'il y avait une absence)
  const toDelete = entries.filter(e => e.status === 'present' && e.existingId)

  const hasChanges = toInsert.length > 0 || toUpdate.length > 0 || toDelete.length > 0

  const handleSubmit = async () => {
    if (!hasChanges) { onClose(); return }
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null

      let added: Absence[] = []
      let updated: Absence[] = []
      const deletedIds: string[] = []

      // Insertions
      if (toInsert.length > 0) {
        const rows = toInsert.map(e => ({
          etablissement_id: etablissementId,
          student_id:       e.student_id,
          class_id:         classId,
          period_id:        periodId,
          absence_date:     date,
          absence_type:     e.status as AbsenceType,
          comment:          e.comment.trim() || null,
          is_justified:     false,
          recorded_by:      uid,
        }))
        const { data, error: err } = await supabase.from('absences').insert(rows).select()
        if (err) throw err
        added = (data ?? []) as Absence[]
      }

      // Mises à jour
      for (const e of toUpdate) {
        const { data, error: err } = await supabase
          .from('absences')
          .update({
            absence_type: e.status as AbsenceType,
            comment:      e.comment.trim() || null,
          })
          .eq('id', e.existingId!)
          .select()
          .single()
        if (err) throw err
        if (data) updated.push(data as Absence)
      }

      // Suppressions (repassés en présent)
      for (const e of toDelete) {
        const { error: err } = await supabase.from('absences').delete().eq('id', e.existingId!)
        if (err) throw err
        deletedIds.push(e.existingId!)
      }

      onComplete(added, updated, deletedIds)
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors de l\'enregistrement.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        <div className="px-3 py-2 border-b border-warm-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-sm font-bold text-secondary-800">Saisie des absences</h3>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={e => handleDateChange(e.target.value)}
              className="input text-sm py-1 px-2"
            />
            <button onClick={onClose} className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-warm-50 z-10">
              <tr className="text-[11px] text-warm-500 uppercase tracking-wide">
                <th className="text-left py-1 px-2 pl-3 font-semibold">Élève</th>
                <th className="text-center py-1 px-2 font-semibold w-20">Présent(e)</th>
                <th className="text-center py-1 px-2 font-semibold w-16">Absent</th>
                <th className="text-center py-1 px-2 font-semibold w-16">Retard</th>
                <th className="text-left py-1 px-2 font-semibold">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((s, idx) => {
                const entry = entries[idx]
                return (
                  <tr key={s.student_id} className="border-b border-warm-50">
                    <td className="py-1 px-2 pl-3 font-medium text-secondary-700">
                      {s.last_name} {s.first_name}
                    </td>
                    <td className="text-center py-1 px-2">
                      <input
                        type="radio"
                        name={`status-${s.student_id}`}
                        checked={entry.status === 'present'}
                        onChange={() => setEntry(idx, 'present')}
                        className="w-3.5 h-3.5 accent-green-500"
                      />
                    </td>
                    <td className="text-center py-1 px-2">
                      <input
                        type="radio"
                        name={`status-${s.student_id}`}
                        checked={entry.status === 'absence'}
                        onChange={() => setEntry(idx, 'absence')}
                        className="w-3.5 h-3.5 accent-red-500"
                      />
                    </td>
                    <td className="text-center py-1 px-2">
                      <input
                        type="radio"
                        name={`status-${s.student_id}`}
                        checked={entry.status === 'retard'}
                        onChange={() => setEntry(idx, 'retard')}
                        className="w-3.5 h-3.5 accent-amber-500"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={entry.comment}
                        onChange={e => setComment(idx, e.target.value)}
                        disabled={entry.status === 'present'}
                        placeholder={entry.status === 'present' ? '' : 'Optionnel…'}
                        className={clsx('input text-xs py-0.5', entry.status === 'present' && 'opacity-30')}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-4 py-2 border-t border-red-200">{error}</p>
        )}

        <div className="px-3 py-2 border-t border-warm-100 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-warm-400">
            {!hasChanges
              ? 'Aucune modification'
              : [
                  toInsert.length > 0 && `${toInsert.length} ajout${toInsert.length > 1 ? 's' : ''}`,
                  toUpdate.length > 0 && `${toUpdate.length} modif${toUpdate.length > 1 ? 's' : ''}`,
                  toDelete.length > 0 && `${toDelete.length} retrait${toDelete.length > 1 ? 's' : ''}`,
                ].filter(Boolean).join(', ')
            }
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary text-sm py-1.5 px-3">Annuler</button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !hasChanges}
              className="btn btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
            >
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modale Justification ────────────────────────────────────────────────────

function JustificationModal({
  absence, studentName, etablissementId, onComplete, onClose,
}: {
  absence: Absence
  studentName: string
  etablissementId: string
  onComplete: (updated: Absence) => void
  onClose: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [justDate,    setJustDate]    = useState(absence.justification_date ?? today)
  const [comment,     setComment]     = useState(absence.justification_comment ?? '')
  const [file,        setFile]        = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      let docUrl: string | null = absence.justification_document_url ?? null

      // Upload du justificatif si fourni
      if (file) {
        const ext = file.name.split('.').pop() ?? 'pdf'
        const path = `${etablissementId}/${absence.id}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('absence-justificatifs')
          .upload(path, file, { upsert: true })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage
          .from('absence-justificatifs')
          .getPublicUrl(path)
        docUrl = publicUrl
      }

      const { data, error: updateErr } = await supabase
        .from('absences')
        .update({
          is_justified:              true,
          justification_date:        justDate,
          justification_comment:     comment.trim() || null,
          justification_document_url: docUrl,
        })
        .eq('id', absence.id)
        .select()
        .single()

      if (updateErr) throw updateErr
      onComplete(data as Absence)
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors de la justification.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-secondary-800">{absence.is_justified ? 'Modifier la justification' : 'Justifier'}</h3>
          <button onClick={onClose} className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <p className="text-sm text-secondary-700">
            <span className="font-semibold">{studentName}</span>
            {' — '}
            <span className={absence.absence_type === 'absence' ? 'text-red-600' : 'text-amber-600'}>
              {absence.absence_type === 'absence' ? 'Absence' : 'Retard'}
            </span>
            {' du '}{fmtDate(absence.absence_date)}
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
              Date de justification
            </label>
            <input
              type="date"
              value={justDate}
              onChange={e => setJustDate(e.target.value)}
              className="input text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
              Commentaire
            </label>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="input text-sm"
              placeholder="Certificat médical, mot des parents…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
              Document justificatif
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Upload size={12} /> {file ? 'Changer' : 'Importer'}
              </button>
              {file && <span className="text-xs text-warm-500 truncate">{file.name}</span>}
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-warm-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary text-sm py-1.5 px-3">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
          >
            {isSubmitting ? 'Envoi…' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}
