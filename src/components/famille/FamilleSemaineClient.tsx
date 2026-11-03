'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'
import { Puce, Vide } from '@/components/dashboard/tdb'
import { useFiltresMemorises } from '@/hooks/useFiltresMemorises'
import SelecteurEnfant from './SelecteurEnfant'
import type { JourFamille } from '@/lib/espace-famille/semaine'

/**
 * Espace famille · Emploi du temps : une carte par jour (cote a cote sur
 * ordinateur, l'une sous l'autre sur telephone). Seance annulee ou remplacee,
 * jour ferme. Navigation par semaine (adresse `?semaine=`).
 */
const JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const PERIODE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const date = (d: string) => new Date(`${d}T12:00`)

export default function FamilleSemaineClient({ jours, aujourdhui, precedente, suivante, choix }: {
  jours: JourFamille[]
  aujourdhui: string
  precedente: string
  suivante: string
  choix: { valeur: string; libelle: string }[]
}) {
  const [etat, setEtat] = useFiltresMemorises('famille-semaine', { qui: '' })
  const libelle = choix.find(c => c.valeur === etat.qui)?.libelle
  const visibles = (j: JourFamille) => j.seances.filter(s => !libelle || s.qui.includes(libelle))
  const plusieurs = choix.length > 1
  const total = jours.reduce((n, j) => n + visibles(j).length, 0)
  const debut = jours[0]?.date
  const fin = jours[jours.length - 1]?.date
  const nav = 'p-1.5 rounded-lg text-warm-700 hover:text-secondary-700 hover:bg-warm-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]'

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Tooltip content="Semaine précédente">
            <Link href={`?semaine=${precedente}`} aria-label="Semaine précédente" className={nav}><ChevronLeft size={18} /></Link>
          </Tooltip>
          <Link href={`?semaine=${aujourdhui}`} className="px-2 py-1 text-xs font-medium rounded-lg text-secondary-800 hover:bg-warm-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]">
            Aujourd’hui
          </Link>
          <Tooltip content="Semaine suivante">
            <Link href={`?semaine=${suivante}`} aria-label="Semaine suivante" className={nav}><ChevronRight size={18} /></Link>
          </Tooltip>
        </div>
        {debut && fin && (
          <span className="text-sm font-semibold text-secondary-800">
            Du {PERIODE.format(date(debut))} au {PERIODE.format(date(fin))}
          </span>
        )}
        <div className="flex-1" />
        <SelecteurEnfant choix={choix} valeur={etat.qui} onChange={v => setEtat({ qui: v })} />
      </div>

      {total === 0 && jours.every(j => !j.ferme) ? <Vide>Aucune séance cette semaine.</Vide> : (
        <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2.5">
          {jours.map(j => {
            const seances = visibles(j)
            const estAujourdhui = j.date === aujourdhui
            return (
              <section key={j.date} aria-label={JOUR.format(date(j.date))}
                className={clsx('card p-3 space-y-2', estAujourdhui && 'ring-2 ring-[var(--brand-line)]')}>
                <h3 className="text-xs font-bold text-secondary-800 first-letter:uppercase">{JOUR.format(date(j.date))}</h3>
                {j.ferme ? (
                  <Puce ton="neutre">{j.ferme.label ? `${j.ferme.titre} · ${j.ferme.label}` : j.ferme.titre}</Puce>
                ) : seances.length === 0 ? (
                  <p className="text-xs text-warm-700">Pas de séance</p>
                ) : (
                  <ul className="space-y-1.5">
                    {seances.map(s => (
                      <li key={s.slotId} className={clsx('rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs space-y-0.5',
                        s.statut === 'annulee' && 'bg-[var(--surface-sunken)]')}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="tabular-nums font-semibold text-secondary-800">{s.debut}-{s.fin}</span>
                          {s.statut === 'annulee' && <Puce ton="danger">Annulée</Puce>}
                          {s.statut === 'remplacee' && <Puce ton="remplacement">Remplacée</Puce>}
                        </div>
                        <p className={clsx('font-medium text-secondary-800', s.statut === 'annulee' && 'line-through')}>{s.intitule}</p>
                        {s.statut !== 'annulee' && (
                          <p className="text-warm-700">
                            {[s.enseignant ?? 'Prof non affecté', s.salle].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {plusieurs && !libelle && <p className="text-warm-700">{s.qui.join(', ')}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
