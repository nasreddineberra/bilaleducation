'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Puce, type Ton } from '@/components/dashboard/tdb'
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

// Memes tons que les types d'evaluation des Gabarits (`Puce`).
const EVAL_LABELS: Record<string, { label: string; detail: string; ton: Ton }> = {
  diagnostic: { label: 'Diagnostique', detail: 'AC · EC · NA', ton: 'info' },
  scored:     { label: 'Notée',        detail: '',             ton: 'ok' },
  stars:      { label: 'Étoilée',      detail: '0-5 ★',        ton: 'attente' },
}

function EvalBadge({ config }: { config: EvalTypeConfig }) {
  const info   = EVAL_LABELS[config.eval_type]
  const detail = config.eval_type === 'scored' ? `/${config.max_score}` : info.detail
  return <Puce ton={info.ton}>{info.label}{detail && ` ${detail}`}</Puce>
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
      const res = await supabase.from('school_years').delete().eq('id', yearId).select('id')
      const echec = erreurEcriture(res, 'Cette année')
      if (echec) {
        if (res.error?.code === '23503') {
          setDeleteError('Impossible de supprimer : des données d\'évaluation sont liées à cette année.')
        } else {
          setDeleteError(echec)
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
        <div className="card text-center text-sm text-warm-700 py-10">Aucune année scolaire configurée.</div>
      )}

      {/* Tableau années */}
      {schoolYears.length > 0 && (
        <div className="liste">
          <table className="w-full text-xs" aria-label="Années scolaires">
            <thead>
              <tr className="liste-entete border-b border-[var(--card-border)]">
                <th className="list-th">Année</th>
                <th className="list-th">Rentrée</th>
                <th className="list-th">Fin</th>
                <th className="list-th">Répartition</th>
                <th className="list-th">Évaluation</th>
                <th className="list-th whitespace-nowrap">Clôture</th>
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
                    className={`cursor-pointer transition-colors ${year.is_current ? 'ligne-active' : ''}`}
                  >
                    {/* Année */}
                    <td className="list-td whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/annee-scolaire/${year.id}`}
                          onClick={e => e.stopPropagation()}
                          className="list-name text-secondary-800 hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                        >
                          {year.label}
                        </Link>
                        {year.is_current && (
                          <Puce ton="ok">En cours</Puce>
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
                            // Vert de marque UNIQUEMENT pour la periode en cours de l'annee en cours.
                            <Puce key={p.id} ton={year.is_current && p.is_current ? 'ok' : 'neutre'}>{p.label}</Puce>
                          ))}
                      </div>
                    </td>

                    {/* Évaluation */}
                    <td className="list-td">
                      <div className="flex items-center gap-1">
                        {activeEvals.map(c => <EvalBadge key={c.id} config={c} />)}
                      </div>
                    </td>

                    {/* Clôture : l'état le plus avancé atteint par l'année.
                        Purgée l'emporte sur archivée, qui l'emporte sur close. */}
                    <td className="list-td whitespace-nowrap">
                      {year.purged_at ? (
                        <Tooltip content={`Purgée le ${fmtDate(year.purged_at)}`}>
                          <span><Puce ton="danger">Purgée</Puce></span>
                        </Tooltip>
                      ) : year.archived_at ? (
                        <Tooltip content={`Close le ${fmtDate(year.closed_at!)} · archivée le ${fmtDate(year.archived_at)}`}>
                          <span><Puce ton="ok">Archivée</Puce></span>
                        </Tooltip>
                      ) : year.closed_at ? (
                        <Tooltip content={`Close le ${fmtDate(year.closed_at)}`}>
                          <span><Puce ton="ok">Close</Puce></span>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-warm-700">·</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="list-td text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {(
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip content="Modifier">
                            <button
                              onClick={() => router.push(`/dashboard/annee-scolaire/${year.id}`)}
                              aria-label={`Modifier ${year.label}`}
                              className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-focus)]"
                            >
                              <Pencil size={13} />
                            </button>
                          </Tooltip>
                          {!year.is_current && (
                            <Tooltip content="Supprimer">
                              <button
                                onClick={() => { setConfirmDeleteId(year.id); setDeleteError(null) }}
                                aria-label={`Supprimer ${year.label}`}
                                className="p-1.5 text-warm-700 hover:text-red-700 hover:bg-red-50 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
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

      {/* Suppression : confirmation en modale (charte), et non en ligne. */}
      {confirmDeleteId && (() => {
        const year = schoolYears.find(y => y.id === confirmDeleteId)
        return (
          <ConfirmModal
            open
            variant="danger"
            confirmColor="red"
            title="Supprimer l'année scolaire"
            confirmLabel={isDeleting ? 'Suppression…' : 'Supprimer définitivement'}
            confirmDisabled={isDeleting}
            onConfirm={() => handleDelete(confirmDeleteId)}
            onCancel={() => setConfirmDeleteId(null)}
          >
            <p className="text-sm text-warm-700">Année {year?.label ?? ''}</p>
          </ConfirmModal>
        )
      })()}

    </div>
  )
}
