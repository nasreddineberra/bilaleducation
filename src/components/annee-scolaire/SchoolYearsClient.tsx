'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Star, Hash, Activity, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SchoolYear, EvalTypeConfig, Period } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type SchoolYearFull = SchoolYear & {
  periods:          Period[]
  eval_type_configs: EvalTypeConfig[]
}

interface SchoolYearsClientProps {
  schoolYears: SchoolYearFull[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  trimestrial: 'Trimestriel',
  semestrial:  'Semestriel',
}

const EVAL_LABELS: Record<string, { label: string; detail: string }> = {
  diagnostic: { label: 'Diagnostique', detail: 'AC · EC · NA' },
  scored:     { label: 'Notée',        detail: '' },
  stars:      { label: 'Étoilée',      detail: '0–5 ★' },
}

function EvalBadge({ config }: { config: EvalTypeConfig }) {
  const info   = EVAL_LABELS[config.eval_type]
  const detail = config.eval_type === 'scored' ? `/${config.max_score}` : info.detail
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-full">
      {info.label}{detail && <span className="text-primary-500">{detail}</span>}
    </span>
  )
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function SchoolYearsClient({ schoolYears }: SchoolYearsClientProps) {
  const router = useRouter()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting,      setIsDeleting]      = useState(false)
  const [deleteError,     setDeleteError]     = useState<string | null>(null)

  const handleDelete = async (yearId: string) => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('school_years').delete().eq('id', yearId)
      if (error) {
        if (error.code === '23503') {
          setDeleteError('Impossible de supprimer : des données d\'évaluation sont liées à cette année.')
        } else {
          setDeleteError('Une erreur est survenue lors de la suppression.')
        }
        setConfirmDeleteId(null)
        return
      }
      setConfirmDeleteId(null)
      router.refresh()
    } catch {
      setDeleteError('Une erreur est survenue lors de la suppression.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex justify-end">
        <button
          onClick={() => router.push('/dashboard/annee-scolaire/new')}
          className="btn btn-primary"
        >
          + Nouvelle année
        </button>
      </div>

      {/* Erreur suppression */}
      {deleteError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Liste vide */}
      {schoolYears.length === 0 && (
        <div className="card py-16 text-center">
          <CalendarDays size={32} className="mx-auto text-warm-300 mb-3" />
          <p className="text-warm-400 text-sm">Aucune année scolaire configurée</p>
          <p className="text-warm-300 text-xs mt-1">
            Cliquez sur "Nouvelle année" pour commencer
          </p>
        </div>
      )}

      {/* Cards années */}
      <div className="space-y-3">
        {schoolYears.map(year => (
          <div
            key={year.id}
            className={`card p-4 ${year.is_current ? 'ring-2 ring-primary-400' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">

              {/* Infos principales */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-secondary-800">{year.label}</span>
                  {year.is_current && (
                    <span className="text-xs font-semibold bg-primary-500 text-white px-2 py-0.5 rounded-full">
                      En cours
                    </span>
                  )}
                  <span className="text-xs text-warm-400 bg-warm-100 px-2 py-0.5 rounded-full">
                    {PERIOD_LABELS[year.period_type]}
                  </span>
                </div>

                {/* Périodes */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs text-warm-400">Périodes :</span>
                  {year.periods
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(p => (
                      <span key={p.id} className="text-xs font-mono bg-warm-100 text-warm-600 px-1.5 py-0.5 rounded">
                        {p.label}
                      </span>
                    ))}
                </div>

                {/* Types d'évaluation */}
                {year.eval_type_configs.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-xs text-warm-400">Évaluations :</span>
                    {year.eval_type_configs
                      .filter(c => c.is_active)
                      .map(c => <EvalBadge key={c.id} config={c} />)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {confirmDeleteId === year.id ? (
                  <>
                    <span className="text-xs text-warm-500 mr-1">Supprimer ?</span>
                    <button
                      onClick={() => handleDelete(year.id)}
                      disabled={isDeleting}
                      className="text-xs font-medium px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {isDeleting ? '...' : 'Confirmer'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs font-medium px-2.5 py-1 bg-warm-100 text-warm-600 rounded-lg hover:bg-warm-200 transition-colors"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => router.push(`/dashboard/annee-scolaire/${year.id}`)}
                      className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    {!year.is_current && (
                      <button
                        onClick={() => { setConfirmDeleteId(year.id); setDeleteError(null) }}
                        className="p-1.5 text-warm-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
