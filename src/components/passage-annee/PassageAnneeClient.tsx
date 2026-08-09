'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Tooltip from '@/components/ui/Tooltip'
import { useToast } from '@/lib/toast-context'
import { CLOSURE_STEPS } from '@/lib/closure/steps'
import type { AuditResult } from '@/lib/closure/audits'
import { runAudit, closeYear, reopenYear, archiveYear, setPurgeIntent } from '@/app/dashboard/passage-annee/actions'

export interface AnneeEtat {
  id: string
  label: string
  startDate: string | null
  endDate: string | null
  closedAt: string | null
  closedByNom: string | null
  archivedAt: string | null
  purgedAt: string | null
  purgeIntent: 'purge' | 'keep' | null
}

interface AuditRow {
  stepKey: string
  anomalies: number
  recap: AuditResult | null
  auditedAt: string
}

interface AnneePrecedente {
  id: string
  label: string
  closedAt: string | null
  archivedAt: string | null
  purgedAt: string | null
}

/** Date du jour en composantes LOCALES : `toISOString` bascule en UTC et peut rendre la veille. */
function aujourdhui(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function jour(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function horodate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function PassageAnneeClient({
  annee, audits, precedentes,
}: {
  annee: AnneeEtat
  audits: AuditRow[]
  precedentes: AnneePrecedente[]
}) {
  const router = useRouter()
  const toast  = useToast()

  // Dernier résultat connu de chaque audit. Il sert l'écran ; il ne décide rien.
  const [resultats, setResultats] = useState<Record<string, { result: AuditResult | null; at: string }>>(
    Object.fromEntries(audits.map(a => [a.stepKey, { result: a.recap, at: a.auditedAt }]))
  )
  const [enCours, setEnCours]   = useState<string | null>(null)
  const [deplie, setDeplie]     = useState<Record<string, boolean>>({})
  const [modale, setModale]     = useState<null | 'cloture' | 'annulation'>(null)
  const [occupe, setOccupe]     = useState(false)

  const lancer = async (stepKey: string) => {
    setEnCours(stepKey)
    try {
      const res = await runAudit(annee.id, stepKey)
      if (res.error) { toast.error(res.error); return }
      setResultats(prev => ({ ...prev, [stepKey]: { result: res.result ?? null, at: new Date().toISOString() } }))
    } catch (e: any) {
      toast.error(e?.message ?? 'Une erreur est survenue.')
    } finally {
      setEnCours(null)
    }
  }

  // ── Conditions de clôture ────────────────────────────────────────────────
  // Elles se DISENT toutes les trois, y compris quand elles sont remplies : un
  // bouton grisé sans motif ne s'explique pas.
  const dateOk    = !!annee.endDate && aujourdhui() > annee.endDate
  const auditsOk  = CLOSURE_STEPS.every(s => resultats[s.key])
  const bloquants = CLOSURE_STEPS.filter(s => s.blocking && (resultats[s.key]?.result?.anomalies ?? 0) > 0)
  const closable  = dateOk && auditsOk && bloquants.length === 0

  const clore = async () => {
    setOccupe(true)
    try {
      const res = await closeYear(annee.id)
      if (res.error) {
        toast.error(res.bloquants?.length ? `${res.error} ${res.bloquants.join(' · ')}` : res.error)
        return
      }
      setModale(null)
      toast.success(`Année ${annee.label} clôturée.`)
      router.refresh()
    } finally { setOccupe(false) }
  }

  const annulerCloture = async () => {
    setOccupe(true)
    try {
      const res = await reopenYear(annee.id)
      if (res.error) { toast.error(res.error); return }
      setModale(null)
      toast.success('Clôture annulée.')
      router.refresh()
    } finally { setOccupe(false) }
  }

  const archiver = async (yearId: string, label: string) => {
    setOccupe(true)
    try {
      const res = await archiveYear(yearId)
      if (res.error) { toast.error(res.error); return }
      toast.success(`Année ${label} archivée : ${res.students ?? 0} participant(s), ${res.families ?? 0} foyer(s).`)
      router.refresh()
    } finally { setOccupe(false) }
  }

  const choisirEpuration = async (intent: 'purge' | 'keep') => {
    setOccupe(true)
    try {
      const res = await setPurgeIntent(annee.id, intent)
      if (res.error) { toast.error(res.error); return }
      router.refresh()
    } finally { setOccupe(false) }
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Bandeau : l'année et son état ── */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="stat-label">Année en cours</p>
          <p className="text-lg font-bold text-secondary-800 leading-tight">{annee.label}</p>
          {annee.startDate && annee.endDate && (
            <p className="text-xs text-warm-700">Du {jour(annee.startDate)} au {jour(annee.endDate)}</p>
          )}
        </div>
        <div className="text-right">
          {annee.purgedAt ? (
            <span className="inline-block px-2 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700">Purgée</span>
          ) : annee.archivedAt ? (
            <span className="inline-block px-2 py-1 rounded-lg text-xs font-semibold bg-primary-100 text-primary-700">Close et archivée</span>
          ) : annee.closedAt ? (
            <span className="inline-block px-2 py-1 rounded-lg text-xs font-semibold bg-primary-100 text-primary-700">Close</span>
          ) : (
            <span className="inline-block px-2 py-1 rounded-lg text-xs font-semibold bg-warm-100 text-warm-700">En cours</span>
          )}
          {annee.closedAt && (
            <p className="mt-1 text-[11px] text-warm-700">
              Clôturée le {horodate(annee.closedAt)}{annee.closedByNom ? ` par ${annee.closedByNom}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Les audits ── */}
      <div className="card p-0">
        {/* Pas de « Tout auditer » : les audits se lancent un par un, pour qu'on
            lise le résultat de chacun avant de passer au suivant. */}
        <div className="px-4 py-3 border-b border-warm-200">
          <h2 className="text-sm font-bold text-secondary-800">Audits de l’année</h2>
          <p className="text-xs text-warm-700">
            Ils ne modifient rien et se relancent autant de fois que voulu. Le dernier résultat remplace le précédent.
          </p>
        </div>

        <ul className="divide-y divide-warm-100">
          {CLOSURE_STEPS.map(step => {
            const etat  = resultats[step.key]
            const res   = etat?.result ?? null
            const n     = res?.anomalies ?? 0
            const ouvert = !!deplie[step.key]

            return (
              <li key={step.key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-secondary-800">{step.label}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        step.blocking ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {step.blocking ? 'Bloquant' : 'Avertissement'}
                      </span>
                    </div>
                    <p className="text-xs text-warm-700">{step.description}</p>

                    {etat ? (
                      <p className={`mt-1 text-xs font-medium ${n > 0 ? 'text-orange-700' : 'text-primary-700'}`}>
                        {res?.summary ?? `${n} anomalie(s).`}
                        <span className="ml-2 font-normal text-warm-700">Audité le {horodate(etat.at)}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-warm-700">Jamais lancé.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {etat && (
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${
                        n > 0 ? 'bg-orange-100 text-orange-700' : 'bg-primary-100 text-primary-700'
                      }`}>
                        {n}
                      </span>
                    )}
                    <FloatButton
                      type="button"
                      variant="secondary"
                      onClick={() => lancer(step.key)}
                      disabled={!!enCours}
                    >
                      {enCours === step.key ? 'Audit…' : etat ? 'Relancer' : 'Auditer'}
                    </FloatButton>
                  </div>
                </div>

                {n > 0 && res && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setDeplie(p => ({ ...p, [step.key]: !ouvert }))}
                      aria-expanded={ouvert}
                      className="inline-flex items-center gap-1 text-xs font-medium text-warm-700 hover:text-secondary-700 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      {ouvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {ouvert ? 'Masquer le détail' : `Voir le détail (${res.items.length})`}
                    </button>

                    {ouvert && (
                      <ul className="mt-2 rounded-xl bg-warm-50 divide-y divide-warm-100 max-h-64 overflow-y-auto list-scroll">
                        {res.items.map((it, i) => (
                          <li key={i} className="px-3 py-1.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-secondary-800">{it.label}</span>
                              {it.className && (
                                <Tooltip content={it.classInfo ?? it.className} maxWidth="max-w-none">
                                  <span className="ml-2 text-[11px] text-warm-700 whitespace-nowrap">{it.className}</span>
                                </Tooltip>
                              )}
                              {it.detail && <span className="ml-2 text-[11px] text-warm-700">{it.detail}</span>}
                            </div>
                            {it.href && (
                              <Link
                                href={it.href}
                                className="text-[11px] font-medium text-primary-700 hover:underline shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                              >
                                Corriger
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Clôturer, ou défaire ── */}
      {!annee.closedAt ? (
        <div className="card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-secondary-800">Clôturer l’année</h2>
            <p className="text-xs text-warm-700">
              La clôture se défait tant que l’année n’a pas été purgée. La purge, elle, est sans retour.
            </p>
          </div>

          <ul className="space-y-1">
            <Condition ok={dateOk}>
              {annee.endDate
                ? dateOk
                  ? `L’année s’est terminée le ${jour(annee.endDate)}.`
                  : `L’année court jusqu’au ${jour(annee.endDate)}. La clôture sera possible le lendemain.`
                : 'Aucune date de fin renseignée pour cette année.'}
            </Condition>
            <Condition ok={auditsOk}>
              {auditsOk
                ? 'Les six audits ont été passés.'
                : `Audits restant à passer : ${CLOSURE_STEPS.filter(s => !resultats[s.key]).map(s => s.label).join(', ')}.`}
            </Condition>
            <Condition ok={bloquants.length === 0}>
              {bloquants.length === 0
                ? 'Aucune anomalie bloquante.'
                : `Anomalies bloquantes à résoudre : ${bloquants.map(s => s.label).join(', ')}.`}
            </Condition>
          </ul>

          <FloatButton type="button" variant="submit" disabled={!closable || occupe} onClick={() => setModale('cloture')}>
            Clôturer l’année
          </FloatButton>
        </div>
      ) : (
        <div className="card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-secondary-800">Année clôturée</h2>
            <p className="text-xs text-warm-700">
              Clôturée le {horodate(annee.closedAt)}{annee.closedByNom ? ` par ${annee.closedByNom}` : ''}.
            </p>
          </div>

          {/* Archivage : instantanés d’historique, prérequis absolu de la purge. */}
          {annee.archivedAt ? (
            <p className="text-xs text-primary-700 font-medium">
              Archivée le {horodate(annee.archivedAt)} · l’historique des participants et des foyers est figé.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-warm-700">
                L’archivage fige l’historique de chaque participant et de chaque foyer. Il se refait à volonté,
                et disparaît si vous annulez la clôture.
              </p>
              <FloatButton type="button" variant="submit" disabled={occupe} onClick={() => archiver(annee.id, annee.label)}>
                Archiver l’année
              </FloatButton>
            </div>
          )}

          {/* Choix d’épuration : simple drapeau, rien ne s’exécute tout seul. */}
          {annee.archivedAt && !annee.purgedAt && (
            <div className="pt-2 border-t border-warm-100 space-y-2">
              <p className="text-xs text-warm-700">
                Après la bascule sur l’année suivante, souhaitez-vous épurer les données de {annee.label} pour
                alléger la base ? Le choix est un simple repère : la purge reste manuelle, et se lance depuis la
                fiche de l’année.
              </p>
              <div className="flex flex-wrap gap-2">
                <FloatButton
                  type="button"
                  variant={annee.purgeIntent === 'purge' ? 'submit' : 'secondary'}
                  disabled={occupe}
                  onClick={() => choisirEpuration('purge')}
                >
                  Épurer plus tard
                </FloatButton>
                <FloatButton
                  type="button"
                  variant={annee.purgeIntent === 'keep' ? 'submit' : 'secondary'}
                  disabled={occupe}
                  onClick={() => choisirEpuration('keep')}
                >
                  Tout conserver
                </FloatButton>
              </div>
            </div>
          )}

          {!annee.purgedAt && (
            <div className="pt-2 border-t border-warm-100">
              <FloatButton type="button" variant="secondary" disabled={occupe} onClick={() => setModale('annulation')}>
                Annuler la clôture
              </FloatButton>
            </div>
          )}
        </div>
      )}

      {/* ── Années closes en attente d’archivage ── */}
      {precedentes.some(p => !p.archivedAt) && (
        <div className="card p-4 space-y-2">
          <h2 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-orange-500" />
            Années closes non archivées
          </h2>
          <p className="text-xs text-warm-700">
            Ces années ont été clôturées mais leur historique n’a jamais été figé. Sans archivage, elles ne
            peuvent pas être purgées.
          </p>
          <ul className="divide-y divide-warm-100">
            {precedentes.filter(p => !p.archivedAt).map(p => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-secondary-800">{p.label}</span>
                <FloatButton type="button" variant="secondary" disabled={occupe} onClick={() => archiver(p.id, p.label)}>
                  Archiver
                </FloatButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modale === 'cloture' && (
        <ConfirmModal
          title={`Clôturer l’année ${annee.label} ?`}
          confirmLabel={occupe ? 'Clôture…' : 'Clôturer'}
          confirmVariant="submit"
          confirmDisabled={occupe}
          onCancel={() => { if (!occupe) setModale(null) }}
          onConfirm={clore}
        >
          <p className="text-xs text-warm-700 text-left">
            Les six audits vont être repassés à l’instant : un résultat ancien n’autorise pas une clôture.
            L’action se défait tant que l’année n’a pas été purgée.
          </p>
        </ConfirmModal>
      )}

      {modale === 'annulation' && (
        <ConfirmModal
          title={`Annuler la clôture de ${annee.label} ?`}
          confirmLabel={occupe ? 'Annulation…' : 'Annuler la clôture'}
          confirmColor="amber"
          confirmDisabled={occupe}
          onCancel={() => { if (!occupe) setModale(null) }}
          onConfirm={annulerCloture}
        >
          <p className="text-xs text-warm-700 text-left">
            L’année redevient modifiable. <strong>L’archive est supprimée</strong> : garder un historique figé
            au-dessus de données redevenues vivantes le rendrait faux. Elle se régénère au prochain archivage.
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}

/** Ligne de condition : remplie ou non, et pourquoi. */
function Condition({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span className={`mt-0.5 shrink-0 ${ok ? 'text-primary-600' : 'text-orange-600'}`}>
        {ok ? <Check size={14} /> : <X size={14} />}
      </span>
      <span className={ok ? 'text-warm-700' : 'text-secondary-800 font-medium'}>{children}</span>
    </li>
  )
}
