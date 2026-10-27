'use client'

import { useState, useTransition, Fragment } from 'react'
import { FloatButton, FloatSelect } from '@/components/ui/FloatFields'
import { useRouter } from 'next/navigation'
import { releverMaintenant } from '../../facturation-actions'
import { montantMensuel } from '@/lib/tenant/facturation'
import { formatDateFr } from '@/lib/dates'

export interface Releve {
  mois:             string
  eleves_actifs:    number
  adultes_inscrits: number
  limite:           number | null
  releve_le:        string
  prix_inscrit:     number | null
  forfait:          number | null
}

interface Annee { label: string; start_date: string | null; end_date: string | null }

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const EUR  = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

/** Ecart signe ; `null` quand il n'y a pas de mois precedent pour comparer. */
function Ecart({ v, euros }: { v: number | null; euros?: boolean }) {
  if (v === null) return <span className="text-warm-700">·</span>
  if (v === 0) return <span className="text-warm-700">0</span>
  const texte = euros ? EUR.format(Math.abs(v)) : String(Math.abs(v))
  return <span className={v > 0 ? 'text-[var(--etat-ok)]' : 'text-[var(--etat-danger)]'}>{v > 0 ? '+' : '-'}{texte}</span>
}

/** Une ecole dans la vue « Tous » : son releve du mois, et celui du mois precedent s'il existe. */
export interface LigneEnsemble { id: string; nom: string; r: Releve; prec?: Releve }

export default function FacturationClient({ ecoles, ecoleId, releves, annees, ensemble }: {
  ecoles: { id: string; nom: string }[]
  ecoleId: string | null
  releves: Releve[]
  annees: Annee[]
  /** Vue « Tous » (aucune ecole choisie). */
  ensemble?: { mois: string | null; lignes: LigneEnsemble[] }
}) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const relever = () => demarrer(async () => {
    const r = await releverMaintenant()
    setMessage(r.error
      ? { ok: false, texte: r.error }
      : { ok: true, texte: r.crees ? `${r.crees} relevé${r.crees > 1 ? 's' : ''} pris pour le mois en cours.` : 'Le relevé du mois en cours existait déjà.' })
    router.refresh()
  })

  // Ordre chronologique pour calculer l'ecart avec le mois PRECEDENT, puis
  // affichage du plus recent au plus ancien.
  const chrono = [...releves].sort((a, b) => a.mois.localeCompare(b.mois))
  const lignes = chrono.map((r, i) => {
    const base    = r.eleves_actifs + r.adultes_inscrits
    const montant = montantMensuel(base, r.prix_inscrit, r.forfait)
    const prec    = i > 0 ? chrono[i - 1] : null
    const basePrec    = prec ? prec.eleves_actifs + prec.adultes_inscrits : null
    const montantPrec = prec ? montantMensuel(basePrec!, prec.prix_inscrit, prec.forfait) : null
    const annee = annees.find(a => a.start_date && a.end_date && a.start_date <= r.mois && r.mois <= a.end_date)?.label ?? 'Hors année scolaire'
    return {
      r, base, montant, annee,
      ecartBase:    basePrec === null ? null : base - basePrec,
      ecartMontant: montant === null || montantPrec === null ? null : montant - montantPrec,
    }
  }).reverse()

  // Groupes par annee scolaire, dans l'ordre d'affichage.
  const groupes: { annee: string; lignes: typeof lignes }[] = []
  for (const l of lignes) {
    const g = groupes.find(x => x.annee === l.annee)
    if (g) g.lignes.push(l); else groupes.push({ annee: l.annee, lignes: [l] })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        {/* Pas de titre : l'onglet actif dit déjà où l'on est. L'espace garde les contrôles à droite. */}
        <div className="mr-auto" />
        <FloatSelect
          label="Établissement"
          bordure
          className="py-2 truncate"
          value={ecoleId ?? '__all__'}
          onChange={e => router.push(e.target.value === '__all__'
            ? '/superadmin/facturation'
            : `/superadmin/facturation?ecole=${e.target.value}`)}
          wrapperClassName="w-56"
        >
          <option value="__all__">Tous</option>
          {ecoles.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </FloatSelect>
        <FloatButton type="button" variant="secondary" loading={enCours} onClick={relever}>
          Relever maintenant
        </FloatButton>
      </div>

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-[var(--etat-ok)]' : 'text-[var(--etat-danger)]'}`}>
          {message.texte}
        </p>
      )}

      {ensemble ? (
        <VueEnsemble ensemble={ensemble} ouvrir={id => router.push(`/superadmin/facturation?ecole=${id}`)} />
      ) : (
      <div className="liste">
        <table className="w-full text-xs" aria-label="Relevés mensuels de la base facturable">
          <thead>
            <tr className="liste-entete border-b border-[var(--card-border)]">
              <th scope="col" className="list-th text-left">Mois</th>
              <th scope="col" className="list-th text-right">Élèves actifs</th>
              <th scope="col" className="list-th text-right">Adultes inscrits</th>
              <th scope="col" className="list-th text-right">Base facturable</th>
              <th scope="col" className="list-th text-right">Écart</th>
              <th scope="col" className="list-th text-right">Limite</th>
              <th scope="col" className="list-th text-right">Montant</th>
              <th scope="col" className="list-th text-right">Écart</th>
              <th scope="col" className="list-th text-left">Relevé le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {groupes.length === 0 ? (
              <tr className="sans-survol"><td colSpan={9} className="px-3 py-8 text-center text-warm-700">Aucun relevé pour cet établissement.</td></tr>
            ) : groupes.map(g => {
              const total = g.lignes.reduce((s, l) => s + (l.montant ?? 0), 0)
              const sansTarif = g.lignes.some(l => l.montant === null)
              return (
                <Fragment key={g.annee}>
                  {g.lignes.map(({ r, base, montant, ecartBase, ecartMontant }) => (
                    <tr key={r.mois}>
                      <td className="list-td list-name capitalize">{MOIS.format(new Date(r.mois))}</td>
                      <td className="list-td text-right tabular-nums">{r.eleves_actifs}</td>
                      <td className="list-td text-right tabular-nums">{r.adultes_inscrits}</td>
                      <td className="list-td text-right tabular-nums font-semibold text-[var(--brand-surface)]">{base}</td>
                      <td className="list-td text-right tabular-nums"><Ecart v={ecartBase} /></td>
                      <td className="list-td text-right tabular-nums text-warm-700">{r.limite ?? 'Aucune'}</td>
                      <td className="list-td text-right tabular-nums font-semibold">{montant === null ? <span className="text-warm-700 font-normal">Sans tarif</span> : EUR.format(montant)}</td>
                      <td className="list-td text-right tabular-nums"><Ecart v={ecartMontant} euros /></td>
                      <td className="list-td text-warm-700">{formatDateFr(r.releve_le)}</td>
                    </tr>
                  ))}
                  <tr className="sans-survol !bg-[var(--surface-sunken)]">
                    <td colSpan={6} className="list-td font-semibold text-secondary-800">Total {g.annee}</td>
                    <td className="list-td text-right tabular-nums font-bold text-secondary-800">{EUR.format(total)}</td>
                    <td colSpan={2} className="list-td text-warm-700">{sansTarif ? 'dont des mois sans tarif' : ''}</td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

/**
 * Vue « Tous » : une ligne par ecole pour le dernier mois releve, ecarts avec
 * le mois precedent, total. Meme calcul que le detail (`montantMensuel`, tarif
 * fige dans chaque releve). La ligne ouvre le detail de l'ecole.
 */
function VueEnsemble({ ensemble, ouvrir }: {
  ensemble: { mois: string | null; lignes: LigneEnsemble[] }
  ouvrir: (id: string) => void
}) {
  if (!ensemble.mois || ensemble.lignes.length === 0) {
    return <p className="py-10 text-center text-sm text-warm-700">Aucun relevé.</p>
  }

  const lignes = ensemble.lignes.map(({ id, nom, r, prec }) => {
    const base        = r.eleves_actifs + r.adultes_inscrits
    const montant     = montantMensuel(base, r.prix_inscrit, r.forfait)
    const basePrec    = prec ? prec.eleves_actifs + prec.adultes_inscrits : null
    const montantPrec = prec ? montantMensuel(basePrec!, prec.prix_inscrit, prec.forfait) : null
    return {
      id, nom, r, base, montant,
      ecartBase:    basePrec === null ? null : base - basePrec,
      ecartMontant: montant === null || montantPrec === null ? null : montant - montantPrec,
    }
  })
  const totalBase    = lignes.reduce((s, l) => s + l.base, 0)
  const totalMontant = lignes.reduce((s, l) => s + (l.montant ?? 0), 0)
  const sansTarif    = lignes.some(l => l.montant === null)

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-secondary-800 capitalize">{MOIS.format(new Date(ensemble.mois))}</p>
      <div className="liste">
        <table className="w-full text-xs" aria-label="Base facturable du dernier mois relevé, par établissement">
          <thead>
            <tr className="liste-entete border-b border-[var(--card-border)]">
              <th scope="col" className="list-th text-left">Établissement</th>
              <th scope="col" className="list-th text-right">Élèves actifs</th>
              <th scope="col" className="list-th text-right">Adultes inscrits</th>
              <th scope="col" className="list-th text-right">Base facturable</th>
              <th scope="col" className="list-th text-right">Écart</th>
              <th scope="col" className="list-th text-right">Limite</th>
              <th scope="col" className="list-th text-right">Montant</th>
              <th scope="col" className="list-th text-right">Écart</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {lignes.map(l => (
              <tr key={l.id} onClick={() => ouvrir(l.id)} className="cursor-pointer">
                <td className="list-td">
                  {/* Vrai bouton : la ligne est cliquable a la souris, le clavier a sa cible. */}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); ouvrir(l.id) }}
                    className="list-name hover:underline text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                  >
                    {l.nom}
                  </button>
                </td>
                <td className="list-td text-right tabular-nums">{l.r.eleves_actifs}</td>
                <td className="list-td text-right tabular-nums">{l.r.adultes_inscrits}</td>
                <td className="list-td text-right tabular-nums font-semibold text-[var(--brand-surface)]">{l.base}</td>
                <td className="list-td text-right tabular-nums"><Ecart v={l.ecartBase} /></td>
                <td className="list-td text-right tabular-nums text-warm-700">{l.r.limite ?? 'Aucune'}</td>
                <td className="list-td text-right tabular-nums font-semibold">{l.montant === null ? <span className="text-warm-700 font-normal">Sans tarif</span> : EUR.format(l.montant)}</td>
                <td className="list-td text-right tabular-nums"><Ecart v={l.ecartMontant} euros /></td>
              </tr>
            ))}
            <tr className="sans-survol !bg-[var(--surface-sunken)]">
              <td colSpan={3} className="list-td font-semibold text-secondary-800">Total</td>
              <td className="list-td text-right tabular-nums font-bold text-secondary-800">{totalBase}</td>
              <td colSpan={2} />
              <td className="list-td text-right tabular-nums font-bold text-secondary-800">{EUR.format(totalMontant)}</td>
              <td className="list-td text-warm-700">{sansTarif ? 'dont des écoles sans tarif' : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
