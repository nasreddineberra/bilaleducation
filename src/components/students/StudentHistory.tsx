'use client'

import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Puce, type Ton } from '@/components/dashboard/tdb'

interface HistoryRow {
  id: string
  year_label: string
  class_name: string | null
  level: string | null
  cotisation_label: string | null
  moyenne_generale: number | null
  absences_justified: number
  absences_unjustified: number
  financial_status: string | null
  total_due: number | null
  total_paid: number | null
  bulletin_refs: { period_label: string; archive_id: string; file_path: string }[]
}

// Pastilles d'etat de la charte (`Puce`).
const FIN_STATUS: Record<string, { label: string; ton: Ton }> = {
  pending:  { label: 'En attente', ton: 'neutre' },
  partial:  { label: 'Partiel',    ton: 'orange' },
  paid:     { label: 'Soldé',      ton: 'ok' },
  overpaid: { label: 'Trop perçu', ton: 'danger' },
}

function fmtEur(n: number | null): string {
  if (n == null) return '·'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default function StudentHistory({ history }: { history: HistoryRow[] }) {
  const supabase = createClient()
  // Bucket privé : URL signée à la demande. L'onglet est ouvert AVANT l'await
  // (sinon bloqué comme popup), puis redirigé.
  const openBulletin = async (fp: string) => {
    const w = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('bulletins').createSignedUrl(fp, 60)
    if (error || !data?.signedUrl) { w?.close(); return }
    if (w) w.location.href = data.signedUrl
    else window.open(data.signedUrl, '_blank')
  }

  if (history.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-warm-700">Aucune année archivée pour cet élève.</p>
        <p className="text-xs text-warm-700 mt-1">L’historique se remplit à la clôture de chaque année scolaire.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {history.map(h => {
        const fin = h.financial_status ? FIN_STATUS[h.financial_status] ?? FIN_STATUS.pending : null
        const classLine = [h.class_name, h.level ? `Niveau ${h.level}` : null, h.cotisation_label].filter(Boolean).join(' · ')
        return (
          <section key={h.id} className="card p-3 space-y-2">
            {/* Bandeau : annee, classe a droite */}
            <div className="encadre-titre justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-widest">{h.year_label}</h2>
              <span className="text-xs font-medium normal-case tracking-normal text-warm-700">{classLine || 'Non affecté'}</span>
            </div>

            {/* Chiffres */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <dt className="stat-label">Moyenne générale</dt>
                <dd className="text-sm font-bold text-secondary-800 tabular-nums">
                  {h.moyenne_generale != null ? `${h.moyenne_generale.toFixed(2)}/20` : '·'}
                </dd>
              </div>
              <div>
                <dt className="stat-label">Absences</dt>
                <dd className="text-sm text-warm-700 tabular-nums">
                  <span className="text-secondary-800 font-semibold">{h.absences_justified}</span> justifiée{h.absences_justified > 1 ? 's' : ''} ·{' '}
                  <span className="text-red-600 font-semibold">{h.absences_unjustified}</span> non justifiée{h.absences_unjustified > 1 ? 's' : ''}
                </dd>
              </div>
              <div>
                <dt className="stat-label">Situation financière</dt>
                <dd>
                  {fin
                    ? <Puce ton={fin.ton}>{fin.label}</Puce>
                    : <span className="text-sm text-warm-700">·</span>}
                </dd>
              </div>
              <div>
                <dt className="stat-label">Perçu / Dû</dt>
                <dd className="text-sm text-warm-700 tabular-nums">
                  <span className="text-secondary-800 font-semibold">{fmtEur(h.total_paid)}</span> / {fmtEur(h.total_due)}
                </dd>
              </div>
            </dl>

            {/* Bulletins PDF */}
            {h.bulletin_refs.length > 0 && (
              <div>
                <p className="stat-label mb-1">Bulletins</p>
                <div className="flex flex-wrap gap-1.5">
                  {h.bulletin_refs.map(b => (
                    <button
                      key={b.archive_id}
                      type="button"
                      onClick={() => openBulletin(b.file_path)}
                      className="inline-flex items-center gap-1 bg-[var(--brand-tint)] rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:underline transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                    >
                      <FileText size={12} aria-hidden="true" /> {b.period_label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
