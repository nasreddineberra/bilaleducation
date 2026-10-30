'use client'

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { grouperParGabarit } from '@/lib/evaluations/ordre'
import {
  Eye, FileText, Users, CheckCircle2, AlertCircle, Loader2, Lock,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { UniteEnseignement, CoursModule, Cours, Period, EvalTypeConfig } from '@/types/database'
import { parseDiagnosticOption } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { lireCleAdulte } from '@/lib/parents/participant'
import type { TablesInsert } from '@/types/supabase'
import { verifierEcriture } from '@/lib/supabase/ecriture'
import { FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { ouvrirOngletPdf, fermerOngletPdf } from '@/lib/pdf/ouvrir'
import { messageErreur } from '@/lib/erreur'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string; name: string; level: string
  day_of_week: string | null
  start_time: string | null
  end_time: string | null
  main_teacher_name: string | null
  main_teacher_civilite: string | null
  cotisation_label: string | null
  is_adult: boolean
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
  file_path: string; archived_at: string
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

// 1re lettre en majuscule à la frappe (même motif que le référentiel des cours).
const capFirst = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v)

const PERIOD_LABELS: Record<string, string> = {
  S1: 'Semestre 1', S2: 'Semestre 2', T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
}

// Action de ligne (icone seule) : vert de marque, survol teinte, focus visible.
const ACTION_LIGNE = 'inline-flex items-center p-1 rounded text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:bg-[var(--brand-tint)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]'

const DAYS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

// ─── Types internes pour le calcul du bulletin ────────────────────────────────

export type BulletinCoursLine = {
  coursName: string
  coursNameAr: string | null
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
  ueNameAr: string | null
  moduleName: string | null
  moduleNameAr: string | null
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
  isAdult: boolean
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function BulletinsClient({
  classes, periods, evalTypeConfigs, ues, modules, cours,
  evaluations, students, grades, absences, etablissement, yearLabel,
  etablissementId, initialArchives, initialAppreciations, orderConfigs,
}: Props) {

  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(classes.length === 1 ? classes[0].id : null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>((periods.find(p => p.is_current) ?? periods[0])?.id ?? null)
  const [generating, setGenerating] = useState<string | null>(null) // student_id or 'all'
  const [archives, setArchives] = useState<ArchiveRow[]>(initialArchives)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [appreciations, setAppreciations] = useState<AppreciationRow[]>(initialAppreciations)
  const [savingAppreciation, setSavingAppreciation] = useState<string | null>(null)
  const [appreciationError, setAppreciationError] = useState<string | null>(null)
  const [confirmUnarchive, setConfirmUnarchive] = useState(false)

  const selectedClass = classes.find(c => c.id === selectedClassId)
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
  const isAdultClass = selectedClass?.is_adult ?? false

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

  // Map student_id -> archive file_path (bucket privé → URL signée à la demande)
  const archivePathMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of currentArchives) map.set(a.student_id, a.file_path)
    return map
  }, [currentArchives])

  // Ouvre un bulletin archivé via une URL signée (bucket privé). L'onglet est
  // ouvert AVANT l'await (sinon bloqué comme popup), puis redirigé.
  const handleViewArchive = useCallback(async (studentId: string) => {
    const path = archivePathMap.get(studentId)
    if (!path) return
    const w = window.open('', '_blank')
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('bulletins').createSignedUrl(path, 60)
    if (error || !data?.signedUrl) { w?.close(); setArchiveError('Impossible d’ouvrir le bulletin archivé.'); return }
    if (w) w.location.href = data.signedUrl
    else window.open(data.signedUrl, '_blank')
  }, [archivePathMap])

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

  // Lookup rapide cours par id (évite les cours.find en boucle de calcul)
  const coursById = useMemo(() => new Map(cours.map(c => [c.id, c])), [cours])

  // Calcul des données de bulletin pour un élève
  const computeBulletinData = useCallback((student: StudentRow): BulletinData => {
    const evals = currentEvals
    const periodLabel = PERIOD_LABELS[selectedPeriod?.label ?? ''] ?? selectedPeriod?.label ?? ''
    const teacherName = selectedClass
      ? [selectedClass.main_teacher_civilite, selectedClass.main_teacher_name].filter(Boolean).join(' ')
      : ''

    // Dans un bloc, les évaluations suivent l'ordre du gabarit (sort_order).
    const sortedEvals = [...evals]
      .filter(ev => ev.cours_id && coursById.has(ev.cours_id))
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))

    // Blocs UE / module dans l'ORDRE DE L'ENSEIGNANT (Gabarits), le même que la
    // Saisie des notes. Une UE n'est plus jamais coupée en deux blocs.
    const orderConfig = orderConfigs.find(c => c.class_id === selectedClassId && c.period_id === selectedPeriodId)
    const placees = grouperParGabarit(sortedEvals, ues, coursById, orderConfig)
      .flatMap(g => g.evals.map(ev => ({ ev, ueId: g.ueId, modId: g.modId })))

    const ueBlocksMap = new Map<string, BulletinUEBlock>()
    // Évaluations rattachées à chaque bloc (par clé) — pour un calcul de stats
    // robuste basé sur ev.id (et non sur un matching fragile par nom de cours).
    const blockEvals = new Map<string, EvaluationRow[]>()

    for (const { ev, ueId, modId } of placees) {
      const c = coursById.get(ev.cours_id!)!
      const ue = ues.find(u => u.id === ueId)
      const mod = modId ? modules.find(m => m.id === modId) : null

      const blockKey = `${ueId}:${modId ?? 'none'}`

      if (!ueBlocksMap.has(blockKey)) {
        ueBlocksMap.set(blockKey, {
          ueName: ue?.nom_fr ?? 'Sans UE',
          ueNameAr: ue?.nom_ar ?? null,
          moduleName: mod?.nom_fr ?? null,
          moduleNameAr: mod?.nom_ar ?? null,
          lines: [],
          studentAvg: null,
          classAvg: null,
          classMin: null,
          classMax: null,
        })
      }

      const block = ueBlocksMap.get(blockKey)!
      if (!blockEvals.has(blockKey)) blockEvals.set(blockKey, [])
      blockEvals.get(blockKey)!.push(ev)
      const g = gradeMap.get(`${ev.id}:${student.student_id}`)

      let diagnosticLabel: string | null = null
      if (ev.eval_kind === 'diagnostic' && g?.comment) {
        diagnosticLabel = g.comment // acronyme seul (ex. AC, EC, NA)
      }

      block.lines.push({
        coursName: c.nom_fr,
        coursNameAr: c.nom_ar ?? null,
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

    // La Map préserve l'ordre d'insertion, donc celui des groupes.
    const ueBlocks = Array.from(ueBlocksMap.values())

    // Moyenne pondérée (sur 20) d'un élève pour un ensemble d'évaluations notées.
    const weightedAvg = (studentId: string, scoredEvals: EvaluationRow[]): number | null => {
      const graded = scoredEvals.map(ev => {
        const g = gradeMap.get(`${ev.id}:${studentId}`)
        if (!g || g.score == null || !ev.max_score) return null
        return { score: g.score, maxScore: ev.max_score, coefficient: ev.coefficient }
      }).filter(Boolean) as { score: number; maxScore: number; coefficient: number }[]
      if (graded.length === 0) return null
      const tc = graded.reduce((s, l) => s + l.coefficient, 0)
      if (tc <= 0) return null
      const ws = graded.reduce((s, l) => s + ((l.score / l.maxScore) * 20) * l.coefficient, 0)
      return ws / tc
    }

    for (const [blockKey, block] of ueBlocksMap) {
      const scoredEvals = (blockEvals.get(blockKey) ?? []).filter(e => e.eval_kind === 'scored')
      if (scoredEvals.length === 0) continue

      // Moyenne de l'élève pour ce bloc
      const studentBlockAvg = weightedAvg(student.student_id, scoredEvals)
      if (studentBlockAvg !== null) block.studentAvg = Math.round(studentBlockAvg * 100) / 100

      // Moyenne, min, max de la classe pour ce bloc (rattachement par ev.id)
      const classAvgs: number[] = []
      for (const st of classStudents) {
        const a = weightedAvg(st.student_id, scoredEvals)
        if (a !== null) classAvgs.push(a)
      }
      if (classAvgs.length > 0) {
        block.classAvg = Math.round((classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length) * 100) / 100
        block.classMin = Math.round(Math.min(...classAvgs) * 100) / 100
        block.classMax = Math.round(Math.max(...classAvgs) * 100) / 100
      }
    }

    // Moyenne générale de l'élève (pondérée par coefficients)
    const allScoredEvals = evals.filter(e => e.eval_kind === 'scored')
    const studentGeneral = weightedAvg(student.student_id, allScoredEvals)
    const generalAvg = studentGeneral !== null ? Math.round(studentGeneral * 100) / 100 : null

    // Moyennes générales de la classe (pour min/max/avg de classe)
    const classGeneralAvgs: number[] = []
    for (const st of classStudents) {
      const a = weightedAvg(st.student_id, allScoredEvals)
      if (a !== null) classGeneralAvgs.push(a)
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
      isAdult: selectedClass?.is_adult ?? false,
    }
  }, [currentEvals, selectedPeriod, selectedClass, selectedClassId, selectedPeriodId, orderConfigs, coursById, ues, modules, evalTypeConfigs, gradeMap, classStudents, periodAbsences, etablissement, yearLabel, appreciationMap])

  // Voir un bulletin individuel (nouvel onglet, ouvert AU CLIC)
  const handleDownloadOne = useCallback(async (student: StudentRow) => {
    setGenerating(student.student_id)
    const onglet = ouvrirOngletPdf()
    try {
      const { generateBulletinPDF } = await import('./bulletinPdf')
      const data = computeBulletinData(student)
      await generateBulletinPDF(data, onglet)
    } catch (e) {
      fermerOngletPdf(onglet)
      throw e
    } finally {
      setGenerating(null)
    }
  }, [computeBulletinData])

  // Voir tous les bulletins (nouvel onglet, ouvert AU CLIC)
  const handleDownloadAll = useCallback(async () => {
    setGenerating('all')
    const onglet = ouvrirOngletPdf()
    try {
      const { generateAllBulletinsPDF } = await import('./bulletinPdf')
      const allData = classStudents.map(s => computeBulletinData(s))
      await generateAllBulletinsPDF(allData, selectedClass?.name ?? 'classe', onglet)
    } catch (e) {
      fermerOngletPdf(onglet)
      throw e
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
      const { generateBulletinBlob } = await import('./bulletinPdf')
      const newArchives: ArchiveRow[] = []

      for (const student of classStudents) {
        const data = computeBulletinData(student)
        const blob = await generateBulletinBlob(data)
        const filePath = isAdultClass
          ? `${etablissementId}/adultes/${yearLabel ?? 'unknown'}/${selectedPeriodId}/${student.student_id}.pdf`
          : `${etablissementId}/${yearLabel ?? 'unknown'}/${selectedPeriodId}/${student.student_id}.pdf`

        const { error: uploadError } = await supabase.storage
          .from('bulletins')
          .upload(filePath, blob, { upsert: true, contentType: 'application/pdf' })
        if (uploadError) throw uploadError

        // Bucket privé : on ne persiste plus d'URL publique, seulement le chemin
        // (URL signée générée à la consultation).
        // Les CHIFFRES DU DOCUMENT partent avec lui. Un bulletin archive est
        // publie : sa moyenne et son assiduite sont des faits, ils ne se
        // recalculent pas. C'est ce que la fiche Scolarite relira, plutot que de
        // reconstituer depuis quatre tables un resultat qui pourrait diverger.
        const chiffres = {
          moyenne_generale:     data.generalAvg,
          absences_count:       data.absCount,
          absences_unjustified: data.absUnjustifiedCount,
          retards_count:        data.retardCount,
        }

        let insertPayload: TablesInsert<'adult_bulletin_archives'> | TablesInsert<'bulletin_archives'>
        if (isAdultClass) {
          insertPayload = {
            etablissement_id: etablissementId,
            ...lireCleAdulte(student.student_id),
            class_id: selectedClassId, period_id: selectedPeriodId,
            file_path: filePath,
            ...chiffres,
          }
        } else {
          insertPayload = {
            etablissement_id: etablissementId, student_id: student.student_id,
            class_id: selectedClassId, period_id: selectedPeriodId,
            file_path: filePath,
            ...chiffres,
          }
        }

        const { data: row, error: insertError } = await supabase
          .from(isAdultClass ? 'adult_bulletin_archives' : 'bulletin_archives')
          .insert(insertPayload)
          // Colonnes communes aux deux tables : la cle du participant est deja connue.
          .select('id, class_id, period_id, file_path, archived_at')
          .single()
        if (insertError) throw insertError
        if (row) newArchives.push({ ...row, student_id: student.student_id })
      }

      setArchives(prev => [...prev, ...newArchives])
    } catch (err: unknown) {
      setArchiveError(messageErreur(err) ?? "Erreur lors de l'archivage")
    } finally {
      setArchiving(false)
    }
  }, [selectedClassId, selectedPeriodId, allComplete, classStudents, computeBulletinData, etablissementId, yearLabel, isAdultClass])

  // Désarchiver
  const handleUnarchive = useCallback(async () => {
    if (currentArchives.length === 0) return
    setArchiving(true)
    setArchiveError(null)
    try {
      const supabase = createClient()

      // LA LIGNE D'ABORD, LE FICHIER ENSUITE. L'ordre inverse detruisait le PDF
      // avant de savoir si la ligne pouvait partir : une suppression ecartee par
      // la RLS ne leve RIEN, donc on se retrouvait avec une archive pointant vers
      // un fichier inexistant — et un bulletin archive est un document REMIS AUX
      // FAMILLES, la perte est sans retour.
      const ids = currentArchives.map(a => a.id)
      const resultat = await supabase
        .from(isAdultClass ? 'adult_bulletin_archives' : 'bulletin_archives')
        .delete()
        .in('id', ids)
        .select('id')
      verifierEcriture(resultat, 'Ce desarchivage')

      // Les fichiers ne partent qu'une fois les lignes effectivement supprimees.
      const filePaths = currentArchives.map(a => a.file_path).filter(Boolean)
      if (filePaths.length > 0) {
        await supabase.storage.from('bulletins').remove(filePaths)
      }

      setArchives(prev => prev.filter(a => !ids.includes(a.id)))
    } catch (err: unknown) {
      setArchiveError(messageErreur(err) ?? 'Erreur lors de la désarchivation')
    } finally {
      setArchiving(false)
    }
  }, [currentArchives, isAdultClass])

  // Sauvegarder une appréciation
  const handleSaveAppreciation = useCallback(async (studentId: string, text: string) => {
    if (!selectedClassId || !selectedPeriodId) return
    setSavingAppreciation(studentId)
    setAppreciationError(null)
    try {
      const supabase = createClient()

      // Texte vide : on SUPPRIME la ligne au lieu d'en garder une vide. Une ligne
      // vide ne dit rien mais bloque quand meme le retrait de l'eleve de sa classe.
      // Zero ligne touchee est normal (rien n'avait ete saisi), seule l'erreur compte.
      if (text.trim() === '') {
        let suppression = supabase
          .from(isAdultClass ? 'adult_bulletin_appreciations' : 'bulletin_appreciations')
          .delete()
          .eq('class_id', selectedClassId)
          .eq('period_id', selectedPeriodId)
        if (isAdultClass) {
          const { parent_id, tutor_number } = lireCleAdulte(studentId)
          suppression = suppression
            .eq('parent_id', parent_id)
            .eq('tutor_number', tutor_number)
        } else {
          suppression = suppression.eq('student_id', studentId)
        }
        const { error: errSuppr } = await suppression
        if (errSuppr) throw errSuppr
        setAppreciations(prev => prev.filter(a => !(a.student_id === studentId && a.class_id === selectedClassId && a.period_id === selectedPeriodId)))
        return
      }

      let payload: TablesInsert<'adult_bulletin_appreciations'> | TablesInsert<'bulletin_appreciations'>
      let conflict: string
      if (isAdultClass) {
        payload = {
          etablissement_id: etablissementId,
          ...lireCleAdulte(studentId),
          class_id: selectedClassId, period_id: selectedPeriodId, appreciation: text,
        }
        conflict = 'parent_id,tutor_number,class_id,period_id'
      } else {
        payload = {
          etablissement_id: etablissementId, student_id: studentId,
          class_id: selectedClassId, period_id: selectedPeriodId, appreciation: text,
        }
        conflict = 'student_id,class_id,period_id'
      }
      const { data, error } = await supabase
        .from(isAdultClass ? 'adult_bulletin_appreciations' : 'bulletin_appreciations')
        .upsert(payload, { onConflict: conflict })
        // Colonnes communes aux deux tables : la cle du participant est deja connue.
        .select('id, class_id, period_id, appreciation')
        .single()
      if (error) throw error
      if (data) {
        const row: AppreciationRow = { ...data, student_id: studentId }
        setAppreciations(prev => {
          const filtered = prev.filter(a => !(a.student_id === studentId && a.class_id === selectedClassId && a.period_id === selectedPeriodId))
          return [...filtered, row]
        })
      }
    } catch (err: unknown) {
      console.error('Erreur sauvegarde appréciation:', messageErreur(err))
      setAppreciationError("Erreur lors de l'enregistrement de l'appréciation.")
    } finally {
      setSavingAppreciation(null)
    }
  }, [selectedClassId, selectedPeriodId, etablissementId, isAdultClass])

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-warm-700">
        <AlertCircle className="w-12 h-12 mb-3 text-warm-700" />
        <p className="text-lg font-medium">Aucune classe disponible</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* ── Barre de sélection ─────────────────────────────────────────────────── */}
      <div className="card p-3 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          {/* Classe */}
          <FloatSelect
            label="Classe"
            value={selectedClassId ?? ''}
            onChange={e => { setSelectedClassId(e.target.value || null); setConfirmUnarchive(false) }}
            wrapperClassName="w-fit"
          >
            <option value=""></option>
            {classes.map(c => {
              const teacher = c.main_teacher_civilite && c.main_teacher_name
                ? `${c.main_teacher_civilite} ${c.main_teacher_name}`
                : c.main_teacher_name
              const infoParts = [teacher, c.cotisation_label].filter(Boolean)
              return (
                <option key={c.id} value={c.id}>
                  {[c.name, ...infoParts].join(' · ')}
                </option>
              )
            })}
          </FloatSelect>

          {/* Périodes */}
          {periods.length > 0 && (
            <FiltreSwitch
              ariaLabel="Période"
              actif={selectedPeriodId ?? ''}
              onChange={v => { setSelectedPeriodId(v); setConfirmUnarchive(false) }}
              options={periods.map(p => ({ valeur: p.id, libelle: PERIOD_LABELS[p.label] ?? p.label }))}
            />
          )}

          {/* Actions : voir tous les bulletins, archiver / désarchiver */}
          <div className="ml-auto flex items-center gap-2">
            {(() => {
              const hint = isArchived
                ? 'Bulletins déjà archivés'
                : !allComplete
                ? 'Toutes les notes doivent être saisies'
                : ''
              const btn = (
                <FloatButton
                  variant="secondary"
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={generating !== null || !allComplete || isArchived}
                  loading={generating === 'all'}
                >
                  Voir tous les bulletins
                </FloatButton>
              )
              return hint ? <Tooltip content={hint}>{btn}</Tooltip> : btn
            })()}
            {selectedClass && (isArchived ? (
              <FloatButton variant="secondary" type="button" onClick={() => setConfirmUnarchive(true)} disabled={archiving} loading={archiving}>
                Désarchiver
              </FloatButton>
            ) : (() => {
              const btn = (
                <FloatButton
                  variant="submit"
                  type="button"
                  onClick={handleArchive}
                  disabled={archiving || !allComplete}
                  loading={archiving}
                >
                  Archiver
                </FloatButton>
              )
              return allComplete ? btn : <Tooltip content="Toutes les notes doivent être saisies">{btn}</Tooltip>
            })())}
          </div>
        </div>

        {/* Info classe */}
        {selectedClass && (
          <div className="mt-3 flex items-center">
            <div className="flex items-center gap-4 text-xs text-warm-700">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {classStudents.length} {isAdultClass ? 'participant' : 'élève'}{classStudents.length > 1 ? 's' : ''}
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
                  ? `${day} ${selectedClass.start_time.slice(0, 5)}${selectedClass.end_time ? `-${selectedClass.end_time.slice(0, 5)}` : ''}`
                  : day
                const parts = [
                  teacherName,
                  selectedClass.cotisation_label,
                  selectedClass.level ? `Niveau ${selectedClass.level}` : null,
                  schedule,
                ].filter(Boolean)
                // Un seul span joint (le gap-4 du conteneur + le mx-1 du · doublaient l'espacement).
                return <span>{parts.join(' · ')}</span>
              })()}
            </div>
          </div>
        )}

        {archiveError && (
          <div role="alert" className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {archiveError}
          </div>
        )}

        {appreciationError && (
          <div role="alert" className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {appreciationError}
          </div>
        )}
      </div>

      {/* Verrou d'archivage : même bandeau que Gabarits et Saisie des notes. */}
      {isArchived && (
        <div className="ton-info flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0">
          <Lock size={13} className="flex-shrink-0" />
          Bulletins archivés le {new Date(currentArchives[0]?.archived_at).toLocaleDateString('fr-FR')}. Notes et appréciations verrouillées.
        </div>
      )}

      {/* ── Tableau des élèves ─────────────────────────────────────────────────── */}
      {/* Deux situations distinctes : pas encore de classe choisie (la période, elle,
          est présélectionnée sur l'année en cours) vs classe choisie mais vide. */}
      {!selectedClassId ? (
        <div className="card text-center text-sm text-warm-700 py-10">Sélectionnez une classe.</div>
      ) : currentEvals.length === 0 ? (
        <div className="card text-center text-sm text-warm-700 py-10">Aucune évaluation pour cette période.</div>
      ) : (
        <div className="liste list-scroll flex-1 min-h-0 overflow-y-auto">
          <table aria-label="Bulletins des élèves" className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="liste-entete border-b border-[var(--card-border)]">
                <th className="text-left list-th">#</th>
                <th className="text-left list-th">{isAdultClass ? 'Participant' : 'Élève'}</th>
                <th className="text-left list-th">N° matricule</th>
                <th className="text-center list-th">Complétion</th>
                <th className="text-center list-th">Moy. générale</th>
                <th className="text-center list-th">Absences</th>
                <th className="text-left list-th min-w-[160px]">Appréciation</th>
                <th className="text-center list-th">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
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
                  <tr key={s.student_id}>
                    <td className="list-td text-warm-700 tabular-nums">{idx + 1}</td>
                    <td className="list-td whitespace-nowrap">
                      <span className="list-name text-secondary-800">{s.last_name} {s.first_name}</span>
                    </td>
                    <td className="list-td text-warm-700 font-mono">{s.student_number}</td>
                    <td className="list-td text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--brand-surface)] dark:text-[var(--brand-accent)]" />
                        ) : (
                          <div className="w-16 h-1.5 bg-warm-200 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full',
                                pct >= 80 ? 'bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)]' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                        <span className="text-warm-700 tabular-nums">{comp?.filled ?? 0}/{comp?.total ?? 0}</span>
                      </div>
                    </td>
                    <td className="list-td text-center tabular-nums">
                      {avg != null ? (
                        <span className="font-semibold text-secondary-800">
                          {avg.toFixed(2)}/20
                        </span>
                      ) : (
                        <span className="text-warm-700">·</span>
                      )}
                    </td>
                    <td className="list-td text-center tabular-nums">
                      {absCount > 0 ? (
                        <span className="text-red-700 font-medium">{absCount}</span>
                      ) : (
                        <span className="text-warm-700">0</span>
                      )}
                    </td>
                    <td className="list-td">
                      <AppreciationCell
                        studentId={s.student_id}
                        value={appreciationMap.get(s.student_id) ?? ''}
                        onSave={handleSaveAppreciation}
                        saving={savingAppreciation === s.student_id}
                        disabled={isArchived || !isComplete}
                      />
                    </td>
                    <td className="list-td text-center">
                      {isArchived ? (
                        archivePathMap.has(s.student_id) ? (
                          <Tooltip content="Voir le bulletin archivé">
                            <button
                              type="button"
                              onClick={() => handleViewArchive(s.student_id)}
                              aria-label={`Voir le bulletin archivé de ${s.last_name} ${s.first_name}`}
                              className={ACTION_LIGNE}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        ) : (
                          <span className="text-warm-700">·</span>
                        )
                      ) : (
                        <Tooltip content={!isComplete ? 'Toutes les notes de cet élève doivent être saisies' : 'Voir le bulletin (nouvel onglet)'}>
                          <button
                            onClick={() => handleDownloadOne(s)}
                            disabled={generating !== null || !isComplete}
                            aria-label={`Voir le bulletin de ${s.last_name} ${s.first_name}`}
                            className={clsx(ACTION_LIGNE, 'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none')}
                          >
                            {generating === s.student_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </button>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmUnarchive && (
        <ConfirmModal
          open
          variant="danger"
          confirmColor="red"
          title="Désarchiver les bulletins"
          message="Cette action supprime définitivement les PDF archivés et leurs enregistrements. Les notes redeviennent modifiables. Continuer ?"
          confirmLabel="Désarchiver"
          cancelLabel="Annuler"
          confirmDisabled={archiving}
          onConfirm={async () => { await handleUnarchive(); setConfirmUnarchive(false) }}
          onCancel={() => setConfirmUnarchive(false)}
        />
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
      ? <span className="text-xs text-warm-700 line-clamp-1">{value}</span>
      : <span className="text-xs text-warm-700">-</span>
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-1 text-xs text-warm-700 hover:text-[var(--brand-surface)] dark:hover:text-[var(--brand-accent)] transition-colors w-full text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
        aria-label={value ? 'Modifier l\'appréciation' : 'Ajouter une appréciation'}
      >
        {value ? (
          <span className="line-clamp-1">{value}</span>
        ) : (
          <span className="italic">Ajouter</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(capFirst(e.target.value))}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() } if (e.key === 'Escape') { setText(value); setEditing(false) } }}
        rows={2}
        aria-label="Appréciation de l'élève"
        className="input text-xs py-1 px-1.5 resize-none w-full min-w-[140px]"
        placeholder="Appréciation…"
      />
      <div role="group" aria-label="Enregistrer ou annuler l'appréciation" className="flex items-center gap-1">
        <FloatButton
          variant="submit"
          size="mini"
          type="button"
          onClick={handleSave}
          loading={saving}
          aria-label="Enregistrer l'appréciation"
        >
          Enregistrer
        </FloatButton>
        <FloatButton
          variant="secondary"
          size="mini"
          type="button"
          onClick={() => { setText(value); setEditing(false) }}
          aria-label="Annuler la modification de l'appréciation"
        >
          Annuler
        </FloatButton>
      </div>
    </div>
  )
}
