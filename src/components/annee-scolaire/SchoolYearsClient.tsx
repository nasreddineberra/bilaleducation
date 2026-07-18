'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2, CalendarDays } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
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

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const EVAL_LABELS: Record<string, { label: string; detail: string }> = {
  diagnostic: { label: 'Diagnostique', detail: 'AC · EC · NA' },
  scored:     { label: 'Notée',        detail: '' },
  stars:      { label: 'Étoilée',      detail: '0-5 ★' },
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
    <div className="space-y-2 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex justify-end">
        <FloatButton type="button" variant="submit" onClick={() => router.push('/dashboard/annee-scolaire/new')}>
          Nouvelle année
        </FloatButton>
      </div>

      {/* Erreur suppression */}
      {deleteError && (
        <div role="alert" aria-live="assertive" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Liste vide */}
      {schoolYears.length === 0 && (
        <div className="card py-16 text-center">
          <CalendarDays size={32} className="mx-auto text-warm-700 mb-3" />
          <p className="text-warm-700 text-sm">Aucune année scolaire configurée</p>
          <p className="text-warm-700 text-xs mt-1">
            Cliquez sur "Nouvelle année" pour commencer
          </p>
        </div>
      )}

      {/* Tableau années */}
      {schoolYears.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-xs" aria-label="Années scolaires">
            <thead>
              <tr className="border-b border-warm-100 bg-warm-50">
                <th className="list-th">Année</th>
                <th className="list-th">Rentrée</th>
                <th className="list-th">Fin</th>
                <th className="list-th">Répartition</th>
                <th className="list-th">Évaluation</th>
                <th className="list-th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {schoolYears.map(year => {
                const activeEvals = year.eval_type_configs.filter(c => c.is_active)
                return (
                  <tr
                    key={year.id}
                    onClick={() => router.push(`/dashboard/annee-scolaire/${year.id}`)}
                    className={`cursor-pointer transition-colors ${year.is_current ? 'bg-primary-50/40' : 'hover:bg-warm-50/60'}`}
                  >
                    {/* Année */}
                    <td className="list-td whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/annee-scolaire/${year.id}`}
                          onClick={e => e.stopPropagation()}
                          className="list-name text-secondary-800 hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                        >
                          {year.label}
                        </Link>
                        {year.is_current && (
                          <span className="text-xs font-semibold bg-primary-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                            En cours
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Rentrée */}
                    <td className="list-td text-xs text-warm-700 whitespace-nowrap">
                      {year.start_date ? fmtDate(year.start_date) : '·'}
                    </td>

                    {/* Fin */}
                    <td className="list-td text-xs text-warm-700 whitespace-nowrap">
                      {year.end_date ? fmtDate(year.end_date) : '·'}
                    </td>

                    {/* Répartition + Périodes */}
                    <td className="list-td">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-warm-700">{PERIOD_LABELS[year.period_type]}</span>
                        {year.periods
                          .sort((a, b) => a.order_index - b.order_index)
                          .map(p => (
                            <span
                              key={p.id}
                              className={clsx(
                                'text-xs font-mono px-1.5 py-0.5 rounded',
                                // Turquoise UNIQUEMENT pour la periode en cours de l'annee en cours.
                                year.is_current && p.is_current
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-warm-100 text-warm-700',
                              )}
                            >
                              {p.label}
                            </span>
                          ))}
                      </div>
                    </td>

                    {/* Évaluation */}
                    <td className="list-td">
                      <div className="flex items-center gap-1">
                        {activeEvals.map(c => <EvalBadge key={c.id} config={c} />)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="list-td text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {confirmDeleteId === year.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs text-warm-700 mr-1">Supprimer ?</span>
                          <button
                            onClick={() => handleDelete(year.id)}
                            disabled={isDeleting}
                            className="text-xs font-medium px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                          >
                            {isDeleting ? '...' : 'Confirmer'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs font-medium px-2 py-0.5 bg-warm-100 text-warm-700 rounded hover:bg-warm-200 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-warm-400/50"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip content="Modifier">
                            <button
                              onClick={() => router.push(`/dashboard/annee-scolaire/${year.id}`)}
                              aria-label={`Modifier ${year.label}`}
                              className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                            >
                              <Pencil size={13} />
                            </button>
                          </Tooltip>
                          {!year.is_current && (
                            <Tooltip content="Supprimer">
                              <button
                                onClick={() => { setConfirmDeleteId(year.id); setDeleteError(null) }}
                                aria-label={`Supprimer ${year.label}`}
                                className="p-1.5 text-warm-700 hover:text-red-600 hover:bg-red-50 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                              >
                                <Trash2 size={13} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
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
