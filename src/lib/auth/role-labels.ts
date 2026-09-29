import type { UserRole } from '@/types/database'

/**
 * Libellés des rôles, en français, pour l'AFFICHAGE.
 *
 * ── POURQUOI ───────────────────────────────────────────────────────────────
 *
 * Sept fichiers portaient leur propre table, avec QUATRE graphies du même rôle
 * (« Responsable Pédagogique », « Resp. Pédagogique », « Resp. pédagogique »,
 * « Resp. Pédago. ») et un `admin` qui oscillait entre « Administrateur » et
 * « Admin ». Le tableau de bord affichait deux libellés du même rôle SUR LE
 * MÊME ÉCRAN : le corps le recevait d'une table, l'en-tête rendait la valeur
 * BRUTE de `profiles.role` avec un `capitalize` CSS — d'où « Responsable
 * Pedagogique », sans accent, la base ne stockant pas des libellés.
 *
 * Montrer un identifiant de base à l'utilisateur est pire que ne rien montrer
 * (règle posée le 16 août sur la situation familiale) : d'où le repli sur une
 * chaîne VIDE pour une valeur inconnue, et jamais sur la valeur brute.
 *
 * ── DEUX FORMES, ET C'EST DÉLIBÉRÉ ─────────────────────────────────────────
 *
 * `LONG` pour les fiches et les en-têtes de page, `COURT` pour les colonnes de
 * tableau et les badges, où la place est comptée. Ce n'est pas la divergence
 * qu'on corrige ici : la divergence, c'était d'écrire quatre fois le MÊME
 * registre de quatre façons.
 *
 * Casse : minuscule au second mot (« Responsable pédagogique »), décision du
 * 29 septembre — c'est aussi l'orthographe française d'un nom de fonction.
 *
 * ── CE QUI N'EST PAS ICI ───────────────────────────────────────────────────
 *
 * Les libellés de SERVICE de Communication Staff (« Enseignants »,
 * « Comptabilité », « Secrétariat ») restent chez eux : ce sont des groupes au
 * pluriel, pas des rôles individuels, distinction arrêtée le 19 juillet. Les
 * confondre serait une régression, pas une unification.
 */

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin:             'Super administrateur',
  admin:                   'Administrateur',
  direction:               'Direction',
  comptable:               'Comptable',
  responsable_pedagogique: 'Responsable pédagogique',
  enseignant:              'Enseignant',
  secretaire:              'Secrétaire',
  parent:                  'Parent',
}

export const ROLE_LABEL_COURT: Record<UserRole, string> = {
  super_admin:             'Super admin',
  admin:                   'Admin',
  direction:               'Direction',
  comptable:               'Comptable',
  responsable_pedagogique: 'Resp. pédagogique',
  enseignant:              'Enseignant',
  secretaire:              'Secrétaire',
  parent:                  'Parent',
}

/**
 * Libellé d'un rôle, ou chaîne VIDE si la valeur est inconnue ou absente.
 *
 * Le repli n'est jamais la valeur brute : elle afficherait un identifiant
 * technique (`responsable_pedagogique`), tiret bas compris.
 */
export function libelleRole(
  role: string | null | undefined,
  forme: 'long' | 'court' = 'long',
): string {
  if (!role) return ''
  const table = forme === 'court' ? ROLE_LABEL_COURT : ROLE_LABEL
  return table[role as UserRole] ?? ''
}
