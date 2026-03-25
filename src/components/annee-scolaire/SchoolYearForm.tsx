'use client'

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Plus, X, Pencil } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { SchoolYear, EvalTypeConfig, PeriodType, DiagnosticOption, VacationPeriod } from '@/types/database'
import { parseDiagnosticOption } from '@/types/database'

// ─── Types internes ───────────────────────────────────────────────────────────

interface SchoolYearFormProps {
  schoolYear?:      SchoolYear & { eval_type_configs: EvalTypeConfig[] }
  etablissementId?: string   // requis pour la création
  weekStartDay?:    number   // 1=Lundi, 6=Samedi, 0=Dimanche
}

// Type frontend uniquement : scored_10 / scored_20 remplacent "scored" + max_score
type FormEvalType = 'diagnostic' | 'scored_10' | 'scored_20' | 'stars'

type FormData = {
  label:               string
  start_date:          string
  end_date:            string
  is_current:          boolean
  period_type:         PeriodType
  eval_types:          FormEvalType[]
  diagnostic_options:  DiagnosticOption[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function suggestNextLabel(existing?: string): string {
  const now  = new Date()
  const year = now.getFullYear()
  return `${year}-${year + 1}`
}

function isValidLabel(label: string): boolean {
  return /^\d{4}-\d{4}$/.test(label.trim())
}

function periodsForType(type: PeriodType) {
  return type === 'trimestrial'
    ? [{ label: 'T1', order_index: 1 }, { label: 'T2', order_index: 2 }, { label: 'T3', order_index: 3 }]
    : [{ label: 'S1', order_index: 1 }, { label: 'S2', order_index: 2 }]
}

function getWeekStart(d: Date, startDay: number): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day - startDay + 7) % 7
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

interface WeekInfo {
  monday: Date
  sunday: Date
  weekNum: number
  monthIndex: number // month of the monday
}

function getWeeksBetween(startDate: string, endDate: string, startDay: number): WeekInfo[] {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return []

  const weeks: WeekInfo[] = []
  let first = getWeekStart(start, startDay)

  while (first <= end) {
    const last = addDays(first, 6)
    weeks.push({
      monday: new Date(first),
      sunday: last,
      weekNum: getISOWeek(first),
      monthIndex: first.getMonth(),
    })
    first = addDays(first, 7)
  }
  return weeks
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function SchoolYearForm({ schoolYear, etablissementId, weekStartDay: wsd = 1 }: SchoolYearFormProps) {
  const router    = useRouter()
  const isEditing = !!schoolYear

  const getInitialForm = (): FormData => {
    if (!schoolYear) {
      return {
        label:              suggestNextLabel(),
        start_date:         '',
        end_date:           '',
        is_current:         false,
        period_type:        'trimestrial',
        eval_types:         [],
        diagnostic_options: [
        { acronym: 'AC', comment: '' },
        { acronym: 'EC', comment: '' },
        { acronym: 'NA', comment: '' },
      ],
      }
    }
    const configs     = schoolYear.eval_type_configs ?? []
    const activeTypes: FormEvalType[] = configs
      .filter(c => c.is_active)
      .map(c => {
        if (c.eval_type === 'scored') return c.max_score === 10 ? 'scored_10' : 'scored_20'
        return c.eval_type as FormEvalType
      })
    const diagnosticConfig = configs.find(c => c.eval_type === 'diagnostic' && c.is_active)
    return {
      label:              schoolYear.label,
      start_date:         schoolYear.start_date ?? '',
      end_date:           schoolYear.end_date ?? '',
      is_current:         schoolYear.is_current,
      period_type:        schoolYear.period_type,
      eval_types:         activeTypes,
      diagnostic_options: diagnosticConfig?.diagnostic_options?.length
        ? (diagnosticConfig.diagnostic_options as unknown[]).map(parseDiagnosticOption)
        : [
            { acronym: 'AC', comment: '' },
            { acronym: 'EC', comment: '' },
            { acronym: 'NA', comment: '' },
          ],
    }
  }

  const [form,         setForm]         = useState<FormData>(getInitialForm)
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

  // Vacances
  const [vacations, setVacations] = useState<VacationPeriod[]>(
    () => (schoolYear?.vacations ?? []) as VacationPeriod[]
  )
  const [editingVacLabel, setEditingVacLabel] = useState<string | null>(null)
  const [vacLabelDraft, setVacLabelDraft]     = useState('')
  const [showVacModal, setShowVacModal]       = useState(false)

  // Semaines entre rentrée et fin
  const weeks = useMemo(() => getWeeksBetween(form.start_date, form.end_date, wsd), [form.start_date, form.end_date, wsd])

  // Set of monday ISO strings that are vacation
  const vacationMondaySet = useMemo(() => {
    const set = new Set<string>()
    for (const v of vacations) {
      const start = new Date(v.start_date + 'T00:00:00')
      const end = new Date(v.end_date + 'T00:00:00')
      let monday = getWeekStart(start, wsd)
      while (monday <= end) {
        set.add(toISO(monday))
        monday = addDays(monday, 7)
      }
    }
    return set
  }, [vacations])

  const toggleWeekVacation = (monday: Date) => {
    const mondayISO = toISO(monday)
    const sundayISO = toISO(addDays(monday, 6))
    const isVac = vacationMondaySet.has(mondayISO)

    if (isVac) {
      // Remove this week: split any vacation that contains it
      const newVacs: VacationPeriod[] = []
      for (const v of vacations) {
        const vStart = new Date(v.start_date + 'T00:00:00')
        const vEnd = new Date(v.end_date + 'T00:00:00')
        const wStart = new Date(mondayISO + 'T00:00:00')
        const wEnd = addDays(monday, 6)

        if (wStart > vEnd || wEnd < vStart) {
          newVacs.push(v)
        } else {
          // Before
          if (vStart < wStart) {
            newVacs.push({ ...v, end_date: toISO(addDays(wStart, -1)) })
          }
          // After
          if (vEnd > wEnd) {
            newVacs.push({ ...v, start_date: toISO(addDays(wEnd, 1)) })
          }
        }
      }
      setVacations(newVacs)
    } else {
      // Add this week: merge with adjacent vacations
      let newStart = mondayISO
      let newEnd = sundayISO
      let label = ''
      const remaining: VacationPeriod[] = []

      for (const v of vacations) {
        const vStartD = new Date(v.start_date + 'T00:00:00')
        const vEndD = new Date(v.end_date + 'T00:00:00')
        const adjacent = addDays(vEndD, 1) >= monday && addDays(monday, 6) >= addDays(vStartD, -1)

        if (adjacent || (monday >= vStartD && monday <= vEndD)) {
          if (v.start_date < newStart) newStart = v.start_date
          if (v.end_date > newEnd) newEnd = v.end_date
          if (v.label && !label) label = v.label
        } else {
          remaining.push(v)
        }
      }
      remaining.push({ start_date: newStart, end_date: newEnd, label })
      remaining.sort((a, b) => a.start_date.localeCompare(b.start_date))
      setVacations(remaining)
    }
  }

  const getVacationLabel = (mondayISO: string): string | undefined => {
    for (const v of vacations) {
      const vStart = getWeekStart(new Date(v.start_date + 'T00:00:00'), wsd)
      if (toISO(vStart) === mondayISO && v.label) return v.label
    }
    return undefined
  }

  const saveVacLabel = (mondayISO: string, label: string) => {
    setVacations(prev => prev.map(v => {
      const vStart = getWeekStart(new Date(v.start_date + 'T00:00:00'), wsd)
      if (toISO(vStart) === mondayISO) return { ...v, label: label.trim() }
      return v
    }))
    setEditingVacLabel(null)
  }

  const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))

  const toggleEvalType = (type: FormEvalType) =>
    setForm(prev => ({
      ...prev,
      eval_types: prev.eval_types.includes(type)
        ? prev.eval_types.filter(t => t !== type)
        : [...prev.eval_types, type],
    }))

  const updateDiagnosticOption = (index: number, field: 'acronym' | 'comment', value: string) =>
    setForm(prev => {
      const opts = [...prev.diagnostic_options]
      opts[index] = { ...opts[index], [field]: value }
      return { ...prev, diagnostic_options: opts }
    })

  const removeDiagnosticOption = (index: number) =>
    setForm(prev => ({
      ...prev,
      diagnostic_options: prev.diagnostic_options.filter((_, i) => i !== index),
    }))

  const addDiagnosticOption = () =>
    setForm(prev => ({
      ...prev,
      diagnostic_options: [...prev.diagnostic_options, { acronym: '', comment: '' }],
    }))

  const vLabel     = !isValidLabel(form.label)
  const vStartDate = !form.start_date
  const vEndDate   = !form.end_date
  const vNoEval    = form.eval_types.length === 0
  const isValid    = !vLabel && !vStartDate && !vEndDate && !vNoEval

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(['label', 'start_date', 'end_date']))
    setHasSubmitted(true)
    setError(null)
    setSuccess(false)

    if (!isValid) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // 0. Vérifications de sécurité (édition uniquement)
      if (isEditing) {
        const yearId = schoolYear.id
        const originalForm = getInitialForm()
        const periodTypeChanged = form.period_type !== originalForm.period_type
        const removedTypes = originalForm.eval_types.filter(t => !form.eval_types.includes(t))

        if (periodTypeChanged || removedTypes.length > 0) {
          const { data: periodRows } = await supabase
            .from('periods').select('id').eq('school_year_id', yearId)
          const periodIds = (periodRows ?? []).map((p: { id: string }) => p.id)

          if (periodIds.length > 0) {
            const { data: evalRows } = await supabase
              .from('evaluations').select('id, eval_kind, max_score').in('period_id', periodIds)
            const allEvalIds = (evalRows ?? []).map((e: { id: string }) => e.id)

            if (allEvalIds.length > 0) {
              if (periodTypeChanged) {
                const { count } = await supabase
                  .from('grades').select('id', { count: 'exact', head: true })
                  .in('evaluation_id', allEvalIds)
                if ((count ?? 0) > 0) {
                  setError('Impossible de changer la répartition des périodes : des notes ont déjà été saisies pour cette année scolaire.')
                  setIsSubmitting(false); return
                }
              }

              if (removedTypes.length > 0) {
                type EvalRow = { id: string; eval_kind: string; max_score: number | null }
                const removedEvalIds = (evalRows as EvalRow[])
                  .filter(e => removedTypes.some(t =>
                    t === 'scored_10' ? e.eval_kind === 'scored' && e.max_score === 10
                    : t === 'scored_20' ? e.eval_kind === 'scored' && e.max_score === 20
                    : e.eval_kind === t
                  ))
                  .map(e => e.id)

                if (removedEvalIds.length > 0) {
                  const labels: Record<string, string> = {
                    diagnostic: 'Diagnostique', scored_10: 'Notée /10', scored_20: 'Notée /20', stars: 'Étoilée',
                  }
                  const names = removedTypes.map(t => labels[t] ?? t).join(', ')
                  setError(`Impossible de supprimer le(s) type(s) "${names}" : des gabarits d'évaluation utilisent déjà ce(s) type(s). Supprimez d'abord les gabarits concernés.`)
                  setIsSubmitting(false); return
                }
              }
            }
          }
        }
      }

      // 1. Insérer ou mettre à jour l'année scolaire
      let yearId: string

      if (isEditing) {
        const { error: errUpd } = await supabase
          .from('school_years')
          .update({ label: form.label.trim(), start_date: form.start_date || null, end_date: form.end_date || null, vacations, is_current: form.is_current, period_type: form.period_type })
          .eq('id', schoolYear.id)
        if (errUpd) throw errUpd
        yearId = schoolYear.id
      } else {
        const { data: newYear, error: errIns } = await supabase
          .from('school_years')
          .insert({
            etablissement_id: etablissementId!,
            label:            form.label.trim(),
            start_date:       form.start_date || null,
            end_date:         form.end_date || null,
            vacations,
            is_current:       form.is_current,
            period_type:      form.period_type,
          })
          .select('id')
          .single()
        if (errIns) throw errIns
        yearId = newYear.id
      }

      // 2. Si marquée "en cours" : désactiver les autres
      if (form.is_current) {
        const { error: errReset } = await supabase
          .from('school_years')
          .update({ is_current: false })
          .neq('id', yearId)
        if (errReset) throw errReset
      }

      // 3. Recréer les périodes UNIQUEMENT si le type de répartition a changé
      //    (ou s'il s'agit d'une création). Évite de NULLifier les period_id des gabarits.
      const originalPeriodType = isEditing ? schoolYear.period_type : null
      if (!isEditing || form.period_type !== originalPeriodType) {
        await supabase.from('periods').delete().eq('school_year_id', yearId)
        const periodsToInsert = periodsForType(form.period_type).map(p => ({
          school_year_id: yearId,
          label:          p.label,
          order_index:    p.order_index,
        }))
        const { error: errPeriods } = await supabase.from('periods').insert(periodsToInsert)
        if (errPeriods) throw errPeriods
      }

      // 4. Réinitialiser et recréer les configs d'évaluation (multiple types actifs)
      await supabase.from('eval_type_configs').delete().eq('school_year_id', yearId)
      if (form.eval_types.length > 0) {
        const evalInserts = form.eval_types.map(type => ({
          school_year_id:     yearId,
          eval_type:          type === 'scored_10' || type === 'scored_20' ? 'scored' : type,
          is_active:          true,
          max_score:          type === 'scored_10' ? 10 : type === 'scored_20' ? 20 : null,
          diagnostic_options: type === 'diagnostic'
            ? form.diagnostic_options
                .map(o => ({ acronym: o.acronym.trim(), comment: o.comment.trim() }))
                .filter(o => o.acronym)
            : null,
        }))
        const { error: errEval } = await supabase.from('eval_type_configs').insert(evalInserts)
        if (errEval) throw errEval
      }

      setSuccess(true)
      router.push('/dashboard/annee-scolaire')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : (err as { message?: string })?.message ?? ''
      setError(msg || 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2 max-w-2xl">

      {/* ── Libellé + Répartition ────────────────────────────────────────────── */}
      <div className="card p-3">
        <div className="grid grid-cols-2 gap-4">

          {/* Colonne 1 : Libellé + En cours + Vacances */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
              Année scolaire <span className="text-red-400">*</span>
            </h2>
            <input
              type="text"
              placeholder="ex. 2025-2026"
              value={form.label}
              onChange={e => set('label', e.target.value)}
              onBlur={() => touch('label')}
              disabled={isEditing}
              className={clsx(
                'input w-full',
                touched.has('label') && vLabel && 'input-error',
                isEditing && 'opacity-60 cursor-not-allowed'
              )}
            />
            {touched.has('label') && vLabel && (
              <p className="text-xs text-red-500">Format attendu : AAAA-AAAA (ex. 2025-2026)</p>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="is_current"
                checked={form.is_current}
                onChange={e => set('is_current', e.target.checked)}
                className="w-4 h-4 accent-primary-500"
              />
              <span className="text-sm text-secondary-700 select-none">Année en cours</span>
            </label>

            {/* Mini-tableau vacances */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Vacances</h3>
                {weeks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowVacModal(true)}
                    className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-0.5 transition-colors"
                  >
                    <Plus size={12} /> Gérer
                  </button>
                )}
              </div>
              {vacations.length === 0 ? (
                <p className="text-xs text-warm-400 italic">
                  {weeks.length > 0 ? 'Aucune vacance définie' : 'Renseigner les dates pour définir les vacances'}
                </p>
              ) : (
                <div className="border border-warm-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-warm-100">
                      {vacations.map(v => {
                        const start = new Date(v.start_date + 'T00:00:00')
                        const end = new Date(v.end_date + 'T00:00:00')
                        const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000)
                        const nbWeeks = Math.floor(diffDays / 7) + 1
                        return (
                          <tr key={v.start_date} className="hover:bg-warm-50/60">
                            <td className="px-2 py-1 font-medium text-secondary-700">
                              {v.label || <span className="text-warm-400 italic">Sans nom</span>}
                            </td>
                            <td className="px-2 py-1 text-warm-500 whitespace-nowrap text-right">
                              {fmtShort(start)}–{fmtShort(end)}
                            </td>
                            <td className="px-2 py-1 text-warm-400 text-right whitespace-nowrap">
                              {nbWeeks} sem.
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Colonne 2 : Dates + Répartition */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">
                  Date de rentrée <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  onBlur={() => touch('start_date')}
                  className={clsx('input w-full', touched.has('start_date') && vStartDate && 'input-error')}
                />
                {touched.has('start_date') && vStartDate && (
                  <p className="text-xs text-red-500 mt-0.5">Obligatoire.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">
                  Date de fin d'année <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => set('end_date', e.target.value)}
                  onBlur={() => touch('end_date')}
                  className={clsx('input w-full', touched.has('end_date') && vEndDate && 'input-error')}
                />
                {touched.has('end_date') && vEndDate && (
                  <p className="text-xs text-red-500 mt-0.5">Obligatoire.</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest mb-2">
                Répartition <span className="text-red-400">*</span>
              </h2>
            <div className="flex gap-2">
              {([
                { value: 'trimestrial', label: 'Trimestriel', sub: 'T1 · T2 · T3' },
                { value: 'semestrial',  label: 'Semestriel',  sub: 'S1 · S2' },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className={clsx(
                    'flex items-center gap-2 flex-1 px-3 py-2 rounded-xl border cursor-pointer transition-colors',
                    form.period_type === opt.value
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-warm-200 bg-white hover:border-warm-300'
                  )}
                >
                  <input
                    type="radio"
                    name="period_type"
                    value={opt.value}
                    checked={form.period_type === opt.value}
                    onChange={() => set('period_type', opt.value)}
                    className="accent-primary-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-secondary-800">{opt.label}</p>
                    <p className="text-xs text-warm-400">{opt.sub}</p>
                  </div>
                </label>
              ))}
            </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Type d'évaluation ─────────────────────────────────────────────── */}
      <div className={clsx(
        'card p-3 space-y-2',
        vNoEval && hasSubmitted && 'ring-1 ring-red-300'
      )}>
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Type d'évaluation <span className="text-red-400">*</span>
          </h2>
          {vNoEval && hasSubmitted && (
            <p className="text-xs text-red-500">Sélectionnez au moins un type.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">

          {/* Diagnostique */}
          <div className={clsx(
            'px-3 py-2 rounded-xl border transition-colors col-span-2',
            form.eval_types.includes('diagnostic') ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white'
          )}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.eval_types.includes('diagnostic')}
                onChange={() => toggleEvalType('diagnostic')}
                className="accent-primary-500 flex-shrink-0 w-4 h-4"
              />
              <p className="text-sm font-semibold text-secondary-800">Diagnostique</p>
            </label>

            {form.eval_types.includes('diagnostic') && (
              <div className="mt-1.5 ml-7 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-warm-400 w-20 text-center">Acronyme</span>
                  <span className="text-xs text-warm-400 flex-1">Commentaire</span>
                </div>
                {form.diagnostic_options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={opt.acronym}
                      onChange={e => updateDiagnosticOption(i, 'acronym', e.target.value)}
                      placeholder="AC"
                      className="input text-sm py-0.5 w-20"
                    />
                    <input
                      type="text"
                      value={opt.comment}
                      onChange={e => updateDiagnosticOption(i, 'comment', e.target.value)}
                      placeholder="ex. Acquis Consolidé"
                      className="input text-sm py-0.5 flex-1"
                    />
                    {form.diagnostic_options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDiagnosticOption(i)}
                        className="p-1 text-warm-300 hover:text-danger-500 rounded transition-colors"
                        title="Supprimer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDiagnosticOption}
                  className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 mt-0.5"
                >
                  <Plus size={12} /> Ajouter une option
                </button>
              </div>
            )}
          </div>

          {/* Notée sur 10 */}
          <label className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors',
            form.eval_types.includes('scored_10') ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
          )}>
            <input
              type="checkbox"
              checked={form.eval_types.includes('scored_10')}
              onChange={() => toggleEvalType('scored_10')}
              className="accent-primary-500 flex-shrink-0 w-4 h-4"
            />
            <div>
              <p className="text-sm font-semibold text-secondary-800">Notée sur 10</p>
              <p className="text-xs text-warm-400">Notes de 0 à 10</p>
            </div>
          </label>

          {/* Notée sur 20 */}
          <label className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors',
            form.eval_types.includes('scored_20') ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
          )}>
            <input
              type="checkbox"
              checked={form.eval_types.includes('scored_20')}
              onChange={() => toggleEvalType('scored_20')}
              className="accent-primary-500 flex-shrink-0 w-4 h-4"
            />
            <div>
              <p className="text-sm font-semibold text-secondary-800">Notée sur 20</p>
              <p className="text-xs text-warm-400">Notes de 0 à 20</p>
            </div>
          </label>

          {/* Étoilée */}
          <label className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors col-span-2',
            form.eval_types.includes('stars') ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
          )}>
            <input
              type="checkbox"
              checked={form.eval_types.includes('stars')}
              onChange={() => toggleEvalType('stars')}
              className="accent-primary-500 flex-shrink-0 w-4 h-4"
            />
            <div>
              <p className="text-sm font-semibold text-secondary-800">Étoilée</p>
              <p className="text-xs text-warm-400">0 à 5 étoiles · par tranche de 0,5</p>
            </div>
          </label>

        </div>
      </div>

      {/* ── Modale Vacances scolaires ──────────────────────────────────────── */}
      {showVacModal && weeks.length > 0 && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-fade-in flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-warm-100">
              <div>
                <h2 className="text-base font-bold text-secondary-800">Vacances scolaires</h2>
                <p className="text-xs text-warm-500 mt-0.5">
                  {vacationMondaySet.size > 0
                    ? `${vacationMondaySet.size} semaine${vacationMondaySet.size > 1 ? 's' : ''} sélectionnée${vacationMondaySet.size > 1 ? 's' : ''}`
                    : 'Cliquez sur une semaine pour la marquer en vacances'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVacModal(false)}
                className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body — grille 3 colonnes de mois */}
            <div className="p-4 overflow-y-auto">
              {(() => {
                const monthGroups: { month: number; year: number; weeks: WeekInfo[] }[] = []
                for (const w of weeks) {
                  const m = w.monday.getMonth()
                  const y = w.monday.getFullYear()
                  const last = monthGroups[monthGroups.length - 1]
                  if (last && last.month === m && last.year === y) {
                    last.weeks.push(w)
                  } else {
                    monthGroups.push({ month: m, year: y, weeks: [w] })
                  }
                }

                return (
                  <div className="grid grid-cols-4 gap-2">
                    {monthGroups.map(group => (
                      <div key={`${group.year}-${group.month}`} className="border border-warm-100 rounded-xl p-2">
                        <p className="text-[11px] font-bold text-secondary-700 uppercase tracking-wide mb-1.5 text-center">
                          {MONTH_NAMES[group.month].slice(0, 4)}. {group.year}
                        </p>
                        <div className="space-y-1">
                          {group.weeks.map(w => {
                            const mondayISO = toISO(w.monday)
                            const isVac = vacationMondaySet.has(mondayISO)

                            return (
                              <button
                                key={mondayISO}
                                type="button"
                                onClick={() => toggleWeekVacation(w.monday)}
                                className={clsx(
                                  'w-full flex items-center justify-between px-2 py-1 rounded-md border text-[11px] transition-colors',
                                  isVac
                                    ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
                                    : 'bg-white border-warm-150 text-warm-600 hover:bg-warm-50 hover:border-warm-300'
                                )}
                              >
                                <span className="font-semibold">S{w.weekNum}</span>
                                <span className="opacity-70">
                                  {fmtShort(w.monday)}–{fmtShort(w.sunday)}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Nommage des périodes */}
              {vacations.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-warm-500 uppercase tracking-wide">Périodes de vacances</p>
                  {vacations.map(v => {
                    const start = new Date(v.start_date + 'T00:00:00')
                    const end = new Date(v.end_date + 'T00:00:00')
                    const groupKey = toISO(getWeekStart(start, wsd))
                    const isEditingThis = editingVacLabel === groupKey

                    if (isEditingThis) {
                      return (
                        <div key={v.start_date} className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <span className="text-xs text-warm-500 whitespace-nowrap">{fmtShort(start)}–{fmtShort(end)}</span>
                          <input
                            type="text"
                            value={vacLabelDraft}
                            onChange={e => setVacLabelDraft(e.target.value)}
                            placeholder="ex. Vacances de Toussaint"
                            className="input text-xs flex-1 py-1"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveVacLabel(groupKey, vacLabelDraft) }
                              if (e.key === 'Escape') setEditingVacLabel(null)
                            }}
                          />
                          <button type="button" onClick={() => saveVacLabel(groupKey, vacLabelDraft)} className="btn btn-primary text-xs px-2 py-1">OK</button>
                          <button type="button" onClick={() => setEditingVacLabel(null)} className="btn btn-secondary text-xs px-2 py-1">Annuler</button>
                        </div>
                      )
                    }

                    return (
                      <div key={v.start_date} className="flex items-center gap-2 px-2 py-1.5 bg-amber-50/60 border border-amber-100 rounded-lg">
                        <span className="text-xs font-medium text-amber-800 flex-1">
                          {v.label || <span className="text-warm-400 italic">Sans nom</span>}
                        </span>
                        <span className="text-[11px] text-warm-500">{fmtShort(start)}–{fmtShort(end)}</span>
                        <button
                          type="button"
                          onClick={() => { setEditingVacLabel(groupKey); setVacLabelDraft(v.label) }}
                          className="p-0.5 text-warm-400 hover:text-secondary-700 rounded transition-colors"
                          title="Renommer"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-5 py-3 border-t border-warm-100">
              <button
                type="button"
                onClick={() => setShowVacModal(false)}
                className="btn btn-primary"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
      document.body)}

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          Année scolaire enregistrée.
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <button
          type="submit"
          disabled={isSubmitting}
          className={clsx('btn btn-primary', isSubmitting && 'opacity-50 cursor-not-allowed')}
        >
          {isSubmitting ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Créer l\'année'}
        </button>
      </div>

    </form>
  )
}
