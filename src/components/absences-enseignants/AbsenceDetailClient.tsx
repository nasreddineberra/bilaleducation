'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { FloatButton, FloatSelect } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Puce } from '@/components/dashboard/tdb'
import { useToast } from '@/lib/toast-context'
import { libelleMotif, type Decision } from '@/lib/absences-enseignants/libelles'
import { pluriel } from '@/lib/texte/pluriel'
import { horodatageParis } from '@/lib/dates'
import { deciderSeances, supprimerAbsence } from '@/app/dashboard/absences-enseignants/actions'
import AbsenceFormModal, { type AbsenceSaisie } from './AbsenceFormModal'
import { periodeAbsence } from './periode'
import CasePrevenir from './CasePrevenir'

/**
 * FICHE D'UNE ABSENCE (lot 3b-1) : les seances touchees, groupees par creneau
 * de la semaine, et pour chacune une decision : A decider (defaut, aucune
 * ligne en base), Annulee, ou Remplacee par un membre de l'equipe. « Meme
 * decision » s'applique a un groupe ou a toute l'absence. Les membres pris sur
 * l'horaire sont grises avec la raison, donnee par la base
 * (`remplacants_possibles`) ; une seance validee est verrouillee.
 * Tout part d'un coup a l'enregistrement (`decider_seances_absence`, tout ou rien).
 *
 * FAMILLES (lot 3c) : une seance A VENIR qui passe a « Annulee », ou une seance
 * annoncee annulee qui ne l'est plus, ouvre une confirmation avec la case
 * « Prevenir les familles par email », cochee (grisee sans messagerie). Meme
 * case a la suppression de l'absence et quand une modification de la periode
 * rend ordinaires des seances annoncees annulees.
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
  /** Date de l'email aux familles d'une seance annulee, sinon `null`. */
  prevenuesLe: string | null
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
function jourCourt(instant: string): string {
  return new Date(instant).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' })
}
// CARTES (29/10) : une carte par seance, couleur selon la decision CHOISIE (avant
// meme d'enregistrer), jetons d'etat de la charte (`ton-*`). Index en tete.
type TonCarte = 'attente' | 'danger' | 'remplacement' | 'ok'
const INDEX_COULEURS: { ton: TonCarte; libelle: string }[] = [
  { ton: 'attente', libelle: 'À décider' },
  { ton: 'danger', libelle: 'Annulée' },
  { ton: 'remplacement', libelle: 'Remplacée' },
  { ton: 'ok', libelle: 'Validée' },
]
// Colonne de gauche de LARGEUR FIXE (index des couleurs, titres de creneau) : les
// listes « Même décision » commencent toutes a la meme distance (29/10).
const COLONNE_TITRE = 'sm:w-[22rem] shrink-0'

function tonCarte(validee: boolean, valeur: string): TonCarte {
  if (validee) return 'ok'
  if (valeur === 'annulee') return 'danger'
  if (valeur.startsWith('r:')) return 'remplacement'
  return 'attente'
}

const aVenir = (s: SeanceFiche) => `${s.date}T${s.debut}` > horodatageParis(new Date())
const annoncee = (s: SeanceFiche) => s.decision === 'annulee' && !!s.prevenuesLe

export default function AbsenceDetailClient({ absence, enseignant, seances, membres, peutGerer, messagerie }: {
  absence: AbsenceSaisie
  enseignant: string
  seances: SeanceFiche[]
  membres: Membre[]
  peutGerer: boolean
  messagerie: boolean
}) {
  const router = useRouter()
  const { error: toastError, success: toastSuccess, warning: toastWarning } = useToast()
  const initial = useMemo(() => Object.fromEntries(seances.map(s => [cle(s), valeurDe(s)])), [seances])
  const [choix, setChoix] = useState<Record<string, string>>(initial)
  // Donnees rafraichies apres enregistrement : on repart de la base.
  useEffect(() => { setChoix(initial) }, [initial])
  const [saving, setSaving] = useState(false)
  const [edition, setEdition] = useState(false)
  const [confirmeSuppression, setConfirmeSuppression] = useState(false)
  const [suppression, setSuppression] = useState(false)
  // Confirmation des emails aux familles avant d'enregistrer les decisions.
  const [confirmeEnvoi, setConfirmeEnvoi] = useState(false)
  const [prevenirAnnulees, setPrevenirAnnulees] = useState(true)
  const [prevenirMaintenues, setPrevenirMaintenues] = useState(true)
  const [prevenirRemplacees, setPrevenirRemplacees] = useState(false)
  const [prevenirSuppression, setPrevenirSuppression] = useState(true)

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
  // A annoncer : a venir, annulee maintenant, sans annonce deja faite.
  const aAnnoncer = modifiees.filter(s => aVenir(s) && choix[cle(s)] === 'annulee' && !annoncee(s))
  // A dire maintenues : annoncees annulees, a venir, qui ne le sont plus.
  const aMaintenir = modifiees.filter(s => aVenir(s) && annoncee(s) && choix[cle(s)] !== 'annulee')
  const annonceesAVenir = seances.filter(s => aVenir(s) && annoncee(s))
  // A dire remplacees : a venir, remplacant choisi maintenant (nouveau ou autre),
  // pas deja annoncees annulees (celles-la partent en « maintenues »). Case
  // DECOCHEE par defaut (29/10) : pour les familles, rien ne change.
  const aRemplacer = modifiees.filter(s => aVenir(s) && choix[cle(s)].startsWith('r:') && !annoncee(s))

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

  const demanderEnregistrement = () => {
    if (aAnnoncer.length || aMaintenir.length || aRemplacer.length) {
      setPrevenirAnnulees(true); setPrevenirMaintenues(true); setPrevenirRemplacees(false); setConfirmeEnvoi(true)
    } else enregistrer()
  }

  const enregistrer = async () => {
    setSaving(true)
    const r = await deciderSeances(absence.id, modifiees.map(s => {
      const v = choix[cle(s)]
      return v.startsWith('r:')
        ? { slotId: s.slotId, date: s.date, decision: 'remplacee' as const, remplacant: v.slice(2) }
        : { slotId: s.slotId, date: s.date, decision: v as Decision, remplacant: null }
    }), {
      annulees: messagerie && aAnnoncer.length > 0 && prevenirAnnulees,
      maintenues: messagerie && aMaintenir.length > 0 && prevenirMaintenues,
      remplacees: messagerie && aRemplacer.length > 0 && prevenirRemplacees,
    })
    setSaving(false)
    setConfirmeEnvoi(false)
    if (r.error) { toastError(r.error); return }
    toastSuccess(`${pluriel(modifiees.length, 'décision')} ${modifiees.length > 1 ? 'enregistrées' : 'enregistrée'}.`)
    if (r.avertissement) toastWarning(r.avertissement)
    router.refresh()
  }

  const supprimer = async () => {
    setSuppression(true)
    const r = await supprimerAbsence(absence.id, messagerie && annonceesAVenir.length > 0 && prevenirSuppression)
    setSuppression(false)
    if (r.error) { toastError(r.error); setConfirmeSuppression(false); return }
    toastSuccess('Absence supprimée.')
    if (r.avertissement) toastWarning(r.avertissement)
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
              <FloatButton size="mini" variant="danger" type="button" onClick={() => { setPrevenirSuppression(true); setConfirmeSuppression(true) }}>Supprimer</FloatButton>
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
              {/* Retour aux decisions enregistrees : tant que rien n'est enregistre,
                  les choix des listes se defont d'un clic (demande du 29/10). */}
              <FloatButton size="mini" variant="secondary" type="button" onClick={() => setChoix(initial)}
                disabled={modifiees.length === 0 || saving}>
                Annuler
              </FloatButton>
              <FloatButton size="mini" variant="submit" type="button" onClick={demanderEnregistrement}
                loading={saving} disabled={modifiees.length === 0}>
                Enregistrer
              </FloatButton>
            </div>
          )}
        </div>

        {/* Index des couleurs, puis « Même décision pour toutes » sous le bandeau
            (dans le bandeau, la liste depassait de sa hauteur fixe). */}
        {seances.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2">
            <ul className={clsx('flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-warm-700', COLONNE_TITRE)} aria-label="Couleurs des séances">
              {INDEX_COULEURS.map(i => (
                <li key={i.ton} className="flex items-center gap-1.5">
                  <span aria-hidden className={clsx('w-3 h-3 rounded-sm border-l-[3px] border-l-current', `ton-${i.ton}`)} />
                  {i.libelle}
                </li>
              ))}
            </ul>
            {peutGerer && seances.length > 1 && (
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
          </div>
        )}

        {seances.length === 0 ? (
          <p className="text-sm text-warm-700 py-6 text-center">Aucune séance touchée par cette absence.</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto list-scroll space-y-3 pt-2">
            {groupes.map(groupe => {
              const premier = groupe[0]
              return (
                <section key={premier.slotId} className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className={clsx('section-title truncate', COLONNE_TITRE)}>
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
                  {/* Cartes alignees : la grille en place autant que la largeur le
                      permet et se replie d'elle-meme. */}
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2" aria-label={`Séances ${premier.classe} du ${jourSemaine(premier.date)}`}>
                    {groupe.map(s => (
                      <li key={cle(s)} className={clsx('rounded-lg p-2 space-y-1.5 border-l-4 border-l-current', `ton-${tonCarte(s.validee, choix[cle(s)])}`)}>
                        <div className="text-xs font-bold">{jourLong(s.date)}</div>
                        <div className="text-xs text-warm-700 tabular-nums">{s.debut}-{s.fin}</div>
                        {peutGerer && !s.validee ? (
                          <FloatSelect
                            label="Décision"
                            aria-label={`Décision du ${jourLong(s.date)}`}
                            compact
                            value={choix[cle(s)]}
                            onChange={e => setChoix(prev => ({ ...prev, [cle(s)]: e.target.value }))}
                          >
                            {options([s], choix[cle(s)])}
                          </FloatSelect>
                        ) : (
                          <span className="flex flex-wrap items-center gap-1.5">
                            {decisionLue(s)}
                            {s.validee && (
                              <Tooltip content="Séance validée : retirez d’abord la validation de présence dans l’emploi du temps.">
                                <span><Puce ton="ok">Validée</Puce></span>
                              </Tooltip>
                            )}
                          </span>
                        )}
                        {annoncee(s) && (
                          <div className="text-[10px] text-warm-700">Familles prévenues le {jourCourt(s.prevenuesLe!)}</div>
                        )}
                      </li>
                    ))}
                  </ul>
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
          annoncees={annonceesAVenir}
          messagerie={messagerie}
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
            {annonceesAVenir.length > 0 && (
              <div className="pt-2">
                <CasePrevenir
                  label={annonceesAVenir.length > 1
                    ? `Prévenir les familles que les ${annonceesAVenir.length} séances annoncées annulées ont bien lieu`
                    : 'Prévenir les familles que la séance annoncée annulée a bien lieu'}
                  coche={prevenirSuppression}
                  onChange={setPrevenirSuppression}
                  messagerie={messagerie}
                />
              </div>
            )}
          </div>
        </ConfirmModal>
      )}

      {confirmeEnvoi && (
        <ConfirmModal
          title="Prévenir les familles"
          confirmLabel={saving ? 'Enregistrement…' : 'Enregistrer'}
          confirmDisabled={saving}
          onConfirm={enregistrer}
          onCancel={() => setConfirmeEnvoi(false)}
        >
          <div className="space-y-3 text-sm">
            {aAnnoncer.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-medium text-secondary-800">
                  {aAnnoncer.length > 1 ? `${aAnnoncer.length} séances annulées` : 'Séance annulée'}
                </p>
                <ul className="text-warm-700 tabular-nums">
                  {aAnnoncer.map(s => <li key={cle(s)}>{s.classe} · {jourLong(s.date)} · {s.debut}-{s.fin}</li>)}
                </ul>
                <CasePrevenir label="Prévenir les familles par email" coche={prevenirAnnulees}
                  onChange={setPrevenirAnnulees} messagerie={messagerie} />
              </div>
            )}
            {aMaintenir.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-medium text-secondary-800">
                  {aMaintenir.length > 1
                    ? `${aMaintenir.length} séances annoncées annulées ont bien lieu`
                    : 'La séance annoncée annulée a bien lieu'}
                </p>
                <ul className="text-warm-700 tabular-nums">
                  {aMaintenir.map(s => <li key={cle(s)}>{s.classe} · {jourLong(s.date)} · {s.debut}-{s.fin}</li>)}
                </ul>
                <CasePrevenir label="Prévenir les familles par email" coche={prevenirMaintenues}
                  onChange={setPrevenirMaintenues} messagerie={messagerie} />
              </div>
            )}
            {aRemplacer.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-medium text-secondary-800">
                  {aRemplacer.length > 1 ? `${aRemplacer.length} séances assurées par un remplaçant` : 'Séance assurée par un remplaçant'}
                </p>
                <ul className="text-warm-700 tabular-nums">
                  {aRemplacer.map(s => <li key={cle(s)}>{s.classe} · {jourLong(s.date)} · {s.debut}-{s.fin}</li>)}
                </ul>
                <CasePrevenir label="Prévenir les familles du remplacement" coche={prevenirRemplacees}
                  onChange={setPrevenirRemplacees} messagerie={messagerie} />
              </div>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}
