/**
 * Controle du resultat d'une ecriture Supabase.
 *
 * POURQUOI CE FICHIER EXISTE : une ecriture ecartee par la RLS NE LEVE RIEN.
 * La clause USING d'une policy filtre les lignes avant l'UPDATE ou le DELETE :
 * zero ligne touchee, `error` a null. L'application annonce donc un succes et
 * renvoie l'utilisateur a sa liste alors que rien n'a ete enregistre. Trouve le
 * 24/09 sur la fiche apprenant, ou un enseignant « modifiait » un nom sans effet.
 *
 * A NE PAS CONFONDRE AVEC UN INSERT : un INSERT refuse par la RLS leve bien
 * `42501 new row violates row-level security policy`. Il est donc visible sans
 * ce controle. Seuls UPDATE, DELETE et UPSERT sont silencieux.
 *
 * Le controle porte sur le NOMBRE DE LIGNES, ce qui suppose un `.select()` sur
 * l'appel — sans lui PostgREST ne renvoie aucune ligne et le controle croirait
 * a un refus systematique.
 */

type ResultatEcriture = {
  data: unknown[] | null
  error: { message: string } | null
}

/**
 * Leve si l'ecriture a echoue OU si elle n'a touche aucune ligne.
 *
 * `quoi` nomme l'objet au singulier, tel qu'il se lit dans un message
 * d'erreur : « Ce paiement », « Cette depense ».
 *
 * Deux causes mènent a zero ligne et on ne peut pas les distinguer : la RLS a
 * ecarte la ligne (droits), ou la ligne n'existe plus (un collegue l'a
 * supprimee entre-temps). Le message nomme donc les deux plutot que d'affirmer
 * la plus probable — c'est la lecon de l'ecran de lien de reinitialisation
 * (24/09), qui affirmait « ce lien a deja servi » sur une cause sur deux.
 */
export function verifierEcriture(resultat: ResultatEcriture, quoi: string): void {
  const message = erreurEcriture(resultat, quoi)
  if (message) throw new Error(message)
}

/**
 * Meme controle, mais RENDU comme message au lieu d'etre leve — pour les ecrans
 * qui signalent par un toast suivi d'un `return` et non par une exception
 * (l'emploi du temps, par exemple). Lever chez eux remonterait hors de tout
 * `try`, ce qui remplacerait un faux succes par un ecran casse.
 *
 * Rend `null` quand l'ecriture a bien eu lieu.
 */
export function erreurEcriture(resultat: ResultatEcriture, quoi: string): string | null {
  if (resultat.error) return `${quoi} : ${resultat.error.message}`
  if (!resultat.data?.length) {
    return `${quoi} n'a pas pu etre enregistre : vos droits ne le permettent pas, ou l'element n'existe plus.`
  }
  return null
}

/**
 * Variante pour une ecriture qui porte sur un ENSEMBLE et non sur une ligne
 * precise : un nettoyage avant reinsertion (`eq('class_id', ...)`), une cascade
 * sur tous les creneaux d'une classe. Zero ligne y est le cas NORMAL — une
 * classe neuve n'a aucune affectation a effacer, une classe sans emploi du temps
 * aucun creneau a reaffecter. `verifierEcriture` y leverait a tort, et le
 * correctif serait pire que le defaut.
 *
 * Elle ne couvre donc QUE l'erreur : contrainte violee, panne reseau, et un
 * INSERT refuse par la RLS (42501). Un refus RLS sur l'UPDATE ou le DELETE reste
 * invisible — c'est le prix de l'ensemble, et il est acceptable ici parce que
 * ces appels vont par paires (le DELETE de nettoyage precede un INSERT, qui
 * leve, lui).
 *
 * A n'employer QUE dans ce cas. Des qu'une ecriture vise un `id`, c'est
 * `verifierEcriture` qu'il faut.
 */
export function erreurEcritureLot(resultat: { error: { message: string } | null }, quoi: string): string | null {
  return resultat.error ? `${quoi} : ${resultat.error.message}` : null
}

/** Meme controle que `erreurEcritureLot`, mais LEVE. Pour les appelants sous
 *  `try/catch` ; les autres prennent la version qui rend le message. */
export function verifierEcritureLot(resultat: { error: { message: string } | null }, quoi: string): void {
  const message = erreurEcritureLot(resultat, quoi)
  if (message) throw new Error(message)
}
