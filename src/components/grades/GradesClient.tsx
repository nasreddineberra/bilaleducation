'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Check, ChevronRight, ChevronDown, ChevronLeft,
  BookOpen, AlertCircle, RotateCcw,
} from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { UniteEnseignement, CoursModule, Cours, Period, EvalTypeConfig } from '@/types/database'
import { parseDiagnosticOption } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string; name: string; level: string
  day_of_week: string | null; start_time: string | null; end_time: string | null
  main_teacher_name: string | null
}

type EvaluationRow = {
  id: string; class_id: string; period_id: string | null; cours_id: string | null
  eval_kind: string | null; max_score: number | null; coefficient: number
  evaluation_date: string | null; display_module_id: string | null; display_ue_id: string | null
  sort_order: number | null
}

type EvalOrderConfig = {
  class_id: string; period_id: string; ue_order: string[]; module_order: Record<string, string[]>
}

type StudentRow = {
  student_id: string; class_id: string
  first_name: string; last_name: string; student_number: string; photo_url: string | null
}

type GradeRow = {
  id?: string; student_id: string; evaluation_id: string
  score: number | null; comment: string | null; is_absent: boolean
}

type PendingEntry = {
  scoreValue: string   // numeric string pour scored/stars, option string pour diagnostic
  comment:    string
  is_absent:  boolean
  dirty:      boolean
}

interface Props {
  classes:         ClassRow[]
  periods:         Period[]
  evalTypeConfigs: EvalTypeConfig[]
  ues:             UniteEnseignement[]
  modules:         CoursModule[]
  cours:           Cours[]
  evaluations:     EvaluationRow[]
  evalOrderConfigs: EvalOrderConfig[]
  students:        StudentRow[]
  initialGrades:   GradeRow[]
  etablissementId: string
  schoolYearId:    string | null
  teacherId:       string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVAL_BADGE: Record<string, { label: string; cls: string }> = {
  diagnostic: { label: 'Diagnostique', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  scored:     { label: 'Notée',        cls: 'bg-green-50 text-green-700 border-green-200' },
  stars:      { label: 'Étoilée',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const PERIOD_LABELS: Record<string, string> = {
  S1: 'Semestre 1', S2: 'Semestre 2', T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
}

function getInitialScoreValue(grade: GradeRow | undefined, evalKind: string | null): string {
  if (!grade) return ''
  if (evalKind === 'diagnostic') return grade.comment ?? ''
  return grade.score != null ? String(grade.score) : ''
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GradesClient({
  classes, periods, evalTypeConfigs, ues, modules, cours,
  evaluations, evalOrderConfigs, students, initialGrades,
  schoolYearId, teacherId,
}: Props) {

  // ── Sélecteurs ──────────────────────────────────────────────────────────────
  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(classes[0]?.id ?? null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(periods[0]?.id ?? null)
  const [selectedEvalId,   setSelectedEvalId]   = useState<string | null>(null)
  const [expandedUEs,      setExpandedUEs]      = useState<Set<string>>(new Set(ues.map(u => u.id)))

  // ── Données ─────────────────────────────────────────────────────────────────
  const [gradesList, setGradesList] = useState<GradeRow[]>(initialGrades)
  const [pending,    setPending]    = useState<Record<string, PendingEntry>>({})
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [confirmReset,  setConfirmReset]  = useState(false)

  // ── Évaluations de la classe × période sélectionnée ─────────────────────────
  const currentEvals = useMemo(() =>
    evaluations.filter(e => e.class_id === selectedClassId && e.period_id === selectedPeriodId),
    [evaluations, selectedClassId, selectedPeriodId]
  )

  // ── Élèves de la classe ──────────────────────────────────────────────────────
  const classStudents = useMemo(() =>
    students.filter(s => s.class_id === selectedClassId),
    [students, selectedClassId]
  )

  // ── Config d'ordre pour la classe × période ──────────────────────────────────
  const orderConfig = useMemo(() =>
    evalOrderConfigs.find(c => c.class_id === selectedClassId && c.period_id === selectedPeriodId),
    [evalOrderConfigs, selectedClassId, selectedPeriodId]
  )

  // ── Helpers UE/Module effectifs (display override > naturel) ─────────────────
  const getEffUeId = useCallback((e: EvaluationRow) =>
    e.display_ue_id ?? cours.find(c => c.id === e.cours_id)?.unite_enseignement_id ?? '',
    [cours]
  )
  const getEffModId = useCallback((e: EvaluationRow): string | null =>
    e.display_ue_id !== null
      ? e.display_module_id
      : cours.find(c => c.id === e.cours_id)?.module_id ?? null,
    [cours]
  )

  // ── UEs du panneau gauche, dans l'ordre sauvegardé ───────────────────────────
  const rightUEIds = useMemo(() => {
    const ids = new Set<string>()
    currentEvals.forEach(e => { const id = getEffUeId(e); if (id) ids.add(id) })
    return ids
  }, [currentEvals, getEffUeId])

  const leftUEs = useMemo(() => {
    const natural  = ues.filter(ue => rightUEIds.has(ue.id))
    const ueOrder  = orderConfig?.ue_order ?? []
    if (ueOrder.length === 0) return natural
    const known    = ueOrder.filter(id => rightUEIds.has(id)).map(id => ues.find(u => u.id === id)).filter((u): u is UniteEnseignement => Boolean(u))
    const newOnes  = natural.filter(ue => !ueOrder.includes(ue.id))
    return [...known, ...newOnes]
  }, [ues, rightUEIds, orderConfig])

  // ── Liste plate ordonnée (pour prev / next) ──────────────────────────────────
  const orderedEvals = useMemo(() => {
    const result: EvaluationRow[] = []
    for (const ue of leftUEs) {
      const ueEvals  = currentEvals.filter(e => getEffUeId(e) === ue.id)
      const directs  = ueEvals.filter(e => getEffModId(e) === null)
      result.push(...directs)

      const naturalModIds = [...new Set(ueEvals.map(e => getEffModId(e)).filter((id): id is string => id !== null))]
      const savedOrder    = orderConfig?.module_order?.[ue.id]
      const modIds = savedOrder
        ? [...savedOrder.filter(id => naturalModIds.includes(id)), ...naturalModIds.filter(id => !savedOrder.includes(id))]
        : naturalModIds

      for (const modId of modIds) {
        result.push(...ueEvals.filter(e => getEffModId(e) === modId))
      }
    }
    return result
  }, [currentEvals, leftUEs, getEffUeId, getEffModId, orderConfig])

  // ── Évaluation sélectionnée ──────────────────────────────────────────────────
  const selectedEval  = evaluations.find(e => e.id === selectedEvalId) ?? null
  const selectedCours = cours.find(c => c.id === selectedEval?.cours_id) ?? null

  const currentIdx = orderedEvals.findIndex(e => e.id === selectedEvalId)
  const prevEval   = currentIdx > 0 ? orderedEvals[currentIdx - 1] : null
  const nextEval   = currentIdx < orderedEvals.length - 1 ? orderedEvals[currentIdx + 1] : null

  // ── Options diagnostiques ────────────────────────────────────────────────────
  const diagnosticOptions = useMemo(() => {
    const config = evalTypeConfigs.find(c => c.eval_type === 'diagnostic')
    const raw = config?.diagnostic_options
    if (!raw?.length) return [{ acronym: 'AC', comment: '' }, { acronym: 'EC', comment: '' }, { acronym: 'NA', comment: '' }]
    return (raw as unknown[]).map(parseDiagnosticOption)
  }, [evalTypeConfigs])

  // ── Réinitialisation des pending lors du changement d'évaluation ─────────────
  useEffect(() => {
    if (!selectedEvalId) { setPending({}); return }
    const ev = evaluations.find(e => e.id === selectedEvalId)
    const init: Record<string, PendingEntry> = {}
    for (const s of classStudents) {
      const existing = gradesList.find(g => g.evaluation_id === selectedEvalId && g.student_id === s.student_id)
      init[s.student_id] = {
        scoreValue: getInitialScoreValue(existing, ev?.eval_kind ?? null),
        comment:    ev?.eval_kind !== 'diagnostic' ? (existing?.comment ?? '') : '',
        is_absent:  existing?.is_absent ?? false,
        dirty:      false,
      }
    }
    setPending(init)
    setError(null)
    setConfirmReset(false)
  }, [selectedEvalId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset de la sélection lors du changement de classe ou période ────────────
  useEffect(() => {
    setSelectedEvalId(null)
  }, [selectedClassId, selectedPeriodId])

  // ── Dirty flag global ────────────────────────────────────────────────────────
  const hasDirty = Object.values(pending).some(e => e.dirty)

  // ── Complétion par évaluation ────────────────────────────────────────────────
  const getCompletion = useCallback((evalId: string) => {
    const total  = classStudents.length
    const graded = gradesList.filter(g =>
      g.evaluation_id === evalId && (g.score !== null || g.comment !== null || g.is_absent)
    ).length
    return { total, graded }
  }, [gradesList, classStudents])

  // ── Mise à jour d'une entrée pending ────────────────────────────────────────
  const updatePending = (studentId: string, update: Partial<PendingEntry>) =>
    setPending(prev => ({ ...prev, [studentId]: { ...prev[studentId], ...update, dirty: true } }))

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedEvalId || !selectedEval) return
    const dirtyIds = Object.entries(pending).filter(([, v]) => v.dirty).map(([k]) => k)
    if (dirtyIds.length === 0) return

    setSaving(true); setError(null)

    const upserts = dirtyIds.map(studentId => {
      const entry = pending[studentId]
      const base  = { student_id: studentId, evaluation_id: selectedEvalId, graded_at: new Date().toISOString(), ...(teacherId ? { graded_by: teacherId } : {}) }
      if (entry.is_absent) {
        return { ...base, score: null, comment: null, is_absent: true }
      }
      if (selectedEval.eval_kind === 'diagnostic') {
        return { ...base, score: null, comment: entry.scoreValue || null, is_absent: false }
      }
      const score = entry.scoreValue === '' ? null : parseFloat(entry.scoreValue)
      return { ...base, score, comment: entry.comment || null, is_absent: false }
    })

    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('grades')
      .upsert(upserts, { onConflict: 'student_id,evaluation_id' })
      .select('id, student_id, evaluation_id, score, comment, is_absent')

    if (err) { setError(err.message); setSaving(false); return }

    setGradesList(prev => [
      ...prev.filter(g => !(g.evaluation_id === selectedEvalId && dirtyIds.includes(g.student_id))),
      ...(data as GradeRow[]),
    ])
    setPending(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, dirty: false }])))
    setSaving(false)
  }

  // ── Reset toutes les notes d'une évaluation ─────────────────────────────────
  const handleReset = async () => {
    if (!selectedEvalId) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('grades')
      .delete()
      .eq('evaluation_id', selectedEvalId)
    if (err) { setError(err.message); setSaving(false); return }
    setGradesList(prev => prev.filter(g => g.evaluation_id !== selectedEvalId))
    setPending(prev => Object.fromEntries(
      Object.entries(prev).map(([k]) => [k, { scoreValue: '', comment: '', is_absent: false, dirty: false }])
    ))
    setConfirmReset(false)
    setSaving(false)
  }

  // ── Navigation clavier (Enter → élève suivant) ──────────────────────────────
  const tableRef = useRef<HTMLDivElement>(null)
  const focusNext = useCallback((currentIdx: number) => {
    const next = tableRef.current?.querySelector<HTMLElement>(`[data-row-idx="${currentIdx + 1}"]`)
    next?.focus()
  }, [])

  // ── UE toggle ────────────────────────────────────────────────────────────────
  const toggleUE = (id: string) =>
    setExpandedUEs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  // ── Flags ────────────────────────────────────────────────────────────────────
  const noSchoolYear    = !schoolYearId
  const noClassOrPeriod = !selectedClassId || !selectedPeriodId

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in">

      {/* ── Barre de sélection ── */}
      <div className="card p-3 flex flex-wrap items-center gap-4 flex-shrink-0">

        {/* Classe */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide whitespace-nowrap">Classe</span>
          <select
            value={selectedClassId ?? ''}
            onChange={e => setSelectedClassId(e.target.value || null)}
            className="input text-sm py-1.5"
            disabled={classes.length === 0}
          >
            {classes.length === 0
              ? <option value="">Aucune classe disponible</option>
              : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
            }
          </select>
        </div>

        {/* Périodes */}
        {periods.length > 0 && (
          <div className="flex items-center gap-1">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriodId(p.id)}
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

        {/* Alerte année scolaire */}
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
          if (cls.main_teacher_name) parts.push(cls.main_teacher_name)
          const timeStr  = [cls.start_time, cls.end_time].filter(Boolean).map(t => t!.slice(0, 5)).join('–')
          const schedule = [cls.day_of_week, timeStr].filter(Boolean).join(' ')
          if (schedule) parts.push(schedule)
          if (parts.length === 0) return null
          return <span className="ml-auto text-sm font-medium text-warm-600 whitespace-nowrap">{parts.join(' · ')}</span>
        })()}
      </div>

      {/* ── Panneau split ── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* ── Gauche : Gabarit (lecture seule) ── */}
        <div className="w-72 flex-shrink-0 flex flex-col min-h-0">
          <div className="card p-3 flex flex-col gap-2 h-full min-h-0">
            <p className="text-xs font-bold text-warm-500 uppercase tracking-widest flex-shrink-0">Gabarit</p>

            {noSchoolYear || noClassOrPeriod || currentEvals.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-warm-400 text-center px-2">
                  {noSchoolYear
                    ? 'Aucune année scolaire active.'
                    : noClassOrPeriod
                    ? 'Sélectionnez une classe et une période.'
                    : 'Aucune évaluation dans ce gabarit.'}
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                {leftUEs.map(ue => {
                  const ueEvals  = currentEvals.filter(e => getEffUeId(e) === ue.id)
                  const expanded = expandedUEs.has(ue.id)

                  const naturalModIds = [...new Set(ueEvals.map(e => getEffModId(e)).filter((id): id is string => id !== null))]
                  const savedOrder    = orderConfig?.module_order?.[ue.id]
                  const modIds = savedOrder
                    ? [...savedOrder.filter(id => naturalModIds.includes(id)), ...naturalModIds.filter(id => !savedOrder.includes(id))]
                    : naturalModIds
                  const ueMods = modIds.map(id => modules.find(m => m.id === id)).filter((m): m is CoursModule => Boolean(m))
                  const directEvals = ueEvals.filter(e => getEffModId(e) === null)

                  return (
                    <div key={ue.id} className="border border-warm-100 rounded-lg overflow-hidden">

                      {/* En-tête UE */}
                      <button
                        onClick={() => toggleUE(ue.id)}
                        className="flex items-center gap-1.5 w-full px-2 py-1.5 bg-warm-50 hover:bg-warm-100 transition-colors text-left"
                      >
                        {expanded
                          ? <ChevronDown  size={13} className="text-warm-400 flex-shrink-0" />
                          : <ChevronRight size={13} className="text-warm-400 flex-shrink-0" />
                        }
                        {ue.code && (
                          <span className="text-[10px] font-mono text-warm-400 bg-warm-200 px-1 rounded flex-shrink-0">
                            {ue.code}
                          </span>
                        )}
                        <span className="text-xs font-bold text-secondary-700 truncate">{ue.nom_fr}</span>
                      </button>

                      {/* Évaluations de l'UE */}
                      {expanded && (
                        <div className="py-1 space-y-px">

                          {/* Cours directs */}
                          <div className="px-2">
                            {directEvals.map(ev => (
                              <EvalRow
                                key={ev.id} ev={ev} cours={cours}
                                selected={selectedEvalId === ev.id}
                                completion={getCompletion(ev.id)}
                                onClick={() => setSelectedEvalId(ev.id)}
                              />
                            ))}
                          </div>

                          {/* Modules */}
                          {ueMods.map(mod => {
                            const modEvals = ueEvals.filter(e => getEffModId(e) === mod.id)
                            return (
                              <div key={mod.id} className="mt-0.5 ml-4">
                                <p className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider pl-3 pr-2 pt-1.5 pb-0.5 border-l-2 border-warm-100">
                                  {mod.code && <span className="font-mono mr-1">{mod.code}</span>}
                                  {mod.nom_fr}
                                </p>
                                <div className="pl-2">
                                  {modEvals.map(ev => (
                                    <EvalRow
                                      key={ev.id} ev={ev} cours={cours}
                                      selected={selectedEvalId === ev.id}
                                      completion={getCompletion(ev.id)}
                                      onClick={() => setSelectedEvalId(ev.id)}
                                    />
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Droite : Saisie des notes ── */}
        <div className="flex-1 min-h-0">
          <div className="card p-3 flex flex-col h-full min-h-0">

            {!selectedEval ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-warm-400">
                  <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sélectionnez une évaluation dans le gabarit.</p>
                </div>
              </div>
            ) : (
              <>
                {/* En-tête évaluation */}
                <div className="flex items-start gap-3 mb-3 pb-2 border-b border-warm-100 flex-shrink-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-secondary-800">
                      {selectedCours?.nom_fr ?? '—'}
                      {selectedCours?.nom_ar && (
                        <span className="text-warm-400 font-normal ml-2">{selectedCours.nom_ar}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {(() => {
                        const b = EVAL_BADGE[selectedEval.eval_kind ?? ''] ?? EVAL_BADGE.diagnostic
                        return (
                          <span className={clsx('text-[10px] font-semibold border px-1.5 py-px rounded-full', b.cls)}>
                            {b.label}
                            {selectedEval.eval_kind === 'scored' && selectedEval.max_score != null && ` /${selectedEval.max_score}`}
                          </span>
                        )
                      })()}
                      {selectedEval.eval_kind === 'diagnostic' && diagnosticOptions.some(o => o.comment) && (
                        <span className="text-xs text-warm-500">
                          {diagnosticOptions.filter(o => o.comment).map(o => `${o.acronym} : ${o.comment}`).join(' - ')}
                        </span>
                      )}
                      {selectedEval.eval_kind === 'scored' && (
                        <span className="text-xs text-warm-500">Coef. {selectedEval.coefficient}</span>
                      )}
                      {selectedEval.evaluation_date && (
                        <span className="text-xs text-warm-400">
                          {new Date(selectedEval.evaluation_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const { graded, total } = getCompletion(selectedEvalId!)
                    const kind = selectedEval.eval_kind
                    const showAvg = (kind === 'scored' || kind === 'stars')
                    const scores = gradesList
                      .filter(g => g.evaluation_id === selectedEvalId && !g.is_absent && g.score !== null)
                      .map(g => g.score as number)
                    const avg = scores.length > 0
                      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(kind === 'scored' ? 2 : 1)
                      : null

                    return (
                      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                        {total > 0 && graded >= total && (
                          <span className="text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                            Saisie complète
                          </span>
                        )}
                        {showAvg && avg !== null && total > 0 && graded >= total && (
                          <span className="text-[10px] text-warm-500">
                            Moy.{' '}
                            <span className="font-semibold text-secondary-700">
                              {avg}{kind === 'scored' ? ` / ${selectedEval.max_score}` : ' / 5'}
                            </span>
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Erreur */}
                {error && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 flex-shrink-0">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Tableau élèves */}
                <div ref={tableRef} className="flex-1 min-h-0 overflow-y-auto">
                  {classStudents.length === 0 ? (
                    <p className="text-sm text-warm-400 text-center py-8">Aucun élève inscrit dans cette classe.</p>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b-2 border-warm-100">
                          <th className="text-left text-xs font-semibold text-warm-500 py-2 pr-3 pl-1">#</th>
                          <th className="text-left text-xs font-semibold text-warm-500 py-2 pr-3">Élève</th>
                          <th className="text-center text-xs font-semibold text-warm-500 py-2 px-3 w-36">
                            {selectedEval.eval_kind === 'scored'
                              ? `Note /${selectedEval.max_score}`
                              : selectedEval.eval_kind === 'diagnostic'
                              ? 'Appréciation'
                              : 'Étoiles'}
                          </th>
                          <th className="text-center text-xs font-semibold text-warm-500 py-2 pl-3 w-20">Absent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((student, idx) => {
                          const entry    = pending[student.student_id] ?? { scoreValue: '', comment: '', is_absent: false, dirty: false }
                          const isAbsent = entry.is_absent

                          return (
                            <tr
                              key={student.student_id}
                              className={clsx(
                                'border-b border-warm-50 transition-colors group',
                                entry.dirty
                                  ? 'bg-amber-50/40 hover:bg-amber-100/50'
                                  : idx % 2 === 0
                                  ? 'bg-white hover:bg-primary-50/40'
                                  : 'bg-warm-50/20 hover:bg-primary-50/40'
                              )}
                            >
                              {/* Numéro */}
                              <td className="py-1.5 pr-2 pl-1 text-xs text-warm-300 font-mono w-8">{idx + 1}</td>

                              {/* Nom */}
                              <td className="py-1.5 pr-3">
                                <span className="font-medium text-secondary-700">{student.last_name}</span>
                                <span className="text-secondary-500 ml-1">{student.first_name}</span>
                                <span className="hidden sm:inline text-[10px] text-warm-300 font-mono ml-1.5">{student.student_number}</span>
                              </td>

                              {/* Saisie de la note */}
                              <td className="py-1 px-3 text-center">
                                {selectedEval.eval_kind === 'scored' ? (
                                  <input
                                    type="number"
                                    min={0}
                                    max={selectedEval.max_score ?? undefined}
                                    step={0.1}
                                    value={entry.scoreValue}
                                    onChange={e => updatePending(student.student_id, { scoreValue: e.target.value })}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusNext(idx) } }}
                                    disabled={isAbsent}
                                    placeholder="0,0"
                                    data-row-idx={idx}
                                    className="input text-sm py-0.5 w-24 text-center disabled:opacity-30 disabled:cursor-not-allowed"
                                  />
                                ) : selectedEval.eval_kind === 'diagnostic' ? (
                                  <select
                                    value={entry.scoreValue}
                                    onChange={e => { updatePending(student.student_id, { scoreValue: e.target.value }); focusNext(idx) }}
                                    disabled={isAbsent}
                                    data-row-idx={idx}
                                    className="input text-sm py-0.5 w-28 disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <option value="">—</option>
                                    {diagnosticOptions.map(opt => (
                                      <option key={opt.acronym} value={opt.acronym}>{opt.acronym}</option>
                                    ))}
                                  </select>
                                ) : (
                                  /* Stars — demi-étoile */
                                  <StarInput
                                    value={entry.scoreValue === '' ? null : parseFloat(entry.scoreValue)}
                                    onChange={v => updatePending(student.student_id, { scoreValue: v === null ? '' : String(v) })}
                                    disabled={isAbsent}
                                  />
                                )}
                              </td>

                              {/* Absent */}
                              <td className="py-1 pl-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAbsent}
                                  onChange={e => updatePending(student.student_id, {
                                    is_absent:  e.target.checked,
                                    scoreValue: e.target.checked ? '' : entry.scoreValue,
                                  })}
                                  className="h-4 w-4 rounded border-warm-300 text-primary-500 focus:ring-primary-400 cursor-pointer"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pied — stats + actions */}
                <div className="flex-shrink-0 pt-2 mt-2 border-t border-warm-100 flex items-center gap-3">

                  {/* Progression */}
                  {(() => {
                    const { graded, total } = getCompletion(selectedEvalId!)
                    const absent = gradesList.filter(g => g.evaluation_id === selectedEvalId && g.is_absent).length
                    return (
                      <p className="text-xs text-warm-400 flex-1">
                        <span className={clsx(
                          'font-semibold',
                          graded === total && total > 0 ? 'text-green-600' : graded > 0 ? 'text-amber-600' : 'text-warm-400'
                        )}>
                          {graded}/{total}
                        </span>
                        {' saisis'}
                        {absent > 0 && <span> · {absent} absent{absent > 1 ? 's' : ''}</span>}
                        {hasDirty && <span className="text-amber-500 ml-2">· Modifications non enregistrées</span>}
                      </p>
                    )
                  })()}

                  {/* Boutons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {confirmReset ? (
                      <>
                        <span className="text-xs text-warm-500">Réinitialiser toutes les notes ?</span>
                        <button
                          onClick={handleReset}
                          disabled={saving}
                          className="text-xs font-medium px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          Oui
                        </button>
                        <button
                          onClick={() => setConfirmReset(false)}
                          className="btn btn-secondary text-xs py-1 px-2"
                        >
                          Non
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmReset(true)}
                        disabled={saving || !gradesList.some(g => g.evaluation_id === selectedEvalId)}
                        className="btn btn-secondary text-xs py-1 px-2 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Réinitialiser toutes les notes"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={!hasDirty || saving}
                      className="btn btn-primary text-xs py-1 px-3 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Check size={13} />
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => prevEval && setSelectedEvalId(prevEval.id)}
                      disabled={!prevEval}
                      className="btn btn-secondary text-xs py-1 px-2 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Évaluation précédente"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => nextEval && setSelectedEvalId(nextEval.id)}
                      disabled={!nextEval}
                      className="btn btn-secondary text-xs py-1 px-2 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Évaluation suivante"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Ligne d'évaluation dans le gabarit gauche ───────────────────────────────

function EvalRow({
  ev, cours, selected, completion, onClick,
}: {
  ev:         EvaluationRow
  cours:      Cours[]
  selected:   boolean
  completion: { total: number; graded: number }
  onClick:    () => void
}) {
  const coursItem  = cours.find(c => c.id === ev.cours_id)
  const { graded, total } = completion
  const isComplete = total > 0 && graded >= total
  const isPartial  = graded > 0 && graded < total

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 w-full px-1 py-1 text-left rounded-md transition-colors text-xs',
        selected
          ? 'bg-primary-50 border border-primary-200 text-primary-700'
          : 'hover:bg-warm-50 text-secondary-600'
      )}
    >
      {/* Indicateur de complétion */}
      <span className={clsx(
        'w-1.5 h-1.5 rounded-full flex-shrink-0',
        isComplete ? 'bg-green-400' : isPartial ? 'bg-amber-400' : 'bg-warm-200'
      )} />

      {/* Nom du cours */}
      <span className="flex-1 truncate min-w-0">
        {coursItem?.code && (
          <span className="font-mono text-[10px] text-warm-400 mr-1">{coursItem.code}</span>
        )}
        {coursItem?.nom_fr ?? '—'}
      </span>

      {/* Compteur */}
      <span className={clsx(
        'text-[10px] font-mono flex-shrink-0',
        isComplete ? 'text-green-500' : isPartial ? 'text-amber-500' : 'text-warm-300'
      )}>
        {graded}/{total}
      </span>
    </button>
  )
}

// ─── Saisie étoilée demi-étoile ──────────────────────────────────────────────

function StarInput({
  value, onChange, disabled,
}: {
  value:    number | null
  onChange: (v: number | null) => void
  disabled: boolean
}) {
  return (
    <div className={clsx('flex items-center justify-center gap-2', disabled && 'opacity-30 pointer-events-none')}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => {
          const isFull = value !== null && value >= n
          const isHalf = value !== null && value >= n - 0.5 && value < n
          return (
            <span key={n} className="relative inline-block leading-none select-none text-2xl">
              {/* Fond gris */}
              <span className="text-warm-200">★</span>
              {/* Remplissage ambré — clippé à gauche */}
              <span
                className="absolute top-0 left-0 h-full overflow-hidden text-amber-400 leading-none"
                style={{ width: isFull ? '100%' : isHalf ? '50%' : '0%' }}
              >
                ★
              </span>
              {/* Zone cliquable gauche → n - 0.5 */}
              <button
                type="button"
                className="absolute left-0 top-0 w-1/2 h-full cursor-pointer"
                onClick={() => onChange(value === n - 0.5 ? 0 : n - 0.5)}
              />
              {/* Zone cliquable droite → n */}
              <button
                type="button"
                className="absolute right-0 top-0 w-1/2 h-full cursor-pointer"
                onClick={() => onChange(value === n ? 0 : n)}
              />
            </span>
          )
        })}
      </div>
      <span className="text-xs font-semibold text-secondary-700 w-8 text-left tabular-nums">
        {value !== null ? value : '—'}
      </span>
    </div>
  )
}
