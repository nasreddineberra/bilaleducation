'use client'

import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { Puce, Vide } from '@/components/dashboard/tdb'
import { useFiltresMemorises } from '@/hooks/useFiltresMemorises'
import SelecteurEnfant from './SelecteurEnfant'
import { choixParticipants, type AbsenceFamille, type Participant } from '@/lib/espace-famille/donnees'

/** Espace famille · Absences : filtre Tout / Absences / Retards, par participant (enfant ou « Moi »). */
const JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })

export default function FamilleAbsencesClient({ participants, absences }: { participants: Participant[]; absences: AbsenceFamille[] }) {
  const [etat, setEtat] = useFiltresMemorises('famille-absences', { enfant: '', type: '' })
  const choix = choixParticipants(participants)
  const libelle = new Map(choix.map(c => [c.valeur, c.libelle]))

  const duFoyer = absences.filter(a => !etat.enfant || a.groupe === etat.enfant)
  const nAbs = duFoyer.filter(a => a.absence_type === 'absence').length
  const nRet = duFoyer.length - nAbs
  const affiches = duFoyer.filter(a => !etat.type || a.absence_type === etat.type)

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <FiltreSwitch
          ariaLabel="Absences ou retards"
          actif={etat.type}
          onChange={v => setEtat({ type: v })}
          options={[
            { valeur: '', nombre: duFoyer.length, libelle: 'au total' },
            { valeur: 'absence', nombre: nAbs, libelle: nAbs > 1 ? 'absences' : 'absence' },
            { valeur: 'retard', nombre: nRet, libelle: nRet > 1 ? 'retards' : 'retard' },
          ]}
        />
        <SelecteurEnfant choix={choix} valeur={etat.enfant} onChange={v => setEtat({ enfant: v })} />
      </div>

      {affiches.length === 0 ? <Vide>Aucune absence ni aucun retard.</Vide> : (
        <ul className="liste">
          {affiches.map(a => {
            const commentaire = [a.comment, a.justification_comment].filter(Boolean).join(' · ')
            return (
              <li key={a.id} className="flex items-start gap-3 px-3 py-2 text-xs">
                <span className="tabular-nums font-semibold text-secondary-800 shrink-0 w-28">{JOUR.format(new Date(`${a.absence_date}T12:00`))}</span>
                <span className="min-w-0 flex-1">
                  <span className="list-name text-secondary-800 block">
                    {a.absence_type === 'retard' ? 'Retard' : 'Absence'}{choix.length > 1 ? ` · ${libelle.get(a.groupe) ?? ''}` : ''}
                  </span>
                  {commentaire && <span className="text-warm-700 block">{commentaire}</span>}
                </span>
                <Puce ton={a.is_justified ? 'ok' : 'attente'}>{a.is_justified ? 'Justifiée' : 'Non justifiée'}</Puce>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
