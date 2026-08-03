/** Normalisation d'un nom pour COMPARAISON (jamais pour l'affichage) :
 *  minuscules, accents retirés, espaces multiples réduits.
 *
 *  Pendant exact de la fonction SQL `public.norm_name()` utilisée par les index
 *  d'unicité — les deux doivent rester alignées, sinon le formulaire laisserait
 *  passer un doublon que la base refuserait ensuite (ou l'inverse).
 */
export const normalizeNom = (s: string | null | undefined): string =>
  (s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // diacritiques combinants

/** Vrai si les deux couples (nom, prénom) désignent la même personne. */
export const sameName = (
  a: { last_name?: string | null; first_name?: string | null },
  b: { last_name?: string | null; first_name?: string | null },
): boolean =>
  normalizeNom(a.last_name) === normalizeNom(b.last_name) &&
  normalizeNom(a.first_name) === normalizeNom(b.first_name)
