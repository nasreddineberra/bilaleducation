'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { SchoolYear, EvalTypeConfig, EvalTypeKind, PeriodType } from '@/types/database'

// ─── Types internes ───────────────────────────────────────────────────────────

interface SchoolYearFormProps {
  schoolYear?:      SchoolYear & { eval_type_configs: EvalTypeConfig[] }
  etablissementId?: string   // requis pour la création
}

type FormData = {
  label:           string
  is_current:      boolean
  period_type:     PeriodType
  eval_type:       EvalTypeKind | null
  eval_scored_max: 10 | 20
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
        label:           suggestNextLabel(),
        is_current:      false,
        period_type:     'trimestrial',
        eval_type:       null,
        eval_scored_max: 20,
      }
    }
    const configs = schoolYear.eval_type_configs ?? []
    const active  = configs.find(c => c.is_active)
    const scored  = configs.find(c => c.eval_type === 'scored')
    return {
      label:           schoolYear.label,
      is_current:      schoolYear.is_current,
      period_type:     schoolYear.period_type,
      eval_type:       (active?.eval_type ?? null) as EvalTypeKind | null,
      eval_scored_max: (scored?.max_score === 10 ? 10 : 20),
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

  const vLabel  = !isValidLabel(form.label)
  const vNoEval = form.eval_type === null
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

      // 4. Réinitialiser et recréer la config d'évaluation (un seul type actif)
      await supabase.from('eval_type_configs').delete().eq('school_year_id', yearId)
      if (form.eval_type) {
        const { error: errEval } = await supabase.from('eval_type_configs').insert({
          school_year_id: yearId,
          eval_type:      form.eval_type,
          is_active:      true,
          max_score:      form.eval_type === 'scored' ? form.eval_scored_max : null,
        })
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
          <p className="text-xs text-red-500">Sélectionnez un type d'évaluation.</p>
        )}

        <div className="space-y-2">

          {/* Diagnostique */}
          <label className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
            form.eval_type === 'diagnostic' ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
          )}>
            <input
              type="radio"
              name="eval_type"
              checked={form.eval_type === 'diagnostic'}
              onChange={() => set('eval_type', 'diagnostic')}
              className="accent-primary-500 flex-shrink-0"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-secondary-800">Évaluation diagnostique</p>
              <p className="text-xs text-warm-400">AC · EC · NA</p>
            </div>
          </label>

          {/* Notée */}
          <div className={clsx(
            'px-4 py-3 rounded-xl border transition-colors',
            form.eval_type === 'scored' ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white'
          )}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="eval_type"
                checked={form.eval_type === 'scored'}
                onChange={() => set('eval_type', 'scored')}
                className="accent-primary-500 flex-shrink-0"
              />
              <p className="text-sm font-semibold text-secondary-800">Évaluation notée</p>
            </label>

            {form.eval_type === 'scored' && (
              <div className="mt-2 ml-7 flex gap-4">
                {([10, 20] as const).map(n => (
                  <label key={n} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="eval_scored_max"
                      checked={form.eval_scored_max === n}
                      onChange={() => set('eval_scored_max', n)}
                      className="accent-primary-500"
                    />
                    <span className="text-sm text-secondary-700">Sur {n}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Étoilée */}
          <label className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
            form.eval_type === 'stars' ? 'border-primary-400 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
          )}>
            <input
              type="radio"
              name="eval_type"
              checked={form.eval_type === 'stars'}
              onChange={() => set('eval_type', 'stars')}
              className="accent-primary-500 flex-shrink-0"
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
