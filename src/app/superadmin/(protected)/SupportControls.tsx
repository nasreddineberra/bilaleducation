'use client'

import { useState, useTransition } from 'react'
import { LifeBuoy } from 'lucide-react'
import { enterSchool, leaveSchool } from '@/app/superadmin/support-actions'
import { schoolUrl } from '@/lib/tenant/console-url'

/**
 * Entrée dans une école depuis la console.
 *
 * L'ouverture se prend ICI et nulle part ailleurs : elle écrit le rattachement,
 * donc elle doit invalider le cache du profil — ce qu'un rendu de page n'a pas
 * le droit de faire. Le layout du tableau de bord se contente de vérifier que le
 * rattachement correspond au sous-domaine visité.
 */
export function EnterButton({ id, slug, disabled }: { id: string; slug: string; disabled: boolean }) {
  const [pending, start] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const entrer = () => {
    setErreur(null)
    start(async () => {
      const res = await enterSchool(id)
      if (res.error) { setErreur(res.error); return }
      window.location.href = schoolUrl(slug)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={entrer}
        disabled={pending || disabled}
        title={disabled ? 'Une intervention est déjà en cours sur une autre école.' : undefined}
        className="btn btn-secondary text-xs py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? 'Ouverture…' : 'Intervenir'}
      </button>
      {erreur && <p role="alert" className="text-xs text-red-600 mt-1">{erreur}</p>}
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
        <a href={schoolUrl(slug)} className="btn btn-secondary text-xs py-1.5 px-3">
          Ouvrir l&apos;école
        </a>
        <button
          type="button"
          onClick={quitter}
          disabled={pending}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-amber-400 text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-50"
        >
          {pending ? 'Fermeture…' : 'Quitter'}
        </button>
      </div>
    </div>
  )
}
