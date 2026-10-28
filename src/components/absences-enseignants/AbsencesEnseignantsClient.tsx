'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { FloatButton } from '@/components/ui/FloatFields'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Puce } from '@/components/dashboard/tdb'
import { useToast } from '@/lib/toast-context'
import { useFiltresMemorises } from '@/hooks/useFiltresMemorises'
import { libelleMotif } from '@/lib/absences-enseignants/libelles'
import { horodatageParis } from '@/lib/dates'
import { accord, pluriel } from '@/lib/texte/pluriel'
import { supprimerAbsence } from '@/app/dashboard/absences-enseignants/actions'
import AbsenceFormModal, { type AbsenceSaisie } from './AbsenceFormModal'
import { periodeAbsence } from './periode'

export interface AbsenceLigne extends AbsenceSaisie {
  enseignant: string
  nbSeances: number
  nbADecider: number
}

type Periode = 'en_cours' | 'passees' | 'toutes'

export default function AbsencesEnseignantsClient({ absences, enseignants, peutGerer }: {
  absences: AbsenceLigne[]
  enseignants: { id: string; nom: string }[]
  peutGerer: boolean
}) {
  const router = useRouter()
  const { error: toastError, success: toastSuccess } = useToast()
  const [filtres, setFiltres] = useFiltresMemorises('absences-enseignants-filtres', { periode: 'en_cours' })
  const periode: Periode = filtres.periode === 'passees' || filtres.periode === 'toutes' ? filtres.periode : 'en_cours'
  const [edition, setEdition] = useState<AbsenceSaisie | 'nouvelle' | null>(null)
  const [aSupprimer, setASupprimer] = useState<AbsenceLigne | null>(null)
  const [suppression, setSuppression] = useState(false)

  // « En cours et a venir » = pas encore finie a l'heure de Paris.
  const maintenant = horodatageParis(new Date())
  const enCours = useMemo(() => absences.filter(a => a.fin >= maintenant), [absences, maintenant])
  const passees = useMemo(() => absences.filter(a => a.fin < maintenant), [absences, maintenant])
  const visibles = periode === 'en_cours'
    // Les plus proches d'abord pour ce qui vient ; les plus recentes d'abord pour le passe.
    ? [...enCours].sort((x, y) => x.debut.localeCompare(y.debut))
    : periode === 'passees' ? passees : absences

  const confirmerSuppression = async () => {
    if (!aSupprimer) return
    setSuppression(true)
    const r = await supprimerAbsence(aSupprimer.id)
    setSuppression(false)
    if (r.error) { toastError(r.error); return }
    setASupprimer(null)
    toastSuccess('Absence supprimée.')
    router.refresh()
  }

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <FiltreSwitch
          ariaLabel="Filtrer les absences"
          actif={periode}
          onChange={v => setFiltres({ periode: v })}
          options={[
            { valeur: 'en_cours', nombre: enCours.length,  libelle: 'en cours et à venir' },
            { valeur: 'passees',  nombre: passees.length,  libelle: accord(passees.length, 'passée') },
            { valeur: 'toutes',   nombre: absences.length, libelle: 'au total' },
          ]}
        />
        <div className="flex-1" />
        {peutGerer && (
          <FloatButton type="button" variant="submit" onClick={() => setEdition('nouvelle')}>
            Déclarer une absence
          </FloatButton>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="card text-center text-sm text-warm-700 py-10">Aucune absence.</div>
      ) : (
        <div className="liste">
          <table className="w-full text-xs" aria-label="Absences des enseignants">
            <thead>
              <tr className="liste-entete border-b border-[var(--card-border)]">
                <th className="list-th">Enseignant</th>
                <th className="list-th">Période</th>
                <th className="list-th">Motif</th>
                <th className="list-th">Séances</th>
                {peutGerer && <th className="list-th" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {visibles.map(a => {
                const lien = `/dashboard/absences-enseignants/${a.id}`
                const enCoursMaintenant = a.debut <= maintenant && a.fin >= maintenant
                return (
                  <tr
                    key={a.id}
                    onClick={() => router.push(lien)}
                    className={`cursor-pointer transition-colors ${enCoursMaintenant ? 'ligne-active' : ''}`}
                  >
                    <td className="list-td whitespace-nowrap">
                      <Link
                        href={lien}
                        onClick={e => e.stopPropagation()}
                        className="list-name text-secondary-800 hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                      >
                        {a.enseignant}
                      </Link>
                    </td>
                    <td className="list-td text-warm-700 whitespace-nowrap tabular-nums">{periodeAbsence(a.debut, a.fin)}</td>
                    <td className="list-td text-warm-700">{libelleMotif(a.motif)}</td>
                    <td className="list-td whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <span className="text-warm-700 tabular-nums">{pluriel(a.nbSeances, 'séance')}</span>
                        {a.nbADecider > 0 && <Puce ton="attente">{a.nbADecider} à décider</Puce>}
                      </span>
                    </td>
                    {peutGerer && (
                      <td className="list-td text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip content="Modifier">
                            <button
                              type="button"
                              onClick={() => setEdition(a)}
                              aria-label={`Modifier l’absence de ${a.enseignant}`}
                              className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-focus)]"
                            >
                              <Pencil size={13} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Supprimer">
                            <button
                              type="button"
                              onClick={() => setASupprimer(a)}
                              aria-label={`Supprimer l’absence de ${a.enseignant}`}
                              className="p-1.5 text-warm-700 hover:text-red-700 hover:bg-red-50 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                            >
                              <Trash2 size={13} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {edition && (
        <AbsenceFormModal
          absence={edition === 'nouvelle' ? null : edition}
          enseignants={enseignants}
          onClose={() => setEdition(null)}
        />
      )}

      {aSupprimer && (
        <ConfirmModal
          variant="danger"
          confirmColor="red"
          title="Supprimer l’absence"
          confirmLabel={suppression ? 'Suppression…' : 'Supprimer'}
          confirmDisabled={suppression}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        >
          <div className="space-y-1 text-sm">
            <p className="font-medium text-secondary-800">{aSupprimer.enseignant}</p>
            <p className="text-warm-700 tabular-nums">{periodeAbsence(aSupprimer.debut, aSupprimer.fin)} · {libelleMotif(aSupprimer.motif)}</p>
            <p className="text-warm-700">Ses séances redeviennent des séances ordinaires, assurées par le titulaire.</p>
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}
