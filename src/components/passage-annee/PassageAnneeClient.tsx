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
import { runAudit, resetAudit, closeYear, reopenYear, archiveYear, setPurgeIntent } from '@/app/dashboard/passage-annee/actions'

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

/**
 * PASSAGE D'ANNÉE — écran.
 *
 * MISE EN PAGE : deux colonnes, et tout doit tenir SANS barre de défilement de
 * page. D'où trois économies de hauteur : la description d'un audit s'efface dès
 * qu'un résultat la remplace (elle disait ce qu'on allait chercher, le résumé dit
 * ce qu'on a trouvé) ; le détail des anomalies s'ouvre en ACCORDÉON, un seul à la
 * fois ; et la liste d'anomalies défile dans son propre cadre.
 */
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
  const [enCours, setEnCours] = useState<string | null>(null)
  // ACCORDÉON : un seul détail ouvert. Deux listes d'anomalies dépliées feraient
  // déborder la page, et l'on compare mal deux listes longues côte à côte.
  const [detail, setDetail]   = useState<string | null>(null)
  const [modale, setModale]   = useState<null | 'cloture' | 'annulation'>(null)
  const [occupe, setOccupe]   = useState(false)

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

  const reinitialiser = async (stepKey: string) => {
    setEnCours(stepKey)
    try {
      const res = await resetAudit(annee.id, stepKey)
      if (res.error) { toast.error(res.error); return }
      setResultats(prev => {
        const suite = { ...prev }
        delete suite[stepKey]
        return suite
      })
      setDetail(d => (d === stepKey ? null : d))
    } catch (e: any) {
      toast.error(e?.message ?? 'Une erreur est survenue.')
    } finally {
      setEnCours(null)
    }
  }

  /**
   * DÉPENDANCE ENTRE AUDITS. Tout descend des affectations : un élève sans classe
   * n'a ni évaluation, ni absence, ni bulletin, ni cotisation facturée. Auditer
   * « Notes » avant d'avoir corrigé les affectations peut donc afficher zéro
   * anomalie et donner un FAUX FEU VERT, jusqu'à ce que les élèves affectés
   * fassent apparaître d'un coup leurs notes manquantes.
   *
   * On NE VERROUILLE PAS pour autant : le verrouillage séquentiel était le défaut
   * de l'ancien modèle, et il retirerait à cet écran sa raison d'être, qui est de
   * pouvoir consulter l'état de n'importe quel domaine à tout moment. On affiche
   * la dépendance au lieu de l'imposer : l'audit reste lançable, mais son résultat
   * est présenté comme « à revérifier ».
   */
  const bloqueurAmont = (ordre: number) => {
    for (const s of CLOSURE_STEPS) {
      if (s.order >= ordre) break
      if (!s.blocking) continue
      const etat = resultats[s.key]
      if (!etat || (etat.result?.anomalies ?? 0) > 0) return s
    }
    return null
  }

  /**
   * ANNÉE CLOSE : les audits se figent, la page reste vivante.
   *
   * `closeYear` repasse les six audits et réécrit leurs lignes ; les résultats
   * affichés sont donc LE CONSTAT AU MOMENT DE LA CLÔTURE. Les relancer les
   * écraserait, les réinitialiser les effacerait. Le reste de l'écran, lui, a
   * encore du travail : c'est d'ici qu'on archive, qu'on choisit l'épuration et
   * qu'on annule la clôture. Annuler rend les audits actionnables à nouveau.
   */
  const fige = !!annee.closedAt

  // ── Conditions de clôture ────────────────────────────────────────────────
  // Elles se DISENT toutes les trois, y compris remplies : un bouton grisé sans
  // motif ne s'explique pas.
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
    <div className="animate-fade-in flex flex-col xl:flex-row gap-3 items-start">

      {/* ═══ Colonne gauche : les audits ═══ */}
      <div className="card p-0 w-full xl:flex-1 xl:min-w-0">
        <div className="px-3 py-2 border-b border-warm-200">
          <h2 className="text-sm font-bold text-secondary-800">
            {fige ? `Constat à la clôture · ${annee.label}` : `Audits de l’année ${annee.label}`}
          </h2>
          {/* Pas de « Tout auditer » : on les lance un par un, pour lire chacun
              avant de passer au suivant. */}
          <p className="text-[11px] text-warm-700">
            {fige ? (
              <>
                Ces six résultats ont été recalculés au moment de la clôture : ils disent ce qui a été vérifié.
                Ils sont <strong>figés</strong> et le restent tant que la clôture n’est pas annulée.
              </>
            ) : (
              <>
                Ils ne modifient rien et se lancent un par un, dans l’ordre que vous voulez. Tant qu’un audit
                <strong> bloquant</strong> remonte des anomalies, ceux qui en dépendent sont signalés « à revérifier ».
              </>
            )}
          </p>
        </div>

        <ul className="divide-y divide-warm-100">
          {CLOSURE_STEPS.map(step => {
            const etat   = resultats[step.key]
            const res    = etat?.result ?? null
            const n      = res?.anomalies ?? 0
            const ouvert = detail === step.key
            const amont  = bloqueurAmont(step.order)
            // Un résultat calculé alors qu'un audit bloquant amont n'est pas résolu
            // ne vaut rien : grisé, jamais vert.
            const perime = !!amont && !!etat

            return (
              <li key={step.key} className="px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-secondary-800 truncate">{step.label}</h3>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                      step.blocking ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {step.blocking ? 'Bloquant' : 'Avertissement'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {etat && (
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${
                        perime ? 'bg-warm-100 text-warm-700' : n > 0 ? 'bg-orange-100 text-orange-700' : 'bg-primary-100 text-primary-700'
                      }`}>
                        {n}
                      </span>
                    )}

                    {/* Auditer, puis Réinitialiser, puis Auditer à nouveau : on efface
                        un résultat avant d'en calculer un neuf, plutôt que de le
                        remplacer sans qu'on l'ait vu partir. Rien de tout cela sur une
                        année close : le constat ne se retouche pas. */}
                    {!fige && (
                      <FloatButton
                        type="button"
                        variant="secondary"
                        disabled={!!enCours}
                        onClick={() => (etat ? reinitialiser(step.key) : lancer(step.key))}
                        className="!px-2 !py-0.5 !text-[11px] !rounded-lg"
                      >
                        {enCours === step.key
                          ? (etat ? 'Effacement…' : 'Audit…')
                          : (etat ? 'Réinitialiser' : 'Auditer')}
                      </FloatButton>
                    )}
                  </div>
                </div>

                {/* La description dit ce qu'on va chercher ; dès qu'un résultat
                    existe, il dit ce qu'on a trouvé et la remplace. */}
                {etat ? (
                  <p className={`text-[11px] leading-snug ${
                    perime ? 'text-warm-700' : n > 0 ? 'text-orange-700 font-medium' : 'text-primary-700 font-medium'
                  }`}>
                    {res?.summary ?? `${n} anomalie(s).`}
                    <span className="ml-1.5 font-normal text-warm-700">· {horodate(etat.at)}</span>
                    {perime && <span className="ml-1.5 font-semibold text-orange-700">· à revérifier</span>}
                  </p>
                ) : (
                  <p className="text-[11px] leading-snug text-warm-700">{step.description}</p>
                )}

                {amont && (
                  <p className="text-[11px] leading-snug text-orange-700">
                    Dépend de « {amont.label} », qui remonte encore des anomalies : {etat ? 'ce résultat est' : 'un résultat serait'} incomplet.
                  </p>
                )}

                {n > 0 && res && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDetail(d => (d === step.key ? null : step.key))}
                      aria-expanded={ouvert}
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-warm-700 hover:text-secondary-700 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      {ouvert ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      {ouvert ? 'Masquer le détail' : `Voir le détail (${res.items.length})`}
                    </button>

                    {ouvert && (
                      <ul className="mt-1 rounded-lg bg-warm-50 divide-y divide-warm-100 max-h-56 overflow-y-auto list-scroll">
                        {res.items.map((it, i) => (
                          <li key={i} className="px-2.5 py-1 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[11px] font-medium text-secondary-800">{it.label}</span>
                              {it.className && (
                                <Tooltip content={it.classInfo ?? it.className} maxWidth="max-w-none">
                                  <span className="ml-1.5 text-[11px] text-warm-700 whitespace-nowrap">{it.className}</span>
                                </Tooltip>
                              )}
                              {it.detail && <span className="ml-1.5 text-[11px] text-warm-700">{it.detail}</span>}
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
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* ═══ Colonne droite : l'année et son passage ═══ */}
      <div className="w-full xl:w-80 xl:shrink-0 space-y-3">

        <div className="card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="stat-label">Année en cours</p>
              <p className="text-base font-bold text-secondary-800 leading-tight">{annee.label}</p>
              {annee.startDate && annee.endDate && (
                <p className="text-[11px] text-warm-700">Du {jour(annee.startDate)} au {jour(annee.endDate)}</p>
              )}
            </div>
            <span className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold ${
              annee.purgedAt   ? 'bg-red-100 text-red-700'
              : annee.closedAt ? 'bg-primary-100 text-primary-700'
              : 'bg-warm-100 text-warm-700'
            }`}>
              {annee.purgedAt ? 'Purgée' : annee.archivedAt ? 'Close et archivée' : annee.closedAt ? 'Close' : 'En cours'}
            </span>
          </div>
        </div>

        {!annee.closedAt ? (
          <div className="card p-3 space-y-2">
            <div>
              <h2 className="text-sm font-bold text-secondary-800">Clôturer l’année</h2>
              <p className="text-[11px] text-warm-700 leading-snug">
                La clôture se défait tant que l’année n’a pas été purgée. La purge, elle, est sans retour.
              </p>
            </div>

            <ul className="space-y-1">
              <Condition ok={dateOk}>
                {annee.endDate
                  ? dateOk
                    ? `L’année s’est terminée le ${jour(annee.endDate)}.`
                    : `L’année court jusqu’au ${jour(annee.endDate)}. Clôture possible le lendemain.`
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
                  : `Anomalies bloquantes : ${bloquants.map(s => s.label).join(', ')}.`}
              </Condition>
            </ul>

            <FloatButton type="button" variant="submit" disabled={!closable || occupe} onClick={() => setModale('cloture')}>
              Clôturer l’année
            </FloatButton>
          </div>
        ) : (
          <div className="card p-3 space-y-2">
            <div>
              <h2 className="text-sm font-bold text-secondary-800">Année clôturée</h2>
              <p className="text-[11px] text-warm-700 leading-snug">
                Le {horodate(annee.closedAt)}{annee.closedByNom ? ` par ${annee.closedByNom}` : ''}.
              </p>
            </div>

            {/* Archivage : instantanés d'historique, prérequis absolu de la purge. */}
            {annee.archivedAt ? (
              <p className="text-[11px] text-primary-700 font-medium leading-snug">
                Archivée le {horodate(annee.archivedAt)} · l’historique des participants et des foyers est figé.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-warm-700 leading-snug">
                  L’archivage fige l’historique de chaque participant et de chaque foyer. Il se refait à volonté,
                  et disparaît si vous annulez la clôture.
                </p>
                <FloatButton type="button" variant="submit" disabled={occupe} onClick={() => archiver(annee.id, annee.label)}>
                  Archiver l’année
                </FloatButton>
              </div>
            )}

            {/* Choix d'épuration : simple drapeau, rien ne s'exécute tout seul. */}
            {annee.archivedAt && !annee.purgedAt && (
              <div className="pt-2 border-t border-warm-100 space-y-2">
                <p className="text-[11px] text-warm-700 leading-snug">
                  Après la bascule sur l’année suivante, faut-il épurer les données de {annee.label} ? Le choix est
                  un repère : la purge reste manuelle, et se lance depuis la fiche de l’année.
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

        {/* Années closes en attente d'archivage. Sans ce rappel, une année
            clôturée PUIS remplacée par N+1 n'aurait plus aucun écran d'où lancer
            son archivage, et sans archivage il n'y a pas de purge. */}
        {precedentes.some(p => !p.archivedAt) && (
          <div className="card p-3 space-y-1.5">
            <h2 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-orange-500" />
              Closes non archivées
            </h2>
            <p className="text-[11px] text-warm-700 leading-snug">
              Leur historique n’a jamais été figé. Sans archivage, elles ne peuvent pas être purgées.
            </p>
            <ul className="divide-y divide-warm-100">
              {precedentes.filter(p => !p.archivedAt).map(p => (
                <li key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-secondary-800">{p.label}</span>
                  <FloatButton
                    type="button"
                    variant="secondary"
                    disabled={occupe}
                    onClick={() => archiver(p.id, p.label)}
                    className="!px-2 !py-0.5 !text-[11px] !rounded-lg"
                  >
                    Archiver
                  </FloatButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
    <li className="flex items-start gap-1.5 text-[11px] leading-snug">
      <span className={`mt-0.5 shrink-0 ${ok ? 'text-primary-600' : 'text-orange-600'}`}>
        {ok ? <Check size={13} /> : <X size={13} />}
      </span>
      <span className={ok ? 'text-warm-700' : 'text-secondary-800 font-medium'}>{children}</span>
    </li>
  )
}
