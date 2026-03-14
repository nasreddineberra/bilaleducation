'use client'

import React, { useState, useMemo, useCallback, useRef } from 'react'
import {
  Download, FileText, Users, CheckCircle2, AlertCircle, Loader2, MessageSquare,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { UniteEnseignement, CoursModule, Cours, Period, EvalTypeConfig } from '@/types/database'
import { parseDiagnosticOption } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { generateBulletinPDF, generateAllBulletinsPDF, generateBulletinBlob } from './bulletinPdf'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string; name: string; level: string
  day_of_week: string | null
  start_time: string | null
  end_time: string | null
  main_teacher_name: string | null
  main_teacher_civilite: string | null
  cotisation_label: string | null
}

type EvaluationRow = {
  id: string; class_id: string; period_id: string | null; cours_id: string | null
  eval_kind: string | null; max_score: number | null; coefficient: number
  evaluation_date: string | null; display_module_id: string | null; display_ue_id: string | null
  sort_order: number | null
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

type ArchiveRow = {
  id: string; student_id: string; class_id: string; period_id: string
  file_url: string; archived_at: string
}

type AppreciationRow = {
  id: string; student_id: string; class_id: string; period_id: string
  appreciation: string
}

type OrderConfigRow = {
  class_id: string; period_id: string
  ue_order: string[]; module_order: Record<string, string[]>
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
  etablissementId: string
  initialArchives: ArchiveRow[]
  initialAppreciations: AppreciationRow[]
  orderConfigs: OrderConfigRow[]
}

const PERIOD_LABELS: Record<string, string> = {
  S1: 'Semestre 1', S2: 'Semestre 2', T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
}

const DAYS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
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
  diagnosticLegend: string | null
  classSchedule: string | null
  cotisationLabel: string | null
  appreciation: string | null
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function BulletinsClient({
  classes, periods, evalTypeConfigs, ues, modules, cours,
  evaluations, students, grades, absences, etablissement, yearLabel,
  etablissementId, initialArchives, initialAppreciations, orderConfigs,
}: Props) {

  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(classes.length === 1 ? classes[0].id : null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(periods[0]?.id ?? null)
  const [generating, setGenerating] = useState<string | null>(null) // student_id or 'all'
  const [archives, setArchives] = useState<ArchiveRow[]>(initialArchives)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [appreciations, setAppreciations] = useState<AppreciationRow[]>(initialAppreciations)
  const [savingAppreciation, setSavingAppreciation] = useState<string | null>(null)
  const [confirmUnarchive, setConfirmUnarchive] = useState(false)

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

  // Archives pour la classe+période sélectionnée
  const currentArchives = useMemo(() =>
    archives.filter(a => a.class_id === selectedClassId && a.period_id === selectedPeriodId),
    [archives, selectedClassId, selectedPeriodId]
  )
  const isArchived = currentArchives.length > 0

  // Map student_id -> archive file_url
  const archiveUrlMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of currentArchives) map.set(a.student_id, a.file_url)
    return map
  }, [currentArchives])

  // Appréciations pour la classe+période sélectionnée
  const appreciationMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of appreciations) {
      if (a.class_id === selectedClassId && a.period_id === selectedPeriodId) {
        map.set(a.student_id, a.appreciation)
      }
    }
    return map
  }, [appreciations, selectedClassId, selectedPeriodId])

  // Calcul des données de bulletin pour un élève
  const computeBulletinData = useCallback((student: StudentRow): BulletinData => {
    const evals = currentEvals
    const periodLabel = PERIOD_LABELS[selectedPeriod?.label ?? ''] ?? selectedPeriod?.label ?? ''
    const teacherName = selectedClass
      ? [selectedClass.main_teacher_civilite, selectedClass.main_teacher_name].filter(Boolean).join(' ')
      : ''

    // Trier les évaluations par sort_order (gabarit) avant groupement
    const sortedEvals = [...evals].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))

    // Grouper les évaluations par UE (et éventuellement module)
    const ueBlocksMap = new Map<string, BulletinUEBlock>()

    for (const ev of sortedEvals) {
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
        diagnosticLabel = g.comment // acronyme seul (ex. AC, EC, NA)
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

    // Les blocs sont déjà dans l'ordre du gabarit grâce au tri par sort_order
    // (la Map préserve l'ordre d'insertion)
    const ueBlocks = Array.from(ueBlocksMap.values())

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

    // Légende diagnostique (si au moins une évaluation diagnostique)
    let diagnosticLegend: string | null = null
    const hasDiag = evals.some(e => e.eval_kind === 'diagnostic')
    if (hasDiag) {
      const config = evalTypeConfigs.find(c => c.eval_type === 'diagnostic' && c.is_active)
      const opts = (config?.diagnostic_options ?? []).map(parseDiagnosticOption).filter(o => o.comment)
      if (opts.length > 0) {
        diagnosticLegend = opts.map(o => `${o.acronym} : ${o.comment}`).join(' - ')
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
      diagnosticLegend,
      classSchedule: selectedClass?.day_of_week && selectedClass?.start_time
        ? `${DAYS[selectedClass.day_of_week] ?? selectedClass.day_of_week}${selectedClass.end_time ? ` de ${selectedClass.start_time.slice(0, 5)} à ${selectedClass.end_time.slice(0, 5)}` : ` à ${selectedClass.start_time.slice(0, 5)}`}`
        : null,
      cotisationLabel: selectedClass?.cotisation_label ?? null,
      appreciation: appreciationMap.get(student.student_id) || null,
    }
  }, [currentEvals, selectedPeriod, selectedClass, cours, ues, modules, evalTypeConfigs, gradeMap, classStudents, periodAbsences, etablissement, yearLabel, appreciationMap])

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

  // Archiver tous les bulletins
  const handleArchive = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId || !allComplete) return
    setArchiving(true)
    setArchiveError(null)
    try {
      const supabase = createClient()
      const newArchives: ArchiveRow[] = []

      for (const student of classStudents) {
        const data = computeBulletinData(student)
        const blob = await generateBulletinBlob(data)
        const filePath = `${etablissementId}/${yearLabel ?? 'unknown'}/${selectedPeriodId}/${student.student_id}.pdf`

        const { error: uploadError } = await supabase.storage
          .from('bulletins')
          .upload(filePath, blob, { upsert: true, contentType: 'application/pdf' })
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('bulletins').getPublicUrl(filePath)

        const { data: row, error: insertError } = await supabase
          .from('bulletin_archives')
          .insert({
            etablissement_id: etablissementId,
            student_id: student.student_id,
            class_id: selectedClassId,
            period_id: selectedPeriodId,
            file_path: filePath,
            file_url: publicUrl,
          })
          .select('id, student_id, class_id, period_id, file_url, archived_at')
          .single()
        if (insertError) throw insertError
        if (row) newArchives.push(row as ArchiveRow)
      }

      setArchives(prev => [...prev, ...newArchives])
    } catch (err: any) {
      setArchiveError(err?.message ?? "Erreur lors de l'archivage")
    } finally {
      setArchiving(false)
    }
  }, [selectedClassId, selectedPeriodId, allComplete, classStudents, computeBulletinData, etablissementId, yearLabel])

  // Désarchiver
  const handleUnarchive = useCallback(async () => {
    if (currentArchives.length === 0) return
    setArchiving(true)
    setArchiveError(null)
    try {
      const supabase = createClient()

      // Supprimer les fichiers du storage
      const filePaths = currentArchives.map(a => {
        // Extraire le path depuis l'URL
        const url = new URL(a.file_url)
        const parts = url.pathname.split('/bulletins/')
        return parts.length > 1 ? parts[1] : ''
      }).filter(Boolean)

      if (filePaths.length > 0) {
        await supabase.storage.from('bulletins').remove(filePaths)
      }

      // Supprimer les lignes en DB
      const ids = currentArchives.map(a => a.id)
      const { error } = await supabase
        .from('bulletin_archives')
        .delete()
        .in('id', ids)
      if (error) throw error

      setArchives(prev => prev.filter(a => !ids.includes(a.id)))
    } catch (err: any) {
      setArchiveError(err?.message ?? 'Erreur lors de la désarchivation')
    } finally {
      setArchiving(false)
    }
  }, [currentArchives])

  // Sauvegarder une appréciation
  const handleSaveAppreciation = useCallback(async (studentId: string, text: string) => {
    if (!selectedClassId || !selectedPeriodId) return
    setSavingAppreciation(studentId)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bulletin_appreciations')
        .upsert({
          etablissement_id: etablissementId,
          student_id: studentId,
          class_id: selectedClassId,
          period_id: selectedPeriodId,
          appreciation: text,
        }, { onConflict: 'student_id,class_id,period_id' })
        .select('id, student_id, class_id, period_id, appreciation')
        .single()
      if (error) throw error
      if (data) {
        setAppreciations(prev => {
          const filtered = prev.filter(a => !(a.student_id === studentId && a.class_id === selectedClassId && a.period_id === selectedPeriodId))
          return [...filtered, data as AppreciationRow]
        })
      }
    } catch (err: any) {
      console.error('Erreur sauvegarde appréciation:', err?.message)
    } finally {
      setSavingAppreciation(null)
    }
  }, [selectedClassId, selectedPeriodId, etablissementId])

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
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-4">
          {/* Classe */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide whitespace-nowrap">Classe</span>
            <select
              className="input text-sm py-1.5"
              value={selectedClassId ?? ''}
              onChange={e => { setSelectedClassId(e.target.value || null); setConfirmUnarchive(false) }}
              disabled={classes.length === 0}
            >
              {classes.length === 0
                ? <option value="">Aucune classe disponible</option>
                : <>
                    {classes.length > 1 && <option value="">— Selectionner une classe —</option>}
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </>
              }
            </select>
          </div>

          {/* Périodes */}
          {periods.length > 0 && (
            <div className="flex items-center gap-1">
              {periods.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPeriodId(p.id); setConfirmUnarchive(false) }}
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

          {/* Bouton télécharger tout */}
          <div className="ml-auto">
            <button
              onClick={handleDownloadAll}
              disabled={generating !== null || !allComplete || isArchived}
              className="btn btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={isArchived ? 'Bulletins déjà archivés' : !allComplete ? 'Toutes les notes doivent être saisies' : ''}
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

        {/* Info classe + boutons archivage */}
        {selectedClass && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-warm-500">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {classStudents.length} élève{classStudents.length > 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {currentEvals.length} évaluation{currentEvals.length > 1 ? 's' : ''}
              </span>
              {(() => {
                const teacherName = selectedClass.main_teacher_name
                  ? [selectedClass.main_teacher_civilite, selectedClass.main_teacher_name].filter(Boolean).join(' ')
                  : null
                const day = selectedClass.day_of_week ? (DAYS[selectedClass.day_of_week] ?? selectedClass.day_of_week) : null
                const schedule = day && selectedClass.start_time
                  ? `${day} ${selectedClass.start_time.slice(0, 5)}${selectedClass.end_time ? `–${selectedClass.end_time.slice(0, 5)}` : ''}`
                  : day
                const parts = [
                  teacherName,
                  selectedClass.cotisation_label,
                  selectedClass.level ? `Niveau ${selectedClass.level}` : null,
                  schedule,
                ].filter(Boolean)
                return parts.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-warm-300 mx-1">·</span>}
                    {p}
                  </span>
                ))
              })()}
            </div>

            <div className="flex items-center gap-2">
              {isArchived ? (
                confirmUnarchive ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-warm-500">Supprimer les bulletins archivés ?</span>
                    <button
                      onClick={async () => { await handleUnarchive(); setConfirmUnarchive(false) }}
                      disabled={archiving}
                      className="text-xs font-medium px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {archiving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Oui'}
                    </button>
                    <button
                      onClick={() => setConfirmUnarchive(false)}
                      className="btn btn-secondary text-xs py-1 px-2"
                    >
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmUnarchive(true)}
                    className="btn btn-secondary flex items-center gap-1.5 text-xs"
                  >
                    Désarchiver
                  </button>
                )
              ) : (
                <button
                  onClick={handleArchive}
                  disabled={archiving || !allComplete}
                  className="btn btn-primary flex items-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!allComplete ? 'Toutes les notes doivent être saisies' : ''}
                >
                  {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Archiver
                </button>
              )}
            </div>
          </div>
        )}

        {archiveError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {archiveError}
          </div>
        )}

        {isArchived && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            Bulletins archivés le {new Date(currentArchives[0]?.archived_at).toLocaleDateString('fr-FR')}
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
                <th className="text-left py-2 px-4 font-semibold text-secondary-700 text-xs min-w-[160px]">Appréciation</th>
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
                    <td className="py-2 px-4">
                      <AppreciationCell
                        studentId={s.student_id}
                        value={appreciationMap.get(s.student_id) ?? ''}
                        onSave={handleSaveAppreciation}
                        saving={savingAppreciation === s.student_id}
                        disabled={isArchived || !isComplete}
                      />
                    </td>
                    <td className="py-2 px-4 text-center">
                      {isArchived ? (
                        archiveUrlMap.has(s.student_id) ? (
                          <a
                            href={archiveUrlMap.get(s.student_id)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Voir
                          </a>
                        ) : (
                          <span className="text-xs text-warm-300">–</span>
                        )
                      ) : (
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
                      )}
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

// ─── Cellule d'appréciation inline ──────────────────────────────────────────

function AppreciationCell({
  studentId, value, onSave, saving, disabled,
}: {
  studentId: string
  value: string
  onSave: (studentId: string, text: string) => Promise<void>
  saving: boolean
  disabled: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Sync with prop changes
  React.useEffect(() => { setText(value) }, [value])

  const handleSave = async () => {
    if (text !== value) {
      await onSave(studentId, text)
    }
    setEditing(false)
  }

  if (disabled) {
    return value
      ? <span className="text-xs text-warm-500 line-clamp-1">{value}</span>
      : <span className="text-xs text-warm-300">–</span>
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-1 text-xs text-warm-500 hover:text-primary-600 transition-colors w-full text-left"
        title="Modifier l'appréciation"
      >
        {value ? (
          <span className="line-clamp-1">{value}</span>
        ) : (
          <span className="flex items-center gap-1 text-warm-300 italic">
            <MessageSquare className="w-3 h-3" />
            Ajouter
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() } if (e.key === 'Escape') { setText(value); setEditing(false) } }}
        rows={2}
        className="input text-xs py-1 px-1.5 resize-none w-full min-w-[140px]"
        placeholder="Appréciation…"
      />
      <div className="flex items-center gap-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[10px] font-medium px-1.5 py-0.5 bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          {saving ? '…' : 'OK'}
        </button>
        <button
          onClick={() => { setText(value); setEditing(false) }}
          className="text-[10px] font-medium px-1.5 py-0.5 bg-warm-100 text-warm-600 rounded hover:bg-warm-200 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
