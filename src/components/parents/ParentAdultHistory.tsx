'use client'

import { clsx } from 'clsx'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AdultRow {
  id: string
  year_label: string
  last_name: string
  first_name: string
  tutor_number: number | null
  class_name: string | null
  level: string | null
  cotisation_label: string | null
  moyenne_generale: number | null
  financial_status: string | null
  total_due: number | null
  total_paid: number | null
  bulletin_refs: { period_label: string; archive_id: string; file_path: string }[]
}

const FIN_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'En attente', color: 'bg-warm-100 text-warm-700' },
  partial:  { label: 'Partiel',    color: 'bg-orange-100 text-orange-700' },
  paid:     { label: 'Soldé',      color: 'bg-primary-100 text-primary-700' },
  overpaid: { label: 'Trop perçu', color: 'bg-red-100 text-red-700' },
}

function fmtEur(n: number | null): string {
  if (n == null) return '·'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default function ParentAdultHistory({ rows }: { rows: AdultRow[] }) {
  const supabase = createClient()
  const pdfUrl = (fp: string) => supabase.storage.from('bulletins').getPublicUrl(fp).data.publicUrl

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-warm-700">Aucun cours adulte archivé pour ce foyer.</p>
        <p className="text-xs text-warm-700 mt-1">L’historique se remplit à la clôture de chaque année scolaire.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {rows.map(h => {
        const fin = h.financial_status ? FIN_STATUS[h.financial_status] ?? FIN_STATUS.pending : null
        const classLine = [h.class_name, h.level ? `Niveau ${h.level}` : null, h.cotisation_label].filter(Boolean).join(' · ')
        return (
          <section key={h.id} className="card p-4 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-secondary-800">{h.year_label}</h3>
                <span className="text-sm font-semibold text-warm-800">{h.last_name} {h.first_name}</span>
                {h.tutor_number && (
                  <span className="text-[10px] font-bold uppercase bg-secondary-100 text-secondary-700 px-1.5 py-0.5 rounded">
                    Tuteur {h.tutor_number}
                  </span>
                )}
              </div>
              {classLine && <span className="text-xs text-warm-700">{classLine}</span>}
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <dt className="stat-label">Moyenne générale</dt>
                <dd className="text-sm font-bold text-secondary-800 tabular-nums">
                  {h.moyenne_generale != null ? `${h.moyenne_generale.toFixed(2)}/20` : '·'}
                </dd>
              </div>
              <div>
                <dt className="stat-label">Situation financière</dt>
                <dd>
                  {fin
                    ? <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase', fin.color)}>{fin.label}</span>
                    : <span className="text-sm text-warm-700">·</span>}
                </dd>
              </div>
              <div>
                <dt className="stat-label">Perçu / Dû</dt>
                <dd className="text-sm text-warm-700 tabular-nums">
                  <span className="text-primary-600 font-semibold">{fmtEur(h.total_paid)}</span> / {fmtEur(h.total_due)}
                </dd>
              </div>
            </dl>

            {h.bulletin_refs.length > 0 && (
              <div>
                <p className="stat-label mb-1">Bulletins</p>
                <div className="flex flex-wrap gap-1.5">
                  {h.bulletin_refs.map(b => (
                    <a
                      key={b.archive_id}
                      href={pdfUrl(b.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-warm-50 hover:bg-warm-100 rounded-lg px-2.5 py-1 text-xs text-primary-600 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      <FileText size={12} /> {b.period_label}
                    </a>
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
