'use client'

import { useState, useTransition, Fragment } from 'react'
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

interface Annee { label: string; start_date: string; end_date: string }

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const EUR  = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

/** Ecart signe ; `null` quand il n'y a pas de mois precedent pour comparer. */
function Ecart({ v, euros }: { v: number | null; euros?: boolean }) {
  if (v === null) return <span className="text-warm-700">·</span>
  if (v === 0) return <span className="text-warm-700">0</span>
  const texte = euros ? EUR.format(Math.abs(v)) : String(Math.abs(v))
  return <span className={v > 0 ? 'text-primary-700' : 'text-red-600'}>{v > 0 ? '+' : '-'}{texte}</span>
}

export default function FacturationClient({ ecoles, ecoleId, releves, annees }: {
  ecoles: { id: string; nom: string }[]
  ecoleId: string | null
  releves: Releve[]
  annees: Annee[]
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
    const annee = annees.find(a => a.start_date <= r.mois && r.mois <= a.end_date)?.label ?? 'Hors année scolaire'
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
        <h1 className="text-2xl font-bold text-secondary-800 mr-auto">Facturation</h1>
        <label htmlFor="facturation-ecole" className="sr-only">Établissement</label>
        <select
          id="facturation-ecole"
          value={ecoleId ?? ''}
          onChange={e => router.push(`/superadmin/facturation?ecole=${e.target.value}`)}
          className="input w-auto py-1.5"
        >
          {ecoles.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <button type="button" onClick={relever} disabled={enCours} className="btn btn-secondary text-sm px-4 py-2">
          {enCours ? '...' : 'Relever maintenant'}
        </button>
      </div>

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-primary-700' : 'text-red-600'}`}>
          {message.texte}
        </p>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs" aria-label="Relevés mensuels de la base facturable">
          <thead>
            <tr>
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
              <tr><td colSpan={9} className="list-td text-center text-warm-700">Aucun relevé pour cet établissement.</td></tr>
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
                      <td className="list-td text-right tabular-nums font-semibold text-primary-700">{base}</td>
                      <td className="list-td text-right tabular-nums"><Ecart v={ecartBase} /></td>
                      <td className="list-td text-right tabular-nums text-warm-700">{r.limite ?? 'Aucune'}</td>
                      <td className="list-td text-right tabular-nums font-semibold">{montant === null ? <span className="text-warm-700 font-normal">Sans tarif</span> : EUR.format(montant)}</td>
                      <td className="list-td text-right tabular-nums"><Ecart v={ecartMontant} euros /></td>
                      <td className="list-td text-warm-700">{formatDateFr(r.releve_le)}</td>
                    </tr>
                  ))}
                  <tr className="bg-warm-50">
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
    </div>
  )
}
