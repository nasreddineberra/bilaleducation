'use client'

import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import PeriodeCell from '@/components/scolarite/PeriodeCell'

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

/**
 * Scolarité de l'année EN COURS : ce que les archives ne contiennent pas encore.
 * Structure IDENTIQUE à l'onglet Scolarité de l'apprenant — informations de classe
 * au niveau de l'année, puis une colonne par période.
 */
interface CurrentRow {
  key: string
  year_label: string
  status: string
  last_name: string
  first_name: string
  tutor_number: number
  class_name: string | null
  level: string | null
  cotisation_label: string | null
  teacher_name: string | null
  schedule: string | null
  enrollment_date: string
  totals: { abs: number; absNJ: number; retards: number }
  periods: {
    id: string
    label: string
    avg: number | null
    /** false = periode NON archivee : rien a afficher, et surtout pas un zero. */
    archive: boolean
    bulletinPath: string | null
    abs: number
    absNJ: number
    retards: number
  }[]
}

const STATUS_LABEL: Record<string, string> = { active: 'Actif', withdrawn: 'Retiré' }
const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  withdrawn: 'bg-red-100 text-red-700',
}

export default function ParentAdultHistory({ rows, current = [] }: { rows: AdultRow[]; current?: CurrentRow[] }) {
  const supabase = createClient()
  // Bucket privé : URL signée à la demande. Onglet ouvert AVANT l'await (popup), puis redirigé.
  const openBulletin = async (fp: string) => {
    const w = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('bulletins').createSignedUrl(fp, 60)
    if (error || !data?.signedUrl) { w?.close(); return }
    w ? (w.location.href = data.signedUrl) : window.open(data.signedUrl, '_blank')
  }

  if (rows.length === 0 && current.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-warm-700">Aucun cours adulte pour ce foyer.</p>
        <p className="text-xs text-warm-700 mt-1">
          Un tuteur inscrit à un cours adultes apparaît ici dès son affectation ; l’historique se complète à la
          clôture de chaque année scolaire.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">

      {/* ── Année en cours ── */}
      {current.map(h => {
        // Infos de classe : au niveau de l'année, sur une seule ligne.
        const infosClasse = [
          h.level ? `Niveau ${h.level}` : null,
          h.teacher_name,
          h.cotisation_label,
          h.schedule,
          `Inscrit le ${new Date(h.enrollment_date).toLocaleDateString('fr-FR')}`,
        ].filter(Boolean).join(' · ')

        return (
          <section key={h.key} className="card p-4 space-y-2">

            {/* En-tete : annee, statut, tuteur, classe, et le bilan d'assiduite */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-secondary-800">{h.year_label}</h3>
                <span className={clsx(
                  'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                  STATUS_COLOR[h.status] ?? 'bg-warm-100 text-warm-700',
                )}>
                  {STATUS_LABEL[h.status] ?? h.status}
                </span>
                <span className="text-sm font-semibold text-warm-800">{h.last_name} {h.first_name}</span>
                <span className="text-[10px] font-bold uppercase bg-secondary-100 text-secondary-700 px-1.5 py-0.5 rounded">
                  Tuteur {h.tutor_number}
                </span>
                <span className="text-xs text-warm-700">
                  <span className="font-semibold text-warm-800">Classe : {h.class_name}</span>
                  {infosClasse && <> · {infosClasse}</>}
                </span>
              </div>

              {(h.totals.abs > 0 || h.totals.retards > 0) && (
                <span className="text-xs text-warm-700">
                  {h.totals.abs > 0 && <>{h.totals.abs} abs.{h.totals.absNJ > 0 && ` (${h.totals.absNJ} nj)`}</>}
                  {h.totals.retards > 0 && <>{h.totals.abs > 0 ? ' · ' : ''}{h.totals.retards} ret.</>}
                </span>
              )}
            </div>

            {/* Les periodes en COLONNES : 2 semestres ou 3 trimestres. */}
            {h.periods.length > 0 ? (
              <div className={clsx(
                'grid gap-2',
                h.periods.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
              )}>
                {h.periods.map(p => (
                  <PeriodeCell
                    key={p.id}
                    label={p.label}
                    archived={p.archive}
                    moyenne={p.avg}
                    filePath={p.bulletinPath}
                    abs={p.abs}
                    absNJ={p.absNJ}
                    retards={p.retards}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-warm-700 italic">Aucune période configurée pour cette année.</p>
            )}
          </section>
        )
      })}

      {/* ── Années archivées ── */}
      {rows.map(h => {
        const fin = h.financial_status ? FIN_STATUS[h.financial_status] ?? FIN_STATUS.pending : null
        // Meme forme d'en-tete que l'annee en cours : « Classe : NOM · … ».
        // L'archive fige des LIBELLES, elle ne porte ni enseignant ni horaire.
        const infosClasse = [h.level ? `Niveau ${h.level}` : null, h.cotisation_label].filter(Boolean).join(' · ')
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
                {h.class_name && (
                  <span className="text-xs text-warm-700">
                    <span className="font-semibold text-warm-800">Classe : {h.class_name}</span>
                    {infosClasse && <> · {infosClasse}</>}
                  </span>
                )}
              </div>
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
                    <button
                      key={b.archive_id}
                      type="button"
                      onClick={() => openBulletin(b.file_path)}
                      className="inline-flex items-center gap-1 bg-warm-50 hover:bg-warm-100 rounded-lg px-2.5 py-1 text-xs text-primary-600 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      {b.period_label}
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
