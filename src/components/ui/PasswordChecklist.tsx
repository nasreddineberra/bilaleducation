import { Check, X } from 'lucide-react'
import clsx from 'clsx'
import { PASSWORD_RULES } from '@/lib/validation/password'

/**
 * Liste des règles de mot de passe, cochées en direct pendant la saisie.
 *
 * ── POURQUOI CE COMPOSANT EXISTE ───────────────────────────────────────────
 *
 * Il était recopié dans QUATRE fichiers (réinitialisation, fiche utilisateur,
 * création d'école côté console, Mon compte), avec trois couleurs différentes
 * pour la même idée et — surtout — QUATRE conditions d'affichage distinctes.
 *
 * C'est cette dispersion qui a produit le défaut du 29 septembre : sur l'écran
 * de réinitialisation, la liste n'apparaissait qu'au `onBlur`, donc APRÈS avoir
 * quitté le champ. Le correctif du 15 juillet, posé sur « Mon compte », n'avait
 * jamais atteint les autres copies. Une règle d'affichage recopiée quatre fois
 * ne se corrige pas quatre fois : elle diverge.
 *
 * La CONDITION d'affichage reste chez l'appelant — elle dépend de l'écran (un
 * champ généré n'a pas les mêmes moments utiles qu'un champ saisi). Ce qui est
 * mutualisé, c'est le RENDU, et c'est bien ce qui divergeait sans raison.
 *
 * ── LES DEUX RÈGLES DE NOM ─────────────────────────────────────────────────
 *
 * « Ne contient pas votre prénom / votre nom » n'ont de sens que si l'on
 * connaît l'identité. Sans elle, les afficher promettrait un contrôle qui
 * n'a pas lieu — `PASSWORD_RULES` les fait d'ailleurs passer d'office. Seuil à
 * 3 caractères : en deçà, la sous-chaîne se retrouve dans trop de mots de passe
 * légitimes.
 */
export default function PasswordChecklist({
  password,
  firstName,
  lastName,
  colonnes = 1,
}: {
  password:   string
  firstName?: string
  lastName?:  string
  /** 2 pour une grille (formulaire large), 1 pour une liste sous le champ. */
  colonnes?:  1 | 2
}) {
  const hasName = (firstName && firstName.trim().length >= 3) ||
                  (lastName  && lastName.trim().length  >= 3)

  const rules = PASSWORD_RULES.filter(r =>
    hasName ? true : r.key !== 'noFirst' && r.key !== 'noLast'
  )

  return (
    <ul
      aria-label="Règles du mot de passe"
      className={clsx(
        colonnes === 2
          ? 'grid grid-cols-2 gap-x-4 gap-y-1'
          // Collée sous le champ : elle en est le prolongement, d'où la marge.
          // En grille, le bloc est un élément de flux à part, le parent espace.
          : 'mt-1.5 space-y-0.5',
      )}
    >
      {rules.map(rule => {
        const ok = rule.test(password, firstName, lastName)
        return (
          <li
            key={rule.key}
            className={clsx(
              'flex items-center gap-1.5 text-xs',
              // Turquoise et non vert : règle du 2 août, les verts d'ÉTAT
              // passent à `primary`. L'app mélangeait green et emerald pour
              // cette même idée ; seule la fiche utilisateur avait été reprise.
              ok ? 'text-primary-600' : 'text-warm-700',
            )}
          >
            {ok
              ? <Check size={11} className="flex-shrink-0" />
              : <X     size={11} className="flex-shrink-0" />
            }
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
