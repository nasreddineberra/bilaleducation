'use client'

import { usePathname } from 'next/navigation'
import { SkeletonListPage, SkeletonFormPage } from './SkeletonTable'

/**
 * SQUELETTE DE CHARGEMENT, choisi d'après la route demandée.
 *
 * ┌─ POURQUOI ──────────────────────────────────────────────────────────────┐
 * │ Un chargement à froid traversait DEUX attentes réelles — le layout du    │
 * │ tableau de bord (session, profil, établissement, compteurs), puis les    │
 * │ données de la page — mais les affichait dans DEUX langages visuels       │
 * │ différents : un rond qui tourne, puis un squelette. L'interface          │
 * │ semblait redémarrer alors qu'elle progressait.                          │
 * │                                                                          │
 * │ Pire : la moitié des pages n'avaient aucun squelette et ré-exportaient   │
 * │ le même rond. On voyait donc « rond → rond », deux fois la même image    │
 * │ sans aucune information.                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Un squelette utile PRÉFIGURE la page : il annonce sa forme, ce qu'un rond ne
 * fait jamais. D'où cette carte unique route → forme, lue par le loader racine
 * (qui y ajoute la silhouette du cadre) ET par chaque loader de page.
 *
 * AJOUTER UNE PAGE = ajouter une ligne à `FORMES`. Sans correspondance, le repli
 * est la liste, forme de loin la plus courante dans cette application.
 */

type Forme = 'liste' | 'fiche' | 'formulaire' | 'tableau-de-bord' | 'grille'

/**
 * Ordre significatif : la première correspondance gagne, donc le particulier
 * doit précéder le général (`/financements/reglements` avant `/financements`).
 */
const FORMES: [RegExp, Forme][] = [
  // Emploi du temps : une grille de créneaux, rien d'autre ne lui ressemble.
  [/^\/dashboard\/emploi-du-temps/, 'grille'],

  // Écrans à cartes et panneaux : chiffres en tête, contenu en blocs.
  [/^\/dashboard$/, 'tableau-de-bord'],
  [/^\/dashboard\/financements/, 'tableau-de-bord'],
  [/^\/dashboard\/temps-presence/, 'tableau-de-bord'],
  [/^\/dashboard\/absences/, 'tableau-de-bord'],
  [/^\/dashboard\/affectation/, 'tableau-de-bord'],
  [/^\/dashboard\/bulletins/, 'tableau-de-bord'],
  [/^\/dashboard\/grades/, 'tableau-de-bord'],
  [/^\/dashboard\/evaluations/, 'tableau-de-bord'],
  [/^\/dashboard\/passage-annee/, 'tableau-de-bord'],
  [/^\/dashboard\/cotisations/, 'tableau-de-bord'],

  // FICHES À ONGLETS. Elles ne se réduisent pas à un formulaire : bandeau
  // d'identité en tête, puis barre d'onglets, puis le contenu. Les oublier
  // faisait sauter la page au moment de la relève.
  // La négation de `new` est indispensable : la création n'a ni bandeau ni
  // onglets, c'est un formulaire nu.
  [/^\/dashboard\/(students|parents|teachers)\/(?!new$)[^/]+$/, 'fiche'],

  // Formulaires simples : création, et fiches sans onglets.
  [/^\/dashboard\/(students|parents|teachers|utilisateurs|classes|annee-scolaire|communications|notifications)\/[^/]+/, 'formulaire'],
  [/^\/dashboard\/etablissement/, 'formulaire'],
  [/^\/dashboard\/mon-compte/, 'formulaire'],
]

function contenu(forme: Forme) {
  switch (forme) {
    case 'grille':
      return (
        <div className="space-y-3 animate-fade-in">
          <div className="card flex items-center gap-3 p-3">
            <div className="h-9 w-32 rounded-lg bg-warm-100 animate-pulse" />
            <div className="h-9 w-48 rounded-lg bg-warm-100 animate-pulse" />
            <div className="ml-auto h-9 w-40 rounded-lg bg-warm-100 animate-pulse" />
          </div>
          <div className="card p-3">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 42 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-warm-50 animate-pulse" style={{ animationDelay: `${i * 15}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )

    case 'tableau-de-bord':
      return (
        <div className="space-y-3 animate-fade-in">
          {/* Bandeau de chiffres */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 space-y-2">
                <div className="h-2.5 w-20 rounded bg-warm-100 animate-pulse" />
                <div className="h-6 w-16 rounded bg-warm-100 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
              </div>
            ))}
          </div>
          {/* Deux panneaux */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="card p-4 space-y-2 lg:col-span-2">
              <div className="h-3 w-40 rounded bg-warm-100 animate-pulse" />
              <div className="h-48 rounded-xl bg-warm-50 animate-pulse" />
            </div>
            <div className="card p-4 space-y-2">
              <div className="h-3 w-28 rounded bg-warm-100 animate-pulse" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 rounded-lg bg-warm-50 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )

    case 'fiche':
      return (
        <div className="space-y-4 animate-fade-in">
          {/* Bandeau d'identite : avatar, nom, sous-titre. */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-warm-100 animate-pulse shrink-0" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 rounded bg-warm-100 animate-pulse" />
              <div className="h-2.5 w-64 rounded bg-warm-100 animate-pulse" />
            </div>
          </div>

          {/* Barre d'onglets. Le `?tab=` ne change pas ce squelette : basculer
              d'un onglet a l'autre est un etat client, sans nouvelle attente. */}
          <div className="flex items-center gap-1 border-b border-warm-200 pb-1">
            {[70, 84, 92, 96, 88].map((w, i) => (
              <div
                key={i}
                className="h-7 rounded-lg bg-warm-100 animate-pulse"
                style={{ width: w, animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>

          <SkeletonFormPage sections={3} />
        </div>
      )

    case 'formulaire':
      return <SkeletonFormPage sections={3} />

    default:
      return <SkeletonListPage rows={8} cols={5} />
  }
}

export function formeDeLaRoute(pathname: string): Forme {
  for (const [motif, forme] of FORMES) if (motif.test(pathname)) return forme
  return 'liste'
}

export default function RouteSkeleton() {
  return contenu(formeDeLaRoute(usePathname()))
}
