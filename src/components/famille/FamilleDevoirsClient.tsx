'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { CheckCircle2, Eye } from 'lucide-react'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { Puce, Vide } from '@/components/dashboard/tdb'
import DevoirDetailModal from '@/components/cahier-texte/DevoirDetailModal'
import { typeDevoir, aujourdhui } from '@/components/cahier-texte/commun'
import { libelleMatiere } from '@/lib/cahier-texte/matiere'
import { useFiltresMemorises } from '@/hooks/useFiltresMemorises'
import SelecteurEnfant from './SelecteurEnfant'
import type { ClasseCahier, DevoirCahier } from '@/lib/cahier-texte/donnees'
import type { EnfantFamille } from '@/lib/espace-famille/donnees'

/**
 * Espace famille · Devoirs : une ligne par devoir ET par enfant de la classe.
 * « A rendre » (date de rendu aujourd'hui ou plus tard) / « Passes ». La ligne
 * ouvre la fenetre du devoir : « Vu » s'y pose, « Effectue » s'y coche.
 */
const dateCourte = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

export default function FamilleDevoirsClient({ devoirs, classes, enfants, suivi, etablissementId }: {
  devoirs: DevoirCahier[]
  classes: ClasseCahier[]
  enfants: EnfantFamille[]
  suivi: { homework_id: string; student_id: string; is_seen: boolean; is_done: boolean }[]
  etablissementId: string
}) {
  const router = useRouter()
  const [etat, setEtat] = useFiltresMemorises('famille-devoirs', { enfant: '', quand: 'a-rendre' })
  const [ouvert, setOuvert] = useState<DevoirCahier | null>(null)
  const jour = aujourdhui()

  const lignes = useMemo(() => devoirs.flatMap(d => enfants
    .filter(e => e.class_id === d.class_id && (!etat.enfant || etat.enfant === e.id))
    .map(e => {
      const s = suivi.find(x => x.homework_id === d.id && x.student_id === e.id)
      return { devoir: d, enfant: e, fait: !!s?.is_done, vu: !!s?.is_seen }
    })), [devoirs, enfants, suivi, etat.enfant])

  const aRendre = lignes.filter(l => l.devoir.due_date.slice(0, 10) >= jour)
  const passes = lignes.filter(l => l.devoir.due_date.slice(0, 10) < jour).reverse()
  const affiches = etat.quand === 'passes' ? passes : aRendre
  const classeDe = (id: string) => classes.find(c => c.id === id)

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <FiltreSwitch
          ariaLabel="Devoirs à rendre ou passés"
          actif={etat.quand}
          onChange={v => setEtat({ quand: v })}
          options={[
            { valeur: 'a-rendre', nombre: aRendre.length, libelle: 'à rendre' },
            { valeur: 'passes', nombre: passes.length, libelle: 'passés' },
          ]}
        />
        <SelecteurEnfant enfants={enfants} valeur={etat.enfant} onChange={v => setEtat({ enfant: v })} />
      </div>

      {affiches.length === 0 ? (
        <Vide>{etat.quand === 'passes' ? 'Aucun devoir passé.' : 'Aucun devoir à rendre.'}</Vide>
      ) : (
        <ul className="liste">
          {affiches.map(({ devoir, enfant, fait, vu }) => {
            const type = typeDevoir(devoir.homework_type)
            const matiere = libelleMatiere(devoir.subject)
            return (
              <li key={`${devoir.id}-${enfant.id}`}>
                <button type="button" onClick={() => setOuvert(devoir)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-focus)]">
                  <span className="tabular-nums font-semibold text-secondary-800 shrink-0 w-20">{dateCourte(devoir.due_date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="list-name text-secondary-800 block truncate">{devoir.title}</span>
                    <span className="text-warm-700 block truncate">
                      {[enfants.length > 1 ? enfant.first_name : null, devoir.classes?.name, matiere].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Puce ton={type.ton}>{type.label}</Puce>
                  <span className={clsx('flex items-center gap-1 shrink-0 w-20 justify-end',
                    fait ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-warm-700')}>
                    {fait ? <><CheckCircle2 size={14} aria-hidden="true" /> Effectué</> : vu ? <><Eye size={14} aria-hidden="true" /> Vu</> : 'À faire'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {ouvert && (
        <DevoirDetailModal
          homework={ouvert}
          role="parent"
          teacherId={null}
          isAdult={!!classeDe(ouvert.class_id)?.cotisation_types?.is_adult}
          creneaux={classeDe(ouvert.class_id)?.schedule_slots ?? []}
          etablissementId={etablissementId}
          onClose={() => { setOuvert(null); router.refresh() }}
        />
      )}
    </div>
  )
}
