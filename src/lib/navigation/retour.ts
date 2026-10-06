/**
 * D'OÙ VIENT-ON — et donc où retourner après enregistrement.
 *
 * ── LE DÉFAUT QUE CECI CORRIGE ─────────────────────────────────────────────
 *
 * La règle du projet est « retour à la liste après enregistrement ». Elle est
 * juste tant qu'on n'atteint une fiche que depuis sa liste. Ce n'est plus vrai :
 * l'audit « Affectations & effectifs » y mène aussi, et le geste attendu depuis
 * l'audit est précisément d'ouvrir la fiche pour rendre l'apprenant inactif.
 * On revenait alors sur la liste des apprenants — en perdant l'audit, c'est-à-dire
 * la seule chose qu'on était en train de traiter, et la liste des suivants.
 *
 * ── UNE LISTE BLANCHE, PAS UNE URL DANS LE LIEN ────────────────────────────
 *
 * Un `?retour=/n-importe-quoi` serait une surface de redirection ouverte — le
 * projet garde déjà le `next=` de l'authentification pour cette raison (9 août).
 * Ici la question ne se pose même pas : le paramètre ne porte qu'un NOM
 * d'origine, et seules les destinations écrites ci-dessous existent. Un nom
 * inconnu retombe silencieusement sur la liste, ce qui est le comportement
 * d'avant — fail-open, comme la session.
 *
 * ── AJOUTER UNE ORIGINE ────────────────────────────────────────────────────
 *
 * Une ligne ici, et `?from=<nom>` sur le lien qui mène à la fiche. Rien d'autre :
 * les fiches lisent déjà ce paramètre.
 */
const ORIGINES: Record<string, string> = {
  /** Fiche d'un foyer → l'une de ses fiches apprenant (`ParentsTable`). */
  parents: '/dashboard/parents',
  /** Audits de passage d'année → la fiche à corriger (lien « Corriger »). */
  audit:   '/dashboard/passage-annee',
}

/**
 * @param from   la valeur brute de `?from=`, telle qu'elle arrive de l'URL
 * @param defaut la liste de rattachement de la fiche, employée par défaut
 */
export function hrefRetour(from: string | undefined | null, defaut: string): string {
  if (!from) return defaut
  return ORIGINES[from] ?? defaut
}
