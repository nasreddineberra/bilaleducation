'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  Download, FileText, Users, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { UniteEnseignement, CoursModule, Cours, Period, EvalTypeConfig } from '@/types/database'
import { parseDiagnosticOption } from '@/types/database'
import { generateBulletinPDF, generateAllBulletinsPDF } from './bulletinPdf'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string; name: string; level: string
  main_teacher_name: string | null
  main_teacher_civilite: string | null
}

type EvaluationRow = {
  id: string; class_id: string; period_id: string | null; cours_id: string | null
  eval_kind: string | null; max_score: number | null; coefficient: number
  evaluation_date: string | null; display_module_id: string | null; display_ue_id: string | null
}

type StudentRow = {
  student_id: string; class_id: string
  first_name: string; last_name: string; student_number: string
  date_of_birth: string | null; photo_url: string | null
}

type GradeRow = {
  id: string; student_id: string; evaluation_id: string
  score: number | null; comment: string | null; is_absent: boolean
}

type AbsenceRow = {
  student_id: string; absence_type: 'absence' | 'retard'
  is_justified: boolean; period_id: string
}

type EtablissementInfo = {
  nom: string; adresse: string | null; telephone: string | null; logo_url: string | null
}

interface Props {
  classes:         ClassRow[]
  periods:         Period[]
  evalTypeConfigs: EvalTypeConfig[]
  ues:             UniteEnseignement[]
  modules:         CoursModule[]
  cours:           Cours[]
  evaluations:     EvaluationRow[]
  students:        StudentRow[]
  grades:          GradeRow[]
  absences:        AbsenceRow[]
  etablissement:   EtablissementInfo
  yearLabel:       string | null
}

const PERIOD_LABELS: Record<string, string> = {
  S1: 'Semestre 1', S2: 'Semestre 2', T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
}

// ─── Types internes pour le calcul du bulletin ────────────────────────────────

export type BulletinCoursLine = {
  coursName: string
  evalKind: string | null
  score: number | null      // note de l'élève (scored)
  maxScore: number | null
  coefficient: number
  comment: string | null
  isAbsent: boolean
  diagnosticLabel: string | null  // pour diagnostic
  starsScore: number | null       // pour stars
}

export type BulletinUEBlock = {
  ueName: string
  moduleName: string | null
  lines: BulletinCoursLine[]
  studentAvg: number | null
  classAvg: number | null
  classMin: number | null
  classMax: number | null
}

export type BulletinData = {
  student: StudentRow
  className: string
  classLevel: string
  periodLabel: string
  yearLabel: string
  teacherName: string
  ueBlocks: BulletinUEBlock[]
  generalAvg: number | null
  classGeneralAvg: number | null
  classGeneralMin: number | null
  classGeneralMax: number | null
  absCount: number
  absUnjustifiedCount: number
  retardCount: number
  etablissement: EtablissementInfo
  totalStudents: number
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function BulletinsClient({
  classes, periods, evalTypeConfigs, ues, modules, cours,
  evaluations, students, grades, absences, etablissement, yearLabel,
}: Props) {

  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(classes[0]?.id ?? null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(periods[0]?.id ?? null)
  const [generating, setGenerating] = useState<string | null>(null) // student_id or 'all'

  const selectedClass = classes.find(c => c.id === selectedClassId)
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId)

  // Élèves de la classe sélectionnée
  const classStudents = useMemo(() =>
    students.filter(s => s.class_id === selectedClassId),
    [students, selectedClassId]
  )

  // Évaluations de la classe × période
  const currentEvals = useMemo(() =>
    evaluations.filter(e => e.class_id === selectedClassId && e.period_id === selectedPeriodId),
    [evaluations, selectedClassId, selectedPeriodId]
  )

  // Grades indexées par evaluation_id × student_id
  const gradeMap = useMemo(() => {
    const map = new Map<string, GradeRow>()
    for (const g of grades) {
      map.set(`${g.evaluation_id}:${g.student_id}`, g)
    }
    return map
  }, [grades])

  // Absences pour la période sélectionnée
  const periodAbsences = useMemo(() =>
    absences.filter(a => a.period_id === selectedPeriodId),
    [absences, selectedPeriodId]
  )

  // Comptage d'évaluations renseignées par élève
  const completionByStudent = useMemo(() => {
    const map = new Map<string, { filled: number; total: number }>()
    for (const s of classStudents) {
      let filled = 0
      for (const ev of currentEvals) {
        const g = gradeMap.get(`${ev.id}:${s.student_id}`)
        if (g) filled++
      }
      map.set(s.student_id, { filled, total: currentEvals.length })
    }
    return map
  }, [classStudents, currentEvals, gradeMap])

  // Toutes les notes sont-elles saisies ?
  const allComplete = useMemo(() => {
    if (classStudents.length === 0 || currentEvals.length === 0) return false
    for (const s of classStudents) {
      const comp = completionByStudent.get(s.student_id)
      if (!comp || comp.filled < comp.total) return false
    }
    return true
  }, [classStudents, currentEvals, completionByStudent])

  // Calcul des données de bulletin pour un élève
  const computeBulletinData = useCallback((student: StudentRow): BulletinData => {
    const evals = currentEvals
    const periodLabel = PERIOD_LABELS[selectedPeriod?.label ?? ''] ?? selectedPeriod?.label ?? ''
    const teacherName = selectedClass
      ? [selectedClass.main_teacher_civilite, selectedClass.main_teacher_name].filter(Boolean).join(' ')
      : ''

    // Grouper les évaluations par UE (et éventuellement module)
    const ueBlocksMap = new Map<string, BulletinUEBlock>()

    for (const ev of evals) {
      if (!ev.cours_id) continue
      const c = cours.find(cr => cr.id === ev.cours_id)
      if (!c) continue

      // Déterminer l'UE (priorité au display_ue_id)
      const ueId = ev.display_ue_id ?? c.unite_enseignement_id
      const ue = ues.find(u => u.id === ueId)

      // Déterminer le module (priorité au display_module_id)
      const modId = ev.display_module_id ?? c.module_id
      const mod = modId ? modules.find(m => m.id === modId) : null

      const blockKey = `${ueId}:${modId ?? 'none'}`

      if (!ueBlocksMap.has(blockKey)) {
        ueBlocksMap.set(blockKey, {
          ueName: ue?.nom_fr ?? 'Sans UE',
          moduleName: mod?.nom_fr ?? null,
          lines: [],
          studentAvg: null,
          classAvg: null,
          classMin: null,
          classMax: null,
        })
      }

      const block = ueBlocksMap.get(blockKey)!
      const g = gradeMap.get(`${ev.id}:${student.student_id}`)

      let diagnosticLabel: string | null = null
      if (ev.eval_kind === 'diagnostic' && g?.comment) {
        // Trouver le config pour extraire le label
        const config = evalTypeConfigs.find(c => c.eval_type === 'diagnostic' && c.is_active)
        const opt = (config?.diagnostic_options ?? []).map(parseDiagnosticOption).find(o => o.acronym === g.comment)
        diagnosticLabel = opt ? `${opt.acronym} - ${opt.comment}` : g.comment
      }

      block.lines.push({
        coursName: c.nom_fr,
        evalKind: ev.eval_kind,
        score: g?.score ?? null,
        maxScore: ev.max_score,
        coefficient: ev.coefficient,
        comment: ev.eval_kind !== 'diagnostic' ? (g?.comment ?? null) : null,
        isAbsent: g?.is_absent ?? false,
        diagnosticLabel,
        starsScore: ev.eval_kind === 'stars' ? (g?.score ?? null) : null,
      })
    }

    // Calculer les moyennes par bloc UE
    const ueBlocks = Array.from(ueBlocksMap.values())

    // Ordonner par order_index de l'UE
    ueBlocks.sort((a, b) => {
      const ueA = ues.find(u => u.nom_fr === a.ueName)
      const ueB = ues.find(u => u.nom_fr === b.ueName)
      return (ueA?.order_index ?? 99) - (ueB?.order_index ?? 99)
    })

    for (const block of ueBlocks) {
      // Moyenne de l'élève pour ce bloc (scored uniquement)
      const scoredLines = block.lines.filter(l => l.evalKind === 'scored' && l.score != null && l.maxScore)
      if (scoredLines.length > 0) {
        const totalCoeff = scoredLines.reduce((s, l) => s + l.coefficient, 0)
        if (totalCoeff > 0) {
          const weightedSum = scoredLines.reduce((s, l) => s + ((l.score! / l.maxScore!) * 20) * l.coefficient, 0)
          block.studentAvg = Math.round((weightedSum / totalCoeff) * 100) / 100
        }
      }

      // Moyenne, min, max de la classe pour ce bloc
      const classAvgs: number[] = []
      for (const st of classStudents) {
        const stScored = block.lines.map(l => {
          // Retrouver l'évaluation pour cette ligne
          const ev = evals.find(e => {
            const c2 = cours.find(cr => cr.id === e.cours_id)
            return c2?.nom_fr === l.coursName && e.eval_kind === l.evalKind && e.max_score === l.maxScore && e.coefficient === l.coefficient
          })
          if (!ev || ev.eval_kind !== 'scored') return null
          const g = gradeMap.get(`${ev.id}:${st.student_id}`)
          if (!g || g.score == null || !ev.max_score) return null
          return { score: g.score, maxScore: ev.max_score, coefficient: ev.coefficient }
        }).filter(Boolean) as { score: number; maxScore: number; coefficient: number }[]

        if (stScored.length > 0) {
          const tc = stScored.reduce((s, l) => s + l.coefficient, 0)
          if (tc > 0) {
            const ws = stScored.reduce((s, l) => s + ((l.score / l.maxScore) * 20) * l.coefficient, 0)
            classAvgs.push(ws / tc)
          }
        }
      }
      if (classAvgs.length > 0) {
        block.classAvg = Math.round((classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length) * 100) / 100
        block.classMin = Math.round(Math.min(...classAvgs) * 100) / 100
        block.classMax = Math.round(Math.max(...classAvgs) * 100) / 100
      }
    }

    // Moyenne générale de l'élève (pondérée par coefficients)
    const allScoredEvals = evals.filter(e => e.eval_kind === 'scored')
    let generalAvg: number | null = null
    {
      const validGrades = allScoredEvals.map(ev => {
        const g = gradeMap.get(`${ev.id}:${student.student_id}`)
        if (!g || g.score == null || !ev.max_score) return null
        return { score: g.score, maxScore: ev.max_score, coefficient: ev.coefficient }
      }).filter(Boolean) as { score: number; maxScore: number; coefficient: number }[]

      if (validGrades.length > 0) {
        const tc = validGrades.reduce((s, l) => s + l.coefficient, 0)
        if (tc > 0) {
          const ws = validGrades.reduce((s, l) => s + ((l.score / l.maxScore) * 20) * l.coefficient, 0)
          generalAvg = Math.round((ws / tc) * 100) / 100
        }
      }
    }

    // Moyennes générales de la classe (pour min/max/avg de classe)
    const classGeneralAvgs: number[] = []
    for (const st of classStudents) {
      const vg = allScoredEvals.map(ev => {
        const g = gradeMap.get(`${ev.id}:${st.student_id}`)
        if (!g || g.score == null || !ev.max_score) return null
        return { score: g.score, maxScore: ev.max_score, coefficient: ev.coefficient }
      }).filter(Boolean) as { score: number; maxScore: number; coefficient: number }[]

      if (vg.length > 0) {
        const tc = vg.reduce((s, l) => s + l.coefficient, 0)
        if (tc > 0) {
          const ws = vg.reduce((s, l) => s + ((l.score / l.maxScore) * 20) * l.coefficient, 0)
          classGeneralAvgs.push(ws / tc)
        }
      }
    }

    // Absences
    const studentAbsences = periodAbsences.filter(a => a.student_id === student.student_id)
    const absCount = studentAbsences.filter(a => a.absence_type === 'absence').length
    const absUnjustifiedCount = studentAbsences.filter(a => a.absence_type === 'absence' && !a.is_justified).length
    const retardCount = studentAbsences.filter(a => a.absence_type === 'retard').length

    return {
      student,
      className: selectedClass?.name ?? '',
      classLevel: selectedClass?.level ?? '',
      periodLabel,
      yearLabel: yearLabel ?? '',
      teacherName,
      ueBlocks,
      generalAvg,
      classGeneralAvg: classGeneralAvgs.length > 0 ? Math.round((classGeneralAvgs.reduce((a, b) => a + b, 0) / classGeneralAvgs.length) * 100) / 100 : null,
      classGeneralMin: classGeneralAvgs.length > 0 ? Math.round(Math.min(...classGeneralAvgs) * 100) / 100 : null,
      classGeneralMax: classGeneralAvgs.length > 0 ? Math.round(Math.max(...classGeneralAvgs) * 100) / 100 : null,
      absCount,
      absUnjustifiedCount,
      retardCount,
      etablissement,
      totalStudents: classStudents.length,
    }
  }, [currentEvals, selectedPeriod, selectedClass, cours, ues, modules, evalTypeConfigs, gradeMap, classStudents, periodAbsences, etablissement, yearLabel])

  // Télécharger un bulletin individuel
  const handleDownloadOne = useCallback(async (student: StudentRow) => {
    setGenerating(student.student_id)
    try {
      const data = computeBulletinData(student)
      await generateBulletinPDF(data)
    } finally {
      setGenerating(null)
    }
  }, [computeBulletinData])

  // Télécharger tous les bulletins
  const handleDownloadAll = useCallback(async () => {
    setGenerating('all')
    try {
      const allData = classStudents.map(s => computeBulletinData(s))
      await generateAllBulletinsPDF(allData, selectedClass?.name ?? 'classe')
    } finally {
      setGenerating(null)
    }
  }, [classStudents, computeBulletinData, selectedClass])

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-warm-500">
        <AlertCircle className="w-12 h-12 mb-3 text-warm-300" />
        <p className="text-lg font-medium">Aucune classe disponible</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Barre de sélection ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Classe */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-secondary-600 mb-1">Classe</label>
            <select
              className="input text-sm"
              value={selectedClassId ?? ''}
              onChange={e => setSelectedClassId(e.target.value || null)}
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} – {c.level}</option>
              ))}
            </select>
          </div>

          {/* Période */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-secondary-600 mb-1">Période</label>
            <select
              className="input text-sm"
              value={selectedPeriodId ?? ''}
              onChange={e => setSelectedPeriodId(e.target.value || null)}
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>{PERIOD_LABELS[p.label] ?? p.label}</option>
              ))}
            </select>
          </div>

          {/* Bouton télécharger tout */}
          <div>
            <button
              onClick={handleDownloadAll}
              disabled={generating !== null || !allComplete}
              className="btn btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={!allComplete ? 'Toutes les notes doivent être saisies avant de pouvoir télécharger les bulletins' : ''}
            >
              {generating === 'all' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Télécharger tous les bulletins
            </button>
          </div>
        </div>

        {/* Info classe */}
        {selectedClass && (
          <div className="mt-3 flex items-center gap-4 text-xs text-warm-500">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {classStudents.length} élève{classStudents.length > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {currentEvals.length} évaluation{currentEvals.length > 1 ? 's' : ''}
            </span>
            {selectedClass.main_teacher_name && (
              <span>
                Enseignant : {[selectedClass.main_teacher_civilite, selectedClass.main_teacher_name].filter(Boolean).join(' ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Tableau des élèves ─────────────────────────────────────────────────── */}
      {currentEvals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center text-warm-500">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-warm-300" />
          <p className="font-medium">Aucune évaluation pour cette période</p>
          <p className="text-xs mt-1">Créez d'abord des gabarits et saisissez les notes</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 border-b border-warm-200">
                <th className="text-left py-2 px-4 font-semibold text-secondary-700 text-xs">#</th>
                <th className="text-left py-2 px-4 font-semibold text-secondary-700 text-xs">Élève</th>
                <th className="text-left py-2 px-4 font-semibold text-secondary-700 text-xs">N° matricule</th>
                <th className="text-center py-2 px-4 font-semibold text-secondary-700 text-xs">Complétion</th>
                <th className="text-center py-2 px-4 font-semibold text-secondary-700 text-xs">Moy. générale</th>
                <th className="text-center py-2 px-4 font-semibold text-secondary-700 text-xs">Absences</th>
                <th className="text-center py-2 px-4 font-semibold text-secondary-700 text-xs">Action</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((s, idx) => {
                const comp = completionByStudent.get(s.student_id)
                const isComplete = comp && comp.filled === comp.total && comp.total > 0
                const pct = comp && comp.total > 0 ? Math.round((comp.filled / comp.total) * 100) : 0

                // Calcul rapide de la moyenne (scored only)
                const allScored = currentEvals.filter(e => e.eval_kind === 'scored')
                const validGrades = allScored.map(ev => {
                  const g = gradeMap.get(`${ev.id}:${s.student_id}`)
                  if (!g || g.score == null || !ev.max_score) return null
                  return { score: g.score, maxScore: ev.max_score, coefficient: ev.coefficient }
                }).filter(Boolean) as { score: number; maxScore: number; coefficient: number }[]

                let avg: number | null = null
                if (validGrades.length > 0) {
                  const tc = validGrades.reduce((sum, l) => sum + l.coefficient, 0)
                  if (tc > 0) {
                    const ws = validGrades.reduce((sum, l) => sum + ((l.score / l.maxScore) * 20) * l.coefficient, 0)
                    avg = Math.round((ws / tc) * 100) / 100
                  }
                }

                // Absences rapide
                const stAbs = periodAbsences.filter(a => a.student_id === s.student_id)
                const absCount = stAbs.filter(a => a.absence_type === 'absence').length

                return (
                  <tr
                    key={s.student_id}
                    className={clsx(
                      'border-b border-warm-100 hover:bg-warm-50/50 transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-warm-50/30'
                    )}
                  >
                    <td className="py-2 px-4 text-warm-400 text-xs">{idx + 1}</td>
                    <td className="py-2 px-4 font-medium text-secondary-800">
                      {s.last_name} {s.first_name}
                    </td>
                    <td className="py-2 px-4 text-warm-500 text-xs">{s.student_number}</td>
                    <td className="py-2 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-16 h-1.5 bg-warm-200 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full',
                                pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                        <span className="text-xs text-warm-500">{comp?.filled ?? 0}/{comp?.total ?? 0}</span>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-center">
                      {avg != null ? (
                        <span className="font-semibold text-secondary-800">
                          {avg.toFixed(2)}/20
                        </span>
                      ) : (
                        <span className="text-warm-400">–</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {absCount > 0 ? (
                        <span className="text-xs text-red-600 font-medium">{absCount}</span>
                      ) : (
                        <span className="text-xs text-warm-400">0</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => handleDownloadOne(s)}
                        disabled={generating !== null || !isComplete}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!isComplete ? 'Toutes les notes de cet élève doivent être saisies' : ''}
                      >
                        {generating === s.student_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
