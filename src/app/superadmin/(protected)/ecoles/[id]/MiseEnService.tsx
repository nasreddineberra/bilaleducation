import { CheckCircle2, Circle } from 'lucide-react'

/**
 * Liste de mise en service d'une ecole (console de l'editeur).
 *
 * Elle rassemble ce qui manque pour qu'une ecole FONCTIONNE vraiment, et que
 * l'on trouvait jusqu'ici disperse entre la page Sante et la memoire. Chaque
 * etape se lit en base : ce composant ne fait que l'afficher.
 *
 * Deux groupes : « Mise en service » (l'installation, notre affaire) et
 * « Demarrage » (ce que l'ecole fait elle-meme, qui dit si elle a reellement
 * commence a travailler).
 */
export interface Etape {
  label:   string
  ok:      boolean
  /** Precision courte : une valeur, une date, « 1/2 ». */
  detail?: string
}

function Groupe({ titre, etapes }: { titre: string; etapes: Etape[] }) {
  const faites = etapes.filter(e => e.ok).length
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">{titre}</h2>
        <span className={`text-xs font-semibold tabular-nums ${faites === etapes.length ? 'text-primary-700' : 'text-amber-700'}`}>
          {faites}/{etapes.length}
        </span>
      </div>
      <ul className="space-y-1">
        {etapes.map(e => (
          <li key={e.label} className="flex items-start gap-2 text-xs">
            {e.ok
              ? <CheckCircle2 className="w-4 h-4 text-primary-600 flex-shrink-0" aria-label="Fait" />
              : <Circle className="w-4 h-4 text-warm-700 flex-shrink-0" aria-label="À faire" />}
            <span className="min-w-0">
              <span className={e.ok ? 'text-secondary-800' : 'text-secondary-800 font-medium'}>{e.label}</span>
              {e.detail && <span className="block text-warm-700">{e.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MiseEnService({ installation, demarrage }: { installation: Etape[]; demarrage: Etape[] }) {
  return (
    <div className="card p-4 space-y-4">
      <Groupe titre="Mise en service" etapes={installation} />
      <div className="border-t border-warm-100" />
      <Groupe titre="Démarrage" etapes={demarrage} />
    </div>
  )
}
