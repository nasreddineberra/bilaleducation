'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Plus, X } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { SchoolYear, EvalTypeConfig, PeriodType } from '@/types/database'

// ─── Types internes ───────────────────────────────────────────────────────────

interface SchoolYearFormProps {
  schoolYear?:      SchoolYear & { eval_type_configs: EvalTypeConfig[] }
  etablissementId?: string   // requis pour la création
}

// Type frontend uniquement : scored_10 / scored_20 remplacent "scored" + max_score
type FormEvalType = 'diagnostic' | 'scored_10' | 'scored_20' | 'stars'

type FormData = {
  label:               string
  is_current:          boolean
  period_type:         PeriodType
  eval_types:          FormEvalType[]
  diagnostic_options:  string[]
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

// ─── Composant ────────────────────────────────────────────────────────────────

export default function SchoolYearForm({ schoolYear, etablissementId }: SchoolYearFormProps) {
  const router    = useRouter()
  const isEditing = !!schoolYear

  const getInitialForm = (): FormData => {
    if (!schoolYear) {
      return {
        label:              suggestNextLabel(),
        is_current:         false,
        period_type:        'trimestrial',
        eval_types:         [],
        diagnostic_options: ['AC', 'EC', 'NA'],
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
      is_current:         schoolYear.is_current,
      period_type:        schoolYear.period_type,
      eval_types:         activeTypes,
      diagnostic_options: diagnosticConfig?.diagnostic_options?.length
        ? diagnosticConfig.diagnostic_options
        : ['AC', 'EC', 'NA'],
    }
  }

  const [form,         setForm]         = useState<FormData>(getInitialForm)
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

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

  const updateDiagnosticOption = (index: number, value: string) =>
    setForm(prev => {
      const opts = [...prev.diagnostic_options]
      opts[index] = value
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
      diagnostic_options: [...prev.diagnostic_options, ''],
    }))

  const vLabel  = !isValidLabel(form.label)
  const vNoEval = form.eval_types.length === 0
  const isValid = !vLabel && !vNoEval

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(['label']))
    setHasSubmitted(true)
    setError(null)
    setSuccess(false)

    if (!isValid) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // 1. Insérer ou mettre à jour l'année scolaire
      let yearId: string

      if (isEditing) {
        const { error: errUpd } = await supabase
          .from('school_years')
          .update({ label: form.label.trim(), is_current: form.is_current, period_type: form.period_type })
          .eq('id', schoolYear.id)
        if (errUpd) throw errUpd
        yearId = schoolYear.id
      } else {
        const { data: newYear, error: errIns } = await supabase
          .from('school_years')
          .insert({
            etablissement_id: etablissementId ?? schoolYear?.etablissement_id,
            label:            form.label.trim(),
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

      // 3. Réinitialiser et recréer les périodes
      await supabase.from('periods').delete().eq('school_year_id', yearId)
      const periodsToInsert = periodsForType(form.period_type).map(p => ({
        school_year_id: yearId,
        label:          p.label,
        order_index:    p.order_index,
      }))
      const { error: errPeriods } = await supabase.from('periods').insert(periodsToInsert)
      if (errPeriods) throw errPeriods

      // 4. Réinitialiser et recréer les configs d'évaluation (multiple types actifs)
      await supabase.from('eval_type_configs').delete().eq('school_year_id', yearId)
      if (form.eval_types.length > 0) {
        const evalInserts = form.eval_types.map(type => ({
          school_year_id:     yearId,
          eval_type:          type === 'scored_10' || type === 'scored_20' ? 'scored' : type,
          is_active:          true,
          max_score:          type === 'scored_10' ? 10 : type === 'scored_20' ? 20 : null,
          diagnostic_options: type === 'diagnostic'
            ? form.diagnostic_options.map(o => o.trim()).filter(Boolean)
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
    <form onSubmit={handleSubmit} noValidate className="space-y-3 max-w-2xl">

      {/* ── Libellé + En cours ─────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
          Année scolaire
        </h2>

        <div className="grid grid-cols-2 gap-3 items-end">

          {/* Libellé */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
              Libellé <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="ex. 2025-2026"
              value={form.label}
              onChange={e => set('label', e.target.value)}
              onBlur={() => touch('label')}
              disabled={isEditing}
              className={clsx(
                'input',
                touched.has('label') && vLabel && 'input-error',
                isEditing && 'opacity-60 cursor-not-allowed'
              )}
            />
            {touched.has('label') && vLabel && (
              <p className="text-xs text-red-500">Format attendu : AAAA-AAAA (ex. 2025-2026)</p>
            )}
          </div>

          {/* En cours */}
          <div className="flex items-center gap-2 pb-1.5">
            <input
              type="checkbox"
              id="is_current"
              checked={form.is_current}
              onChange={e => set('is_current', e.target.checked)}
              className="w-4 h-4 accent-primary-500"
            />
            <label htmlFor="is_current" className="text-sm text-secondary-700 cursor-pointer select-none">
              Définir comme année en cours
            </label>
          </div>
        </div>
      </div>

      {/* ── Répartition des périodes ───────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
          Répartition <span className="text-red-400">*</span>
        </h2>

        <div className="flex gap-6">
          {([
            { value: 'trimestrial', label: 'Trimestriel', sub: 'T1 · T2 · T3' },
            { value: 'semestrial',  label: 'Semestriel',  sub: 'S1 · S2' },
          ] as const).map(opt => (
            <label
              key={opt.value}
              className={clsx(
                'flex items-center gap-3 flex-1 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
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

      {/* ── Type d'évaluation ─────────────────────────────────────────────── */}
      <div className={clsx(
        'card p-4 space-y-3',
        vNoEval && hasSubmitted && 'ring-1 ring-red-300'
      )}>
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
          Type d'évaluation <span className="text-red-400">*</span>
        </h2>

        {vNoEval && hasSubmitted && (
          <p className="text-xs text-red-500">Sélectionnez au moins un type d'évaluation.</p>
        )}

        <div className="space-y-2">

          {/* Diagnostique */}
          <div className={clsx(
            'px-4 py-3 rounded-xl border transition-colors',
            form.eval_types.includes('diagnostic') ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white'
          )}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.eval_types.includes('diagnostic')}
                onChange={() => toggleEvalType('diagnostic')}
                className="accent-primary-500 flex-shrink-0 w-4 h-4"
              />
              <p className="text-sm font-semibold text-secondary-800">Évaluation diagnostique</p>
            </label>

            {form.eval_types.includes('diagnostic') && (
              <div className="mt-2 ml-7 space-y-1.5">
                {form.diagnostic_options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={opt}
                      onChange={e => updateDiagnosticOption(i, e.target.value)}
                      className="input text-sm py-1 w-28"
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
                  className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 mt-1"
                >
                  <Plus size={12} /> Ajouter une option
                </button>
              </div>
            )}
          </div>

          {/* Notée sur 10 */}
          <label className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
            form.eval_types.includes('scored_10') ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
          )}>
            <input
              type="checkbox"
              checked={form.eval_types.includes('scored_10')}
              onChange={() => toggleEvalType('scored_10')}
              className="accent-primary-500 flex-shrink-0 w-4 h-4"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-secondary-800">Évaluation notée sur 10</p>
              <p className="text-xs text-warm-400">Notes de 0 à 10</p>
            </div>
          </label>

          {/* Notée sur 20 */}
          <label className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
            form.eval_types.includes('scored_20') ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
          )}>
            <input
              type="checkbox"
              checked={form.eval_types.includes('scored_20')}
              onChange={() => toggleEvalType('scored_20')}
              className="accent-primary-500 flex-shrink-0 w-4 h-4"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-secondary-800">Évaluation notée sur 20</p>
              <p className="text-xs text-warm-400">Notes de 0 à 20</p>
            </div>
          </label>

          {/* Étoilée */}
          <label className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
            form.eval_types.includes('stars') ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
          )}>
            <input
              type="checkbox"
              checked={form.eval_types.includes('stars')}
              onChange={() => toggleEvalType('stars')}
              className="accent-primary-500 flex-shrink-0 w-4 h-4"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-secondary-800">Évaluation étoilée</p>
              <p className="text-xs text-warm-400">0 à 5 étoiles · par tranche de 0,5</p>
            </div>
          </label>

        </div>
      </div>

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
      <div className="flex justify-end pt-1">
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
