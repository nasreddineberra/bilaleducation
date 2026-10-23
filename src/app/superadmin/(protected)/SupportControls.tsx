'use client'

import { useState, useTransition } from 'react'
import { LifeBuoy } from 'lucide-react'
import { enterSchool, leaveSchool } from '@/app/superadmin/support-actions'
import { schoolUrl } from '@/lib/tenant/console-url'
import { INTERVENTION_MAX_HEURES } from '@/lib/support/duree'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Tooltip from '@/components/ui/Tooltip'
import { FloatButton } from '@/components/ui/FloatFields'

/**
 * Entrée dans une école depuis la console.
 *
 * L'ouverture se prend ICI et nulle part ailleurs : elle écrit le rattachement,
 * donc elle doit invalider le cache du profil — ce qu'un rendu de page n'a pas
 * le droit de faire. Le layout du tableau de bord se contente de vérifier que le
 * rattachement correspond au sous-domaine visité.
 */
export function EnterButton({ id, slug, nom, disabled, raison, dejaOuverte = false, taille = 'xs' }: {
  id: string
  slug: string
  nom: string
  disabled: boolean
  /** Raison du blocage, en infobulle (defaut : intervention ouverte ailleurs). */
  raison?: string
  /** L'intervention en cours porte DÉJÀ sur cette école. */
  dejaOuverte?: boolean
  taille?: 'xs' | 'sm'
}) {
  const [pending, start] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  const [aConfirmer, setAConfirmer] = useState(false)

  // Bouton de la charte, variante `submit` (comme « Nouvelle année »).
  const taillePx = taille === 'sm' ? 'normal' : 'mini'

  const entrer = () => {
    setAConfirmer(false)
    setErreur(null)
    start(async () => {
      const res = await enterSchool(id)
      if (res.error) { setErreur(res.error); return }
      window.location.href = schoolUrl(slug)
    })
  }

  // Déjà dedans : entrer une seconde fois n'aurait aucun sens, et l'action est
  // de toute façon sans effet. On propose ce qu'on veut réellement faire.
  if (dejaOuverte) {
    return (
      <FloatButton href={schoolUrl(slug)} variant="submit" size={taillePx}>Ouvrir l&apos;école</FloatButton>
    )
  }

  return (
    <>
      {/* `title=` natif remplace par le `Tooltip` du projet (clavier + theme).
          Le `<span>` interieur recopie le motif de la feuille d'appel : un
          element `disabled` n'emet pas d'evenement de pointeur, c'est le
          wrapper qui recoit le survol. On n'enveloppe que le cas bloque — sur
          un bouton actif, le libelle se suffit. */}
      {disabled ? (
        <Tooltip content={raison ?? 'Une intervention est déjà en cours sur une autre école.'}>
          <span>
            <FloatButton type="button" variant="submit" size={taillePx} disabled>
              Intervenir
            </FloatButton>
          </span>
        </Tooltip>
      ) : (
        <FloatButton type="button" variant="submit" size={taillePx} onClick={() => setAConfirmer(true)} loading={pending}>
          {pending ? 'Ouverture…' : 'Intervenir'}
        </FloatButton>
      )}
      {erreur && <p role="alert" className="text-xs text-red-600 mt-1">{erreur}</p>}

      {/* Entrer chez un client n'est jamais anodin : on le confirme, et on dit
          ce que cela implique. L'éditeur agit en `admin` (`get_user_role()`) et
          n'est JAMAIS tracé dans le journal de l'école (`fn_audit_logs_sans_editeur`,
          décision du 16/10) : la trace est l'historique `support_interventions`
          de la console. */}
      {aConfirmer && (
        <ConfirmModal
          title={`Intervenir sur ${nom} ?`}
          confirmLabel="Ouvrir l'intervention"
          onConfirm={entrer}
          onCancel={() => setAConfirmer(false)}
        >
          <div className="space-y-3 text-sm text-secondary-700">
            <p>
              Vous allez agir dans <span className="font-semibold">{nom}</span> avec
              les <span className="font-semibold">droits d&apos;administrateur</span> :
              ses élèves, ses familles, ses paiements.
            </p>
            <p className="text-xs bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3 py-2 leading-snug">
              L&apos;intervention est consignée dans
              l&apos;<span className="font-semibold">historique des interventions de la console</span>,
              pas dans le journal d&apos;activité de l&apos;établissement. Elle se referme
              d&apos;elle-même au bout
              d&apos;{INTERVENTION_MAX_HEURES === 1 ? 'une heure' : `${INTERVENTION_MAX_HEURES} heures`}.
            </p>
          </div>
        </ConfirmModal>
      )}
    </>
  )
}

/**
 * Rappel de l'intervention en cours, en tête de console.
 *
 * C'est la SORTIE GARANTIE. Une session interrompue — onglet fermé, ordinateur
 * éteint — laisse le rattachement en place, et le refus d'en ouvrir une seconde
 * enfermerait l'éditeur s'il n'y avait pas ce bouton. Il reste atteignable
 * pendant l'intervention parce que la garde de la console lit la COLONNE
 * `profiles.role`, qui vaut toujours `super_admin`.
 */
/** « 3 h 20 » ou « 45 min » — on ne parle d'heures qu'au-delà d'une heure. */
function formatRestant(heures: number): string {
  const minutes = Math.max(0, Math.round(heures * 60))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

export function SupportBar({ ecole, slug, depuis, maxHeures }: {
  ecole: string
  slug: string
  /** Heures écoulées depuis l'ouverture, ou `null` si inconnue. */
  depuis: number | null
  maxHeures: number
}) {
  const [pending, start] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const quitter = () => {
    setErreur(null)
    start(async () => {
      const res = await leaveSchool()
      if (res.error) { setErreur(res.error); return }
      window.location.reload()
    })
  }

  return (
    <div
      role="status"
      className="card p-0 flex items-center gap-3 px-4 py-3 bg-amber-50 border-amber-300"
    >
      <LifeBuoy className="w-4 h-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="text-sm text-amber-900 min-w-0">
        <span className="font-bold">Intervention en cours</span>
        <span className="mx-2" aria-hidden="true">·</span>
        {ecole}
        {depuis !== null && (
          <>
            <span className="mx-2" aria-hidden="true">·</span>
            {/* Le temps RESTANT plutôt que le temps écoulé : c'est lui qui dit
                quand l'accès se fermera de lui-même. */}
            <span className="text-amber-800">
              {depuis >= maxHeures
                ? 'expire à la prochaine page'
                : `se referme dans ${formatRestant(maxHeures - depuis)}`}
            </span>
          </>
        )}
      </p>
      {erreur && <span role="alert" className="text-xs font-medium text-red-700">{erreur}</span>}

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <FloatButton href={schoolUrl(slug)} size="mini" variant="secondary">
          Ouvrir l&apos;école
        </FloatButton>
        <FloatButton type="button" size="mini" variant="secondary" loading={pending} onClick={quitter}>
          Quitter
        </FloatButton>
      </div>
    </div>
  )
}
