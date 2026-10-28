'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton, FloatSelect } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Puce } from '@/components/dashboard/tdb'
import { useToast } from '@/lib/toast-context'
import { libelleMotif, type Decision } from '@/lib/absences-enseignants/libelles'
import { pluriel } from '@/lib/texte/pluriel'
import { deciderSeances, supprimerAbsence } from '@/app/dashboard/absences-enseignants/actions'
import AbsenceFormModal, { type AbsenceSaisie } from './AbsenceFormModal'
import { periodeAbsence } from './periode'

/**
 * FICHE D'UNE ABSENCE (lot 3b-1) : les seances touchees, groupees par creneau
 * de la semaine, et pour chacune une decision : A decider (defaut, aucune
 * ligne en base), Annulee, ou Remplacee par un membre de l'equipe. « Meme
 * decision » s'applique a un groupe ou a toute l'absence. Les membres pris sur
 * l'horaire sont grises avec la raison, donnee par la base
 * (`remplacants_possibles`) ; une seance validee est verrouillee.
 * Tout part d'un coup a l'enregistrement (`decider_seances_absence`, tout ou rien).
 */

export interface SeanceFiche {
  slotId: string
  date: string
  classe: string
  debut: string
  fin: string
  decision: Decision
  remplacant: string | null
  validee: boolean
  /** Membres admissibles -> raison s'il est pris sur l'horaire, `null` s'il est libre. */
  occupes: Record<string, string | null>
}

export interface Membre {
  id: string
  nom: string
  role: string
}

// Valeur d'un select : 'a_decider' | 'annulee' | 'r:<profile_id>'.
const valeurDe = (s: { decision: Decision; remplacant: string | null }) =>
  s.decision === 'remplacee' && s.remplacant ? `r:${s.remplacant}` : s.decision
const cle = (s: { slotId: string; date: string }) => `${s.slotId}|${s.date}`

function jourLong(date: string): string {
  const j = new Date(date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return j.charAt(0).toUpperCase() + j.slice(1)
}
function jourSemaine(date: string): string {
  return new Date(date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long' })
}

export default function AbsenceDetailClient({ absence, enseignant, seances, membres, peutGerer }: {
  absence: AbsenceSaisie
  enseignant: string
  seances: SeanceFiche[]
  membres: Membre[]
  peutGerer: boolean
}) {
  const router = useRouter()
  const { error: toastError, success: toastSuccess } = useToast()
  const initial = useMemo(() => Object.fromEntries(seances.map(s => [cle(s), valeurDe(s)])), [seances])
  const [choix, setChoix] = useState<Record<string, string>>(initial)
  // Donnees rafraichies apres enregistrement : on repart de la base.
  useEffect(() => { setChoix(initial) }, [initial])
  const [saving, setSaving] = useState(false)
  const [edition, setEdition] = useState(false)
  const [confirmeSuppression, setConfirmeSuppression] = useState(false)
  const [suppression, setSuppression] = useState(false)

  const membreParId = useMemo(() => new Map(membres.map(m => [m.id, m])), [membres])
  // Membres admissibles : la base rend la meme liste pour chaque seance.
  const admissibles = useMemo(() => {
    const ids = new Set(seances.flatMap(s => Object.keys(s.occupes)))
    return membres.filter(m => ids.has(m.id))
  }, [seances, membres])

  // Groupes : un creneau de la semaine, ses seances dans l'ordre.
  const groupes = useMemo(() => {
    const parCreneau = new Map<string, SeanceFiche[]>()
    for (const s of seances) parCreneau.set(s.slotId, [...(parCreneau.get(s.slotId) ?? []), s])
    return [...parCreneau.values()]
  }, [seances])

  const modifiees = seances.filter(s => !s.validee && choix[cle(s)] !== initial[cle(s)])
  const nbADecider = seances.filter(s => choix[cle(s)] === 'a_decider').length

  const appliquer = (cibles: SeanceFiche[], valeur: string) => {
    if (!valeur) return
    setChoix(prev => {
      const suivant = { ...prev }
      for (const s of cibles) {
        if (s.validee) continue
        // Un remplacant pris sur CETTE seance ne lui est pas applique.
        if (valeur.startsWith('r:') && s.occupes[valeur.slice(2)]) continue
        suivant[cle(s)] = valeur
      }
      return suivant
    })
  }

  // Options d'un select. `cibles` : la seance seule, ou le groupe / l'absence
  // pour « meme decision ». Un membre pris sur au moins une cible est grise.
  const options = (cibles: SeanceFiche[], actuel?: string) => {
    const ouvertes = cibles.filter(s => !s.validee)
    const membresOptions = admissibles.map(m => {
      const prises = ouvertes.filter(s => s.occupes[m.id])
      const raison = prises.length === 0 ? null
        : cibles.length === 1 ? `pris : ${prises[0].occupes[m.id]}`
        : `pris sur ${pluriel(prises.length, 'séance')}`
      return (
        <option key={m.id} value={`r:${m.id}`} disabled={!!raison}>
          {m.nom}{m.role ? ` · ${m.role}` : ''}{raison ? ` · ${raison}` : ''}
        </option>
      )
    })
    // Remplacant enregistre qui n'est plus admissible (compte rendu inactif) :
    // il reste affiche, sans pouvoir etre choisi a nouveau.
    const ancien = actuel?.startsWith('r:') && !admissibles.some(m => `r:${m.id}` === actuel)
      ? membreParId.get(actuel.slice(2)) : undefined
    return <>
      <option value="a_decider">À décider</option>
      <option value="annulee">Annulée</option>
      <optgroup label="Remplacée par">
        {ancien && <option value={actuel} disabled>{ancien.nom} · plus disponible</option>}
        {membresOptions}
      </optgroup>
    </>
  }

  const enregistrer = async () => {
    setSaving(true)
    const r = await deciderSeances(absence.id, modifiees.map(s => {
      const v = choix[cle(s)]
      return v.startsWith('r:')
        ? { slotId: s.slotId, date: s.date, decision: 'remplacee' as const, remplacant: v.slice(2) }
        : { slotId: s.slotId, date: s.date, decision: v as Decision, remplacant: null }
    }))
    setSaving(false)
    if (r.error) { toastError(r.error); return }
    toastSuccess(`${pluriel(modifiees.length, 'décision')} ${modifiees.length > 1 ? 'enregistrées' : 'enregistrée'}.`)
    router.refresh()
  }

  const supprimer = async () => {
    setSuppression(true)
    const r = await supprimerAbsence(absence.id)
    setSuppression(false)
    if (r.error) { toastError(r.error); setConfirmeSuppression(false); return }
    toastSuccess('Absence supprimée.')
    router.push('/dashboard/absences-enseignants')
  }

  const decisionLue = (s: SeanceFiche) => {
    if (s.decision === 'annulee') return <Puce ton="danger">Annulée</Puce>
    if (s.decision === 'remplacee') {
      const m = s.remplacant ? membreParId.get(s.remplacant) : undefined
      return <Puce ton="remplacement">{m ? `Remplacée par ${m.nom}` : 'Remplacée'}</Puce>
    }
    return <Puce ton="attente">À décider</Puce>
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0 animate-fade-in">
      {/* ── L'absence ── */}
      <div className="card p-3 shrink-0">
        <div className="encadre-titre justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest truncate">Absence</h2>
          <div className="flex items-center gap-2 shrink-0">
            {peutGerer && <>
              <FloatButton size="mini" variant="danger" type="button" onClick={() => setConfirmeSuppression(true)}>Supprimer</FloatButton>
              <FloatButton size="mini" variant="edit" type="button" onClick={() => setEdition(true)}>Modifier</FloatButton>
            </>}
            <FloatButton size="mini" variant="secondary" href="/dashboard/absences-enseignants">Retour à la liste</FloatButton>
          </div>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <div><dt className="stat-label text-warm-700">Enseignant</dt><dd className="font-medium text-secondary-800">{enseignant}</dd></div>
          <div><dt className="stat-label text-warm-700">Période</dt><dd className="text-secondary-800 tabular-nums">{periodeAbsence(absence.debut, absence.fin)}</dd></div>
          <div><dt className="stat-label text-warm-700">Motif</dt><dd className="text-secondary-800">{libelleMotif(absence.motif)}</dd></div>
          <div>
            <dt className="stat-label text-warm-700">Séances</dt>
            <dd className="flex items-center gap-1.5 text-secondary-800 tabular-nums">
              {pluriel(seances.length, 'séance')}
              {nbADecider > 0 && <Puce ton="attente">{nbADecider} à décider</Puce>}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Les seances ── */}
      <div className="card p-3 flex-1 min-h-0 flex flex-col gap-2">
        <div className="encadre-titre mb-0 justify-between gap-2 shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-widest truncate">Séances touchées</h2>
          {peutGerer && seances.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              {seances.length > 1 && (
                <FloatSelect
                  label="Même décision pour toutes"
                  compact
                  wrapperClassName="w-64"
                  value=""
                  onChange={e => appliquer(seances, e.target.value)}
                >
                  <option value="" disabled hidden />
                  {options(seances)}
                </FloatSelect>
              )}
              <FloatButton size="mini" variant="submit" type="button" onClick={enregistrer}
                loading={saving} disabled={modifiees.length === 0}>
                Enregistrer
              </FloatButton>
            </div>
          )}
        </div>

        {seances.length === 0 ? (
          <p className="text-sm text-warm-700 py-6 text-center">Aucune séance touchée par cette absence.</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto list-scroll space-y-3 pt-2">
            {groupes.map(groupe => {
              const premier = groupe[0]
              return (
                <section key={premier.slotId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="section-title">
                      {premier.classe} · {jourSemaine(premier.date)} {premier.debut}-{premier.fin} · {pluriel(groupe.length, 'séance')}
                    </h3>
                    {peutGerer && groupe.length > 1 && (
                      <FloatSelect
                        label="Même décision pour ce créneau"
                        compact
                        wrapperClassName="w-64"
                        value=""
                        onChange={e => appliquer(groupe, e.target.value)}
                      >
                        <option value="" disabled hidden />
                        {options(groupe)}
                      </FloatSelect>
                    )}
                  </div>
                  <div className="liste">
                    <table className="w-full text-xs" aria-label={`Séances ${premier.classe} du ${jourSemaine(premier.date)}`}>
                      <tbody className="divide-y divide-warm-50">
                        {groupe.map(s => (
                          <tr key={cle(s)} className="sans-survol">
                            <td className="list-td whitespace-nowrap text-secondary-800">{jourLong(s.date)}</td>
                            <td className="list-td whitespace-nowrap text-warm-700 tabular-nums">{s.debut}-{s.fin}</td>
                            <td className="list-td w-80">
                              {peutGerer && !s.validee ? (
                                <FloatSelect
                                  label={`Décision du ${jourLong(s.date)}`}
                                  compact
                                  value={choix[cle(s)]}
                                  onChange={e => setChoix(prev => ({ ...prev, [cle(s)]: e.target.value }))}
                                >
                                  {options([s], choix[cle(s)])}
                                </FloatSelect>
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  {decisionLue(s)}
                                  {s.validee && (
                                    <Tooltip content="Séance validée : retirez d’abord la validation de présence dans l’emploi du temps.">
                                      <span><Puce ton="ok">Validée</Puce></span>
                                    </Tooltip>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {edition && (
        <AbsenceFormModal
          absence={absence}
          enseignants={[{ id: absence.teacherId, nom: enseignant }]}
          onClose={() => setEdition(false)}
        />
      )}

      {confirmeSuppression && (
        <ConfirmModal
          variant="danger"
          confirmColor="red"
          title="Supprimer l’absence"
          confirmLabel={suppression ? 'Suppression…' : 'Supprimer'}
          confirmDisabled={suppression}
          onConfirm={supprimer}
          onCancel={() => setConfirmeSuppression(false)}
        >
          <div className="space-y-1 text-sm">
            <p className="font-medium text-secondary-800">{enseignant}</p>
            <p className="text-warm-700 tabular-nums">{periodeAbsence(absence.debut, absence.fin)} · {libelleMotif(absence.motif)}</p>
            <p className="text-warm-700">Ses séances redeviennent des séances ordinaires, assurées par le titulaire.</p>
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}
