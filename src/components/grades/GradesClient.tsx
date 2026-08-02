'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Check, ChevronRight, ChevronDown, ChevronLeft,
  BookOpen, AlertCircle, AlertTriangle, RotateCcw, Lock,
} from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { UniteEnseignement, CoursModule, Cours, Period, EvalTypeConfig } from '@/types/database'
import { parseDiagnosticOption } from '@/types/database'
import { FloatSelect, FloatButton, FloatCheckbox } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string; name: string; level: string
  day_of_week: string | null; start_time: string | null; end_time: string | null
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
  /** Ligne « sale » posee par l'APPLICATION (absence reportee de la feuille
   *  d'appel), pas par une saisie de l'utilisateur. */
  auto?:      boolean
}

type BulletinArchiveRow = {
  class_id: string
  period_id: string
}

// Intention de navigation (classe / période / évaluation) — soumise au garde-fou
// anti-perte de saisie quand des notes ne sont pas enregistrées.
type NavIntent =
  | { type: 'class';  value: string | null }
  | { type: 'period'; value: string }
  | { type: 'eval';   value: string | null }

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
  bulletinArchives: BulletinArchiveRow[]
  /** Absences (type « absence » seul) tombant un jour d'évaluation. */
  absenceDays:      { student_id: string; class_id: string; absence_date: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVAL_BADGE: Record<string, { label: string; cls: string }> = {
  diagnostic: { label: 'Diagnostique', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  scored:     { label: 'Notée',        cls: 'bg-primary-50 text-primary-700 border-primary-200' },
  stars:      { label: 'Étoilée',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const PERIOD_LABELS: Record<string, string> = {
  S1: 'Semestre 1', S2: 'Semestre 2', T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
}

// « 2026-03-12 » → « 12/03 ». Le T00:00 évite le décalage UTC d'un `new Date('…')`.
const fmtShortDate = (d: string | null) =>
  d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''

function getInitialScoreValue(grade: GradeRow | undefined, evalKind: string | null): string {
  if (!grade) return ''
  if (evalKind === 'diagnostic') return grade.comment ?? ''
  return grade.score != null ? String(grade.score) : ''
}


// Nom arabe : police du projet, taille RELATIVE — sans ca il retomberait sur la
// fallback systeme, et une taille fixe desequilibrerait des lignes en text-xs.
const AR_INLINE: React.CSSProperties = { fontFamily: 'var(--font-arabic), sans-serif', fontSize: '1.45em' }

/** Libelle affiche dans l'arbre : « Nom FR · Nom AR ». Rendu inline pour que la
 *  troncature du conteneur porte sur l'ensemble. */
function refLabel(item: { nom_fr?: string | null; nom_ar?: string | null } | null | undefined) {
  const fr = item?.nom_fr?.trim() ?? ''
  const ar = item?.nom_ar?.trim()
  if (!ar) return fr
  return (
    <>
      {fr}
      {fr && <span aria-hidden="true" className="mx-1 text-warm-700">·</span>}
      <span dir="rtl" className="font-normal" style={AR_INLINE}>{ar}</span>
    </>
  )
}

/** Meme libelle pour l'infobulle, mais sans troncature : c'est elle qui donne
 *  le nom complet quand la ligne est coupee. */
function refTooltip(item: { nom_fr?: string | null; nom_ar?: string | null } | null | undefined) {
  const fr = item?.nom_fr?.trim()
  const ar = item?.nom_ar?.trim()
  if (!fr && !ar) return ''
  if (!ar) return fr as string
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {fr && <span>{fr}</span>}
      {fr && <span aria-hidden="true">·</span>}
      <span dir="rtl" style={{ fontFamily: 'var(--font-arabic), sans-serif', fontSize: '15px' }}>{ar}</span>
    </span>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GradesClient({
  classes, periods, evalTypeConfigs, ues, modules, cours,
  evaluations, evalOrderConfigs, students, initialGrades,
  etablissementId, schoolYearId, teacherId, bulletinArchives, absenceDays,
}: Props) {

  // ── Sélecteurs ──────────────────────────────────────────────────────────────
  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(classes.length === 1 ? classes[0].id : null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>((periods.find(p => p.is_current) ?? periods[0])?.id ?? null)
  const [selectedEvalId,   setSelectedEvalId]   = useState<string | null>(null)
  const [expandedUEs,      setExpandedUEs]      = useState<Set<string>>(new Set(ues.map(u => u.id)))

  // ── Données ─────────────────────────────────────────────────────────────────
  const [gradesList, setGradesList] = useState<GradeRow[]>(initialGrades)
  const [pending,    setPending]    = useState<Record<string, PendingEntry>>({})
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [pendingNav,    setPendingNav]    = useState<NavIntent | null>(null)

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

  // Lookup rapide cours par id (évite les cours.find en boucle de rendu)
  const coursById = useMemo(() => new Map(cours.map(c => [c.id, c])), [cours])

  // ── Helpers UE/Module effectifs (display override > naturel) ─────────────────
  const getEffUeId = useCallback((e: EvaluationRow) =>
    e.display_ue_id ?? coursById.get(e.cours_id ?? '')?.unite_enseignement_id ?? '',
    [coursById]
  )
  const getEffModId = useCallback((e: EvaluationRow): string | null =>
    e.display_ue_id !== null
      ? e.display_module_id
      : coursById.get(e.cours_id ?? '')?.module_id ?? null,
    [coursById]
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
  const selectedCours = coursById.get(selectedEval?.cours_id ?? '') ?? null

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

  // ── Absences du jour de l'évaluation ────────────────────────────────────────
  // La feuille d'appel fait foi : un élève absent le jour J est coché « absent »
  // d'office, case et champ de note verrouillés. Ne concerne que les classes
  // élèves (les participants adultes n'ont pas d'absences) et les gabarits datés.
  const absentKeys = useMemo(
    () => new Set(absenceDays.map(a => `${a.student_id}|${a.absence_date}`)),
    [absenceDays]
  )
  const isForcedAbsent = useCallback(
    (studentId: string, evalDate: string | null | undefined) =>
      !!evalDate && absentKeys.has(`${studentId}|${evalDate}`),
    [absentKeys]
  )

  // ── Conflits appel / note ───────────────────────────────────────────────────
  // Une note enregistrée ET une absence le même jour sont incompatibles, mais on
  // ne peut pas savoir laquelle des deux saisies est fausse. On n'écrase donc
  // RIEN : la ligne est signalée et laissée modifiable, à l'utilisateur de
  // trancher (corriger l'appel, ou cocher l'absence lui-même). Sans ce garde-fou,
  // le report d'absence effacerait la note en silence.
  const hasSavedMark = useCallback((studentId: string, evalId: string | null) => {
    const g = gradesList.find(x => x.evaluation_id === evalId && x.student_id === studentId)
    return !!g && !g.is_absent && (g.score !== null || g.comment !== null)
  }, [gradesList])

  const isConflicted = useCallback(
    (studentId: string, evalId: string | null, evalDate: string | null | undefined) =>
      isForcedAbsent(studentId, evalDate) && hasSavedMark(studentId, evalId),
    [isForcedAbsent, hasSavedMark]
  )

  // ── Réinitialisation des pending lors du changement d'évaluation ─────────────
  useEffect(() => {
    if (!selectedEvalId) { setPending({}); return }
    const ev = evaluations.find(e => e.id === selectedEvalId)
    const init: Record<string, PendingEntry> = {}
    for (const s of classStudents) {
      const existing = gradesList.find(g => g.evaluation_id === selectedEvalId && g.student_id === s.student_id)
      // En conflit (note enregistrée + absence le même jour), le report est SUSPENDU :
      // on conserve la note telle quelle et on laisse la ligne modifiable.
      const forced   = isForcedAbsent(s.student_id, ev?.evaluation_date)
                       && !hasSavedMark(s.student_id, selectedEvalId)
      init[s.student_id] = {
        scoreValue: forced ? '' : getInitialScoreValue(existing, ev?.eval_kind ?? null),
        comment:    ev?.eval_kind !== 'diagnostic' ? (existing?.comment ?? '') : '',
        is_absent:  forced || (existing?.is_absent ?? false),
        // L'absence relevée à l'appel doit finir en base (bulletin, complétion) :
        // tant qu'elle n'y est pas, la ligne est « à enregistrer ». Une fois
        // sauvegardée, `existing.is_absent` est vrai et le dirty ne revient pas.
        dirty:      forced && !existing?.is_absent,
        auto:       forced && !existing?.is_absent,
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
  // hasDirty pilote l'ENREGISTREMENT (tout ce qui doit partir en base).
  // hasUserChanges pilote les AVERTISSEMENTS : on n'alerte pas quelqu'un pour
  // un report automatique qu'il n'a pas saisi.
  const conflictCount   = classStudents.filter(
    s => isConflicted(s.student_id, selectedEvalId, selectedEval?.evaluation_date)
  ).length
  const hasDirty        = Object.values(pending).some(e => e.dirty)
  const hasUserChanges  = Object.values(pending).some(e => e.dirty && !e.auto)
  const autoAbsences    = Object.values(pending).filter(e => e.dirty && e.auto).length
  const isEditMode  = selectedEvalId ? gradesList.some(g => g.evaluation_id === selectedEvalId) : false

  // ── Garde anti-perte de saisie ───────────────────────────────────────────────
  // Toute navigation (classe / période / évaluation) passe par navigate() : si des
  // notes ne sont pas enregistrées, on demande confirmation avant de changer.
  const applyNav = (intent: NavIntent) => {
    if (intent.type === 'class')       setSelectedClassId(intent.value)
    else if (intent.type === 'period') setSelectedPeriodId(intent.value)
    else                               setSelectedEvalId(intent.value)
  }
  const navigate = (intent: NavIntent) => {
    if (hasUserChanges) setPendingNav(intent)
    else          applyNav(intent)
  }

  // Classe sélectionnée + type (élève vs adulte) : pilote la table de notes cible.
  const selectedClass = classes.find(c => c.id === selectedClassId) ?? null
  const isAdultClass  = selectedClass?.is_adult ?? false

  // ── Complétion par évaluation ────────────────────────────────────────────────
  // Une ligne compte comme « saisie » si elle porte une note, un commentaire ou
  // une absence — même règle que la lecture en base, appliquée à l'écran.
  const isFilled = (e: PendingEntry | undefined) =>
    !!e && (e.is_absent || e.scoreValue !== '' || e.comment.trim() !== '')

  const getCompletion = useCallback((evalId: string) => {
    // Restreint aux participants ACTUELS : une note orpheline (participant plus
    // inscrit) ne doit pas gonfler le compteur (bug « 13/2 »).
    const total = classStudents.length

    // Évaluation ouverte : on compte ce qui est À L'ÉCRAN, pas ce qui est en base.
    // Sinon une absence reportée de la feuille d'appel (pas encore enregistrée)
    // ou une note en cours de frappe n'apparaîtrait pas au compteur.
    if (evalId === selectedEvalId && Object.keys(pending).length > 0) {
      return { total, graded: classStudents.filter(s => isFilled(pending[s.student_id])).length }
    }

    // Évaluations NON ouvertes : base + absences déjà connues de la feuille d'appel.
    // Elles seront reportées à l'ouverture, autant que le compteur le dise tout de
    // suite — sinon l'arbre annonce « reste 4 notes » alors qu'il n'en reste que 2.
    const evalDate = evaluations.find(e => e.id === evalId)?.evaluation_date ?? null
    const filled = new Set(
      gradesList
        .filter(g => g.evaluation_id === evalId && (g.score !== null || g.comment !== null || g.is_absent))
        .map(g => g.student_id)
    )
    // Restreint aux participants ACTUELS : une note orpheline (participant plus
    // inscrit) ne doit pas gonfler le compteur (bug « 13/2 »).
    const graded = classStudents.filter(
      s => filled.has(s.student_id) || isForcedAbsent(s.student_id, evalDate)
    ).length
    return { total, graded }
  }, [gradesList, classStudents, pending, selectedEvalId, evaluations, isForcedAbsent])

  // ── Mise à jour d'une entrée pending ────────────────────────────────────────
  const updatePending = (studentId: string, update: Partial<PendingEntry>) =>
    setPending(prev => ({ ...prev, [studentId]: { ...prev[studentId], ...update, dirty: true, auto: false } }))

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  // Valeurs de note communes selon le type d'évaluation.
  const scoreFields = (entry: PendingEntry) => {
    if (entry.is_absent)                          return { score: null, comment: null, is_absent: true }
    if (selectedEval?.eval_kind === 'diagnostic') return { score: null, comment: entry.scoreValue || null, is_absent: false }
    const score = entry.scoreValue === '' ? null : parseFloat(entry.scoreValue)
    return { score, comment: entry.comment || null, is_absent: false }
  }

  const handleSave = async () => {
    if (!selectedEvalId || !selectedEval) return
    const dirtyIds = Object.entries(pending).filter(([, v]) => v.dirty).map(([k]) => k)
    if (dirtyIds.length === 0) return

    setSaving(true); setError(null)
    const supabase = createClient()
    const gradedMeta = { graded_at: new Date().toISOString(), ...(teacherId ? { graded_by: teacherId } : {}) }

    if (isAdultClass) {
      // Clé participant composite « parentId-tutorNumber » → colonnes adult_grades.
      const upserts = dirtyIds.map(pid => {
        const sep = pid.lastIndexOf('-')
        return {
          parent_id:        pid.slice(0, sep),
          tutor_number:     parseInt(pid.slice(sep + 1), 10),
          evaluation_id:    selectedEvalId,
          etablissement_id: etablissementId,
          ...gradedMeta,
          ...scoreFields(pending[pid]),
        }
      })
      const { data, error: err } = await supabase
        .from('adult_grades')
        .upsert(upserts, { onConflict: 'parent_id,tutor_number,evaluation_id' })
        .select('parent_id, tutor_number, evaluation_id, score, comment, is_absent')
      if (err) { setError(err.message); setSaving(false); return }
      const rows = (data as any[]).map(d => ({
        student_id:    `${d.parent_id}-${d.tutor_number}`,
        evaluation_id: d.evaluation_id, score: d.score, comment: d.comment, is_absent: d.is_absent,
      })) as GradeRow[]
      setGradesList(prev => [
        ...prev.filter(g => !(g.evaluation_id === selectedEvalId && dirtyIds.includes(g.student_id))),
        ...rows,
      ])
    } else {
      const upserts = dirtyIds.map(studentId => ({
        student_id: studentId, evaluation_id: selectedEvalId, ...gradedMeta, ...scoreFields(pending[studentId]),
      }))
      const { data, error: err } = await supabase
        .from('grades')
        .upsert(upserts, { onConflict: 'student_id,evaluation_id' })
        .select('id, student_id, evaluation_id, score, comment, is_absent')
      if (err) { setError(err.message); setSaving(false); return }
      setGradesList(prev => [
        ...prev.filter(g => !(g.evaluation_id === selectedEvalId && dirtyIds.includes(g.student_id))),
        ...(data as GradeRow[]),
      ])
    }

    setPending(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, dirty: false }])))
    setSaving(false)
  }

  // ── Reset toutes les notes d'une évaluation ─────────────────────────────────
  const handleReset = async () => {
    if (!selectedEvalId) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from(isAdultClass ? 'adult_grades' : 'grades')
      .delete()
      .eq('evaluation_id', selectedEvalId)
    // En cas d'échec on referme aussi : le message d'erreur s'affiche derrière la
    // modale, il resterait invisible.
    if (err) { setError(err.message); setConfirmReset(false); setSaving(false); return }
    setGradesList(prev => prev.filter(g => g.evaluation_id !== selectedEvalId))
    // Remettre à blanc SAUF les absences relevées à l'appel : elles ne sont pas une
    // saisie de l'utilisateur, elles ne se réinitialisent donc pas. Les notes venant
    // d'être supprimées en base, une absence forcée redevient « à enregistrer ».
    setPending(prev => Object.fromEntries(
      Object.entries(prev).map(([k]) => {
        const forced = isForcedAbsent(k, selectedEval?.evaluation_date)
        return [k, { scoreValue: '', comment: '', is_absent: forced, dirty: forced, auto: forced }]
      })
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

  // ── Archivage : les bulletins sont-ils archivés pour cette classe+période ? ─
  const isArchived = useMemo(() =>
    bulletinArchives.some(a => a.class_id === selectedClassId && a.period_id === selectedPeriodId),
    [bulletinArchives, selectedClassId, selectedPeriodId]
  )

  // ── Flags ────────────────────────────────────────────────────────────────────
  const noSchoolYear    = !schoolYearId
  const noClassOrPeriod = !selectedClassId || !selectedPeriodId

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in">

      {/* ── Barre de sélection ── */}
      <div className="card p-3 flex flex-wrap items-center gap-4 flex-shrink-0">

        {/* Classe */}
        <FloatSelect
          label="Classe"
          value={selectedClassId ?? ''}
          onChange={e => navigate({ type: 'class', value: e.target.value || null })}
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
          <div className="flex items-center gap-1">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => navigate({ type: 'period', value: p.id })}
                aria-pressed={selectedPeriodId === p.id}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200',
                  selectedPeriodId === p.id
                    ? 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)] shadow-[0_2px_6px_rgba(12,91,81,0.30)] hover:bg-[var(--brand-surface-2)] dark:hover:bg-[var(--brand-accent)] dark:hover:opacity-90'
                    : 'bg-white border border-warm-200 text-warm-700 hover:bg-warm-50 hover:border-warm-400'
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
          if (cls.main_teacher_name) {
            parts.push(cls.main_teacher_civilite ? `${cls.main_teacher_civilite} ${cls.main_teacher_name}` : cls.main_teacher_name)
          }
          if (cls.cotisation_label) parts.push(cls.cotisation_label)
          if (cls.level) parts.push(`Niveau ${cls.level}`)
          const timeStr  = [cls.start_time, cls.end_time].filter(Boolean).map(t => t!.slice(0, 5)).join('·')
          const schedule = [cls.day_of_week, timeStr].filter(Boolean).join(' ')
          if (schedule) parts.push(schedule)
          if (parts.length === 0) return null
          return <span className="ml-auto text-sm font-medium text-warm-700 whitespace-nowrap">{parts.join(' · ')}</span>
        })()}
      </div>

      {/* ── Bandeau archivage ── */}
      {isArchived && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex-shrink-0">
          <Lock size={13} className="flex-shrink-0" />
          Bulletins archivés pour cette période. Modification des notes impossible.
        </div>
      )}

      {/* ── Panneau split ── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* ── Gauche : Gabarit (lecture seule) ── */}
        <div className="w-[27rem] flex-shrink-0 flex flex-col min-h-0">
          <div className="card p-3 flex flex-col gap-2 h-full min-h-0">
            <p className="text-xs font-bold text-warm-700 uppercase tracking-widest flex-shrink-0">Gabarit</p>

            {noSchoolYear || noClassOrPeriod || currentEvals.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-warm-700 text-center px-2">
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
                          ? <ChevronDown  size={13} className="text-warm-700 flex-shrink-0" />
                          : <ChevronRight size={13} className="text-warm-700 flex-shrink-0" />
                        }
                        {ue.code && (
                          <span className="text-[10px] font-mono text-warm-700 bg-warm-200 px-1 rounded flex-shrink-0">
                            {ue.code}
                          </span>
                        )}
                        <Tooltip content={refTooltip(ue)} maxWidth="max-w-none" className="min-w-0">
                          <span className="text-xs font-bold text-secondary-700 truncate">{refLabel(ue)}</span>
                        </Tooltip>
                      </button>

                      {/* Évaluations de l'UE */}
                      {expanded && (
                        <div className="py-1 space-y-px">

                          {/* Cours directs */}
                          <div className="px-2">
                            {directEvals.map(ev => (
                              <EvalRow
                                key={ev.id} coursItem={coursById.get(ev.cours_id ?? '')}
                                selected={selectedEvalId === ev.id}
                                completion={getCompletion(ev.id)}
                                onClick={() => navigate({ type: 'eval', value: ev.id })}
                              />
                            ))}
                          </div>

                          {/* Modules */}
                          {ueMods.map(mod => {
                            const modEvals = ueEvals.filter(e => getEffModId(e) === mod.id)
                            return (
                              <div key={mod.id} className="mt-0.5 ml-4">
                                <p className="flex items-center gap-1 text-[10px] font-semibold text-warm-700 uppercase tracking-wider pl-3 pr-2 pt-1.5 pb-0.5 border-l-2 border-warm-100">
                                  {mod.code && <span className="text-[10px] font-mono text-warm-700 bg-warm-200 px-1 rounded flex-shrink-0 normal-case">{mod.code}</span>}
                                  <Tooltip content={refTooltip(mod)} maxWidth="max-w-none" className="min-w-0">
                                    <span className="truncate">{refLabel(mod)}</span>
                                  </Tooltip>
                                </p>
                                <div className="pl-2">
                                  {modEvals.map(ev => (
                                    <EvalRow
                                      key={ev.id} coursItem={coursById.get(ev.cours_id ?? '')}
                                      selected={selectedEvalId === ev.id}
                                      completion={getCompletion(ev.id)}
                                      onClick={() => navigate({ type: 'eval', value: ev.id })}
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
                <div className="text-center text-warm-700">
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
                      {selectedCours ? refLabel(selectedCours) : 'Cours introuvable'}
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
                        <span className="text-xs text-warm-700">
                          {diagnosticOptions.filter(o => o.comment).map(o => `${o.acronym} : ${o.comment}`).join(' - ')}
                        </span>
                      )}
                      {selectedEval.eval_kind === 'scored' && (
                        <span className="text-xs text-warm-700">Coef. {selectedEval.coefficient}</span>
                      )}
                      {selectedEval.evaluation_date && (
                        <span className="text-xs text-warm-700">
                          {new Date(selectedEval.evaluation_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const { graded, total } = getCompletion(selectedEvalId!)
                    const kind = selectedEval.eval_kind
                    const showAvg = (kind === 'scored' || kind === 'stars')
                    // Moyenne calculée sur l'ÉCRAN, comme le compteur : sinon le badge
                    // « Saisie complète » (piloté par `graded`) apparaîtrait à côté
                    // d'une moyenne encore calculée sur les anciennes valeurs en base.
                    // Repli sur la base tant que `pending` n'est pas initialisé.
                    const scores = Object.keys(pending).length > 0
                      ? classStudents
                          .map(s => pending[s.student_id])
                          .filter(e => e && !e.is_absent && e.scoreValue !== '' && !Number.isNaN(parseFloat(e.scoreValue)))
                          .map(e => parseFloat(e!.scoreValue))
                      : gradesList
                          .filter(g => g.evaluation_id === selectedEvalId && !g.is_absent && g.score !== null)
                          .map(g => g.score as number)
                    const avg = scores.length > 0
                      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(kind === 'scored' ? 2 : 1)
                      : null

                    return (
                      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                        {total > 0 && graded >= total && (
                          <span className="text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-full">
                            Saisie complète
                          </span>
                        )}
                        {showAvg && avg !== null && total > 0 && graded >= total && (
                          <span className="text-[10px] text-warm-700">
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
                  <div role="alert" className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 flex-shrink-0">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Conflits appel / note : on signale, on ne corrige jamais d'office */}
                {conflictCount > 0 && (
                  <div role="alert" className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 flex-shrink-0">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>
                      {conflictCount === 1
                        ? '1 note enregistrée porte sur un participant absent ce jour-là selon la feuille d\'appel.'
                        : `${conflictCount} notes enregistrées portent sur des participants absents ce jour-là selon la feuille d'appel.`}
                      {' '}Corrigez la feuille d'appel, ou cochez l'absence ici pour effacer la note.
                    </span>
                  </div>
                )}

                {/* Tableau élèves */}
                <div ref={tableRef} className="flex-1 min-h-0 overflow-y-auto">
                  {classStudents.length === 0 ? (
                    <p className="text-sm text-warm-700 text-center py-8">{isAdultClass ? 'Aucun participant inscrit dans ce cours.' : 'Aucun élève inscrit dans cette classe.'}</p>
                  ) : (
                    <table aria-label="Saisie des notes des élèves" className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b-2 border-warm-100">
                          <th className="text-left text-xs font-semibold text-warm-700 py-2 pr-3 pl-1">#</th>
                          <th className="text-left text-xs font-semibold text-warm-700 py-2 pr-3">{isAdultClass ? 'Participant' : 'Élève'}</th>
                          <th className="text-center text-xs font-semibold text-warm-700 py-2 px-3 w-36">
                            {selectedEval.eval_kind === 'scored'
                              ? `Note /${selectedEval.max_score}`
                              : selectedEval.eval_kind === 'diagnostic'
                              ? 'Appréciation'
                              : 'Étoiles'}
                          </th>
                          <th className="text-center text-xs font-semibold text-warm-700 py-2 pl-3 w-20">Absent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((student, idx) => {
                          const entry    = pending[student.student_id] ?? { scoreValue: '', comment: '', is_absent: false, dirty: false }
                          const conflicted   = isConflicted(student.student_id, selectedEvalId, selectedEval.evaluation_date)
                          // En conflit, aucun verrou : la ligne doit rester corrigeable.
                          const forcedAbsent = !conflicted && isForcedAbsent(student.student_id, selectedEval.evaluation_date)
                          // `|| forcedAbsent` : le verrou d'affichage ne dépend jamais de
                          // l'état de saisie — quel que soit le chemin (montage, reset,
                          // changement de classe), un absent de l'appel reste verrouillé.
                          const isAbsent = entry.is_absent || forcedAbsent

                          return (
                            <tr
                              key={student.student_id}
                              className={clsx(
                                'border-b border-warm-50 transition-colors group',
                                conflicted
                                  ? 'bg-amber-50 hover:bg-amber-100/60 border-l-2 border-l-amber-500'
                                  : entry.dirty
                                  ? 'bg-amber-50/40 hover:bg-amber-100/50'
                                  : idx % 2 === 0
                                  ? 'bg-white hover:bg-primary-50/40'
                                  : 'bg-warm-50/20 hover:bg-primary-50/40'
                              )}
                            >
                              {/* Numéro */}
                              <td className="py-1.5 pr-2 pl-1 text-xs text-warm-700 font-mono w-8">{idx + 1}</td>

                              {/* Nom */}
                              <td className="py-1.5 pr-3">
                                <span className="font-medium text-secondary-700">{student.last_name}</span>
                                <span className="text-secondary-500 ml-1">{student.first_name}</span>
                                <span className="hidden sm:inline text-[10px] text-warm-700 font-mono ml-1.5">{student.student_number}</span>
                                {conflicted && (
                                  <Tooltip content={`Note enregistrée, mais absent le ${fmtShortDate(selectedEval.evaluation_date)} à la feuille d'appel. Corrigez l'appel ou cochez l'absence ici.`}>
                                    <span
                                      role="img"
                                      aria-label="Conflit avec la feuille d'appel"
                                      className="inline-flex align-middle ml-1.5 text-amber-600"
                                    >
                                      <AlertTriangle size={13} />
                                    </span>
                                  </Tooltip>
                                )}
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
                                    disabled={isAbsent || isArchived}
                                    placeholder=""
                                    data-row-idx={idx}
                                    className="input text-sm py-0.5 w-24 text-center disabled:opacity-30 disabled:cursor-not-allowed"
                                  />
                                ) : selectedEval.eval_kind === 'diagnostic' ? (
                                  <select
                                    value={entry.scoreValue}
                                    onChange={e => { updatePending(student.student_id, { scoreValue: e.target.value }); focusNext(idx) }}
                                    disabled={isAbsent || isArchived}
                                    data-row-idx={idx}
                                    className="input text-sm py-0.5 w-28 disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <option value="">(aucune)</option>
                                    {diagnosticOptions.map(opt => (
                                      <option key={opt.acronym} value={opt.acronym}>{opt.acronym}</option>
                                    ))}
                                  </select>
                                ) : (
                                  /* Stars — demi-étoile */
                                  <StarInput
                                    value={entry.scoreValue === '' ? null : parseFloat(entry.scoreValue)}
                                    onChange={v => updatePending(student.student_id, { scoreValue: v === null ? '' : String(v) })}
                                    disabled={isAbsent || isArchived}
                                  />
                                )}
                              </td>

                              {/* Absent — verrouillé si l'appel du jour le déclare absent */}
                              <td className="py-1 pl-3">
                                <Tooltip
                                  content={forcedAbsent
                                    ? `Absent le ${fmtShortDate(selectedEval.evaluation_date)} (feuille d'appel)`
                                    : 'Absent à cette évaluation'}
                                >
                                  <FloatCheckbox
                                    label=""
                                    variant="compact"
                                    checked={isAbsent}
                                    onChange={v => updatePending(student.student_id, {
                                      is_absent:  v,
                                      scoreValue: v ? '' : entry.scoreValue,
                                    })}
                                    disabled={isArchived || forcedAbsent}
                                    className="justify-center"
                                  />
                                </Tooltip>
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
                    // Absents comptés à l'écran aussi : un report d'appel non encore
                    // enregistré doit apparaître immédiatement.
                    const absent = classStudents.filter(s => pending[s.student_id]?.is_absent).length
                    return (
                      <p className="text-xs text-warm-700 flex-1">
                        <span className={clsx(
                          'font-semibold',
                          graded === total && total > 0 ? 'text-primary-600' : graded > 0 ? 'text-amber-600' : 'text-warm-700'
                        )}>
                          {graded}/{total}
                        </span>
                        {' saisis'}
                        {absent > 0 && <span> · {absent} absent{absent > 1 ? 's' : ''}</span>}
                        {hasUserChanges
                          ? <span className="text-amber-500 ml-2">· Modifications non enregistrées</span>
                          : autoAbsences > 0 && (
                              <span className="text-warm-700 ml-2">
                                · {autoAbsences} absence{autoAbsences > 1 ? 's' : ''} report{autoAbsences > 1 ? 'ées' : 'ée'} de la feuille d'appel · à enregistrer
                              </span>
                            )}
                      </p>
                    )
                  })()}

                  {/* Boutons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Ce bouton SUPPRIME les notes en base (DELETE définitif), il ne
                        remet pas le formulaire à son état initial : le libellé et la
                        confirmation doivent le dire. */}
                    {!isArchived && (
                      <Tooltip content="Supprimer toutes les notes de cette évaluation">
                        <FloatButton
                          variant="secondary"
                          type="button"
                          onClick={() => setConfirmReset(true)}
                          disabled={saving || !gradesList.some(g => g.evaluation_id === selectedEvalId)}
                          aria-label="Supprimer toutes les notes de cette évaluation"
                          className="!px-2"
                        >
                          <RotateCcw size={13} />
                        </FloatButton>
                      </Tooltip>
                    )}
                    <FloatButton
                      variant={isEditMode ? 'edit' : 'submit'}
                      type="button"
                      onClick={handleSave}
                      disabled={!hasDirty || isArchived}
                      loading={saving}
                    >
                      {isEditMode ? 'Modifier' : 'Valider'}
                    </FloatButton>
                    <Tooltip content="Évaluation précédente">
                      <FloatButton
                        variant="secondary"
                        type="button"
                        onClick={() => prevEval && navigate({ type: 'eval', value: prevEval.id })}
                        disabled={!prevEval}
                        aria-label="Évaluation précédente"
                        className="!px-2"
                      >
                        <ChevronLeft size={14} />
                      </FloatButton>
                    </Tooltip>
                    <Tooltip content="Évaluation suivante">
                      <FloatButton
                        variant="secondary"
                        type="button"
                        onClick={() => nextEval && navigate({ type: 'eval', value: nextEval.id })}
                        disabled={!nextEval}
                        aria-label="Évaluation suivante"
                        className="!px-2"
                      >
                        <ChevronRight size={14} />
                      </FloatButton>
                    </Tooltip>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmReset && selectedEval && (
        <ConfirmModal
          open
          variant="danger"
          title="Supprimer toutes les notes"
          confirmLabel="Supprimer définitivement"
          onConfirm={handleReset}
          onCancel={() => setConfirmReset(false)}
        >
          <div className="text-sm text-warm-700 space-y-2">
            <p>
              {(() => {
                const n = gradesList.filter(g => g.evaluation_id === selectedEvalId).length
                return `${n} note${n > 1 ? 's' : ''} de cette évaluation ${n > 1 ? 'seront supprimées' : 'sera supprimée'} de la base.`
              })()}
            </p>
            <p>
              Le gabarit lui-même est conservé (type, coefficient, date) : la grille repart vierge.
              Cette suppression est définitive.
            </p>
          </div>
        </ConfirmModal>
      )}

      {pendingNav && (
        <ConfirmModal
          open
          variant="warning"
          confirmColor="amber"
          title="Modifications non enregistrées"
          message="Des notes saisies ne sont pas enregistrées. Quitter sans les enregistrer ?"
          confirmLabel="Quitter sans enregistrer"
          cancelLabel="Rester"
          onConfirm={() => { const nav = pendingNav; setPendingNav(null); applyNav(nav) }}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  )
}

// ─── Ligne d'évaluation dans le gabarit gauche ───────────────────────────────

function EvalRow({
  coursItem, selected, completion, onClick,
}: {
  coursItem:  Cours | undefined
  selected:   boolean
  completion: { total: number; graded: number }
  onClick:    () => void
}) {
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
        isComplete ? 'bg-primary-400' : isPartial ? 'bg-amber-400' : 'bg-warm-200'
      )} />

      {/* Nom du cours */}
      <Tooltip content={refTooltip(coursItem)} maxWidth="max-w-none" className="flex-1 min-w-0">
        <span className="flex-1 truncate min-w-0">
          {coursItem?.code && (
            <span className="font-mono text-[10px] text-warm-700 mr-1">{coursItem.code}</span>
          )}
          {coursItem ? refLabel(coursItem) : 'Cours introuvable'}
        </span>
      </Tooltip>

      {/* Compteur */}
      <span className={clsx(
        'text-[10px] font-mono flex-shrink-0',
        isComplete ? 'text-primary-600' : isPartial ? 'text-amber-500' : 'text-warm-700'
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
  const starLabel = (v: number) => `${String(v).replace('.', ',')} étoile${v >= 2 ? 's' : ''}`
  return (
    <div
      role="group"
      aria-label="Note en étoiles sur 5"
      className={clsx('flex items-center justify-center gap-2', disabled && 'opacity-30 pointer-events-none')}
    >
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => {
          const isFull = value !== null && value >= n
          const isHalf = value !== null && value >= n - 0.5 && value < n
          return (
            <span key={n} className="relative inline-block leading-none select-none text-2xl">
              {/* Fond gris (décoratif) */}
              <span className="text-warm-200" aria-hidden="true">★</span>
              {/* Remplissage ambré, clippé à gauche (décoratif) */}
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 h-full overflow-hidden text-amber-400 leading-none"
                style={{ width: isFull ? '100%' : isHalf ? '50%' : '0%' }}
              >
                ★
              </span>
              {/* Zone cliquable gauche → n - 0.5 */}
              <button
                type="button"
                aria-label={starLabel(n - 0.5)}
                aria-pressed={value === n - 0.5}
                className="absolute left-0 top-0 w-1/2 h-full cursor-pointer"
                onClick={() => onChange(value === n - 0.5 ? 0 : n - 0.5)}
              />
              {/* Zone cliquable droite → n */}
              <button
                type="button"
                aria-label={starLabel(n)}
                aria-pressed={value === n}
                className="absolute right-0 top-0 w-1/2 h-full cursor-pointer"
                onClick={() => onChange(value === n ? 0 : n)}
              />
            </span>
          )
        })}
      </div>
      <span className="text-xs font-semibold text-secondary-700 w-8 text-left tabular-nums" aria-hidden="true">
        {value !== null ? value : ''}
      </span>
    </div>
  )
}
