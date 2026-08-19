/**
 * LES REFUS DE DOUBLON, DITS A L'UTILISATEUR.
 *
 * ┌─ POURQUOI CE MODULE NE REIMPLEMENTE AUCUNE REGLE ────────────────────────┐
 * │ La regle d'unicite vit en BASE — index unique sur les apprenants,        │
 * │ declencheur sur les tuteurs. La recopier ici en TypeScript, c'est se     │
 * │ donner deux verites a tenir alignees : le jour ou l'une change, l'ecran  │
 * │ annonce l'inverse de ce que la base accepte.                             │
 * │                                                                          │
 * │ Ce module ne fait donc que TRADUIRE le refus. Rien de plus.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Deux formes de refus, traitees differemment :
 *
 *   · L'INDEX unique rend un message technique (« duplicate key value violates
 *     unique constraint "idx_..." ») : illisible, on le remplace.
 *
 *   · Le DECLENCHEUR des tuteurs porte deja SON message, ecrit en francais et
 *     pour l'utilisateur — « Cette personne figure deja comme tuteur 2 du foyer
 *     « MARTIN Paul » ». On le laisse passer TEL QUEL : le reformuler ici
 *     perdrait le nom du foyer, qui est justement ce qui permet d'agir.
 *
 * Le rapprochement se fait sur le NOM DE LA CONTRAINTE, jamais sur le texte
 * anglais de PostgreSQL — celui-ci change avec les versions, un nom d'index non.
 */

/** Forme minimale d'une erreur PostgREST / supabase-js. */
interface ErreurBase {
  code?: string | null
  message?: string | null
}

const PAR_CONTRAINTE: { fragment: string; message: string }[] = [
  {
    fragment: 'idx_students_unique_identite',
    message:
      "Un apprenant portant ce nom, ce prénom et cette date de naissance est déjà enregistré. " +
      "S'il s'agit d'une autre personne, vérifiez la date de naissance.",
  },
  {
    fragment: 'idx_teachers_unique_name',
    message: "Un enseignant portant ce nom et ce prénom est déjà enregistré.",
  },
]

/**
 * Message affichable si l'erreur est un refus de doublon, `null` sinon.
 *
 * Rendre `null` — et non un message generique — est deliberé : l'appelant doit
 * pouvoir distinguer « c'est un doublon » de « c'est autre chose », et ne pas
 * annoncer un doublon sur une panne de reseau.
 */
export function messageDoublon(err: ErreurBase | null | undefined): string | null {
  if (!err) return null

  const texte = err.message ?? ''

  // 23505 = unique_violation. Le declencheur des tuteurs le leve lui aussi
  // (`USING ERRCODE = 'unique_violation'`), volontairement : les deux refus
  // sont de meme nature, l'application n'a pas a les distinguer.
  if (err.code !== '23505') return null

  const connu = PAR_CONTRAINTE.find(c => texte.includes(c.fragment))
  if (connu) return connu.message

  // Message deja redige pour l'utilisateur (declencheur des tuteurs). On le
  // reconnait a ce qu'il ne ressemble PAS a un message de contrainte technique.
  if (!texte.includes('duplicate key') && !texte.includes('violates')) return texte

  // 23505 d'une contrainte qu'on ne connait pas : ne pas inventer. L'appelant
  // affichera son propre repli, et le message brut part au journal.
  console.error('[doublons] contrainte unique non traduite :', texte)
  return null
}
