'use client'

import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import PeriodeCell from '@/components/scolarite/PeriodeCell'
import { Puce, type Ton } from '@/components/dashboard/tdb'

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

// Pastilles d'etat de la charte (`Puce`), comme l'Historique de l'apprenant.
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
const STATUS_TON: Record<string, Ton> = { active: 'ok', withdrawn: 'danger' }

// « AAAA-MM-JJ » -> « JJ/MM/AAAA » par decoupage (pas de `new Date`, lu en UTC).
const dateFr = (d: string) => d.slice(0, 10).split('-').reverse().join('/')

/** « NOM Prenom » + pastille « Tuteur N » : qui, dans le foyer. */
function Tuteur({ nom, numero }: { nom: string; numero: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold text-secondary-800">{nom}</span>
      {numero && <Puce ton="neutre">Tuteur {numero}</Puce>}
    </span>
  )
}

interface TuteurNonAffecte { tutor_number: number; last_name: string; first_name: string }

export default function ParentAdultHistory({
  rows, current = [], nonAffectes = [],
}: {
  rows: AdultRow[]
  current?: CurrentRow[]
  nonAffectes?: TuteurNonAffecte[]
}) {
  const supabase = createClient()
  // Bucket privé : URL signée à la demande. Onglet ouvert AVANT l'await (popup), puis redirigé.
  const openBulletin = async (fp: string) => {
    const w = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('bulletins').createSignedUrl(fp, 60)
    if (error || !data?.signedUrl) { w?.close(); return }
    if (w) w.location.href = data.signedUrl
    else window.open(data.signedUrl, '_blank')
  }

  if (rows.length === 0 && current.length === 0 && nonAffectes.length === 0) {
    return (
      <div className="card p-6 text-center">
        {/* On arrive ici quand AUCUN tuteur n'est meme inscrit aux cours adultes.
            Le cas « inscrit mais non affecte » est traite plus bas, nomme. */}
        <p className="text-sm text-secondary-800">Aucun tuteur inscrit aux cours adultes.</p>
        <p className="mt-1 text-xs text-warm-700">
          Cochez « Inscrit aux cours adultes » sur l’onglet Identité, puis affectez le tuteur à une classe.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">

      {/* ── Inscrits aux cours adultes, mais affectés à aucune classe ──
          Une ligne par tuteur concerné : le foyer peut en compter deux, et un
          seul des deux peut être dans ce cas. Le message NOMME la personne,
          sans quoi on ne saurait pas de qui il parle. */}
      {nonAffectes.length > 0 && (
        <section className="card p-3 space-y-1">
          <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">Aucune affectation à un cours adultes</h2>
          <ul className="space-y-1">
            {nonAffectes.map(t => (
              <li key={t.tutor_number} className="text-xs text-warm-700">
                <Tuteur nom={`${t.last_name} ${t.first_name}`} numero={t.tutor_number} />
                {' · '}inscrit aux cours adultes, en attente d’affectation à une classe.
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Année en cours ── */}
      {current.map(h => {
        // Infos de classe : au niveau de l'année, sur une seule ligne.
        const infosClasse = [
          h.level ? `Niveau ${h.level}` : null,
          h.teacher_name,
          h.cotisation_label,
          h.schedule,
        ].filter(Boolean).join(' · ')

        return (
          <section key={h.key} className="card p-3 space-y-2">

            {/* Bandeau : annee et statut */}
            <div className="encadre-titre gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest">{h.year_label}</h2>
              <Puce ton={STATUS_TON[h.status] ?? 'neutre'}>{STATUS_LABEL[h.status] ?? h.status}</Puce>
            </div>

            {/* Tuteur, classe et ses infos ; affectation a droite */}
            <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-warm-700">
              <span className="inline-flex items-center gap-2 flex-wrap">
                <Tuteur nom={`${h.last_name} ${h.first_name}`} numero={h.tutor_number} />
                <span>
                  <span className="font-semibold text-secondary-800">Classe : {h.class_name}</span>
                  {infosClasse && <> · {infosClasse}</>}
                </span>
              </span>
              <span>Affecté le {dateFr(h.enrollment_date)}</span>
            </div>

            {/* Les periodes en COLONNES : 2 semestres ou 3 trimestres. */}
            {h.periods.length > 0 ? (
              <div className={clsx(
                'grid gap-2',
                h.periods.length === 2
                  ? 'grid-cols-1 lg:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
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
          <section key={h.id} className="card p-3 space-y-2">
            <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">{h.year_label}</h2>

            <div className="flex items-center gap-2 flex-wrap text-xs text-warm-700">
              <Tuteur nom={`${h.last_name} ${h.first_name}`} numero={h.tutor_number ?? null} />
              {h.class_name && (
                <span>
                  <span className="font-semibold text-secondary-800">Classe : {h.class_name}</span>
                  {infosClasse && <> · {infosClasse}</>}
                </span>
              )}
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
