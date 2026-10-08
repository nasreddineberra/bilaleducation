'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { releverMaintenant } from '../../facturation-actions'
import { formatDateFr } from '@/lib/dates'

export interface Releve {
  mois:             string
  eleves_actifs:    number
  adultes_inscrits: number
  limite:           number | null
  releve_le:        string
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function FacturationClient({ ecoles, ecoleId, releves }: {
  ecoles: { id: string; nom: string }[]
  ecoleId: string | null
  releves: Releve[]
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
              <th scope="col" className="list-th text-right">Limite</th>
              <th scope="col" className="list-th text-left">Relevé le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {releves.length === 0 ? (
              <tr><td colSpan={6} className="list-td text-center text-warm-700">Aucun relevé pour cet établissement.</td></tr>
            ) : releves.map(r => (
              <tr key={r.mois}>
                <td className="list-td list-name capitalize">{MOIS.format(new Date(r.mois))}</td>
                <td className="list-td text-right tabular-nums">{r.eleves_actifs}</td>
                <td className="list-td text-right tabular-nums">{r.adultes_inscrits}</td>
                <td className="list-td text-right tabular-nums font-semibold text-primary-700">{r.eleves_actifs + r.adultes_inscrits}</td>
                <td className="list-td text-right tabular-nums text-warm-700">{r.limite ?? 'Aucune'}</td>
                <td className="list-td text-warm-700">{formatDateFr(r.releve_le)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
