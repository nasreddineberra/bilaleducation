/**
 * Titulaire ACTUEL d'une classe : l'affectation principale sans date de fin.
 * Un titulaire retire garde sa ligne (historique, `effective_until` posee) : il
 * ne doit plus etre propose ni affiche comme titulaire. Meme regle que la fiche
 * classe (« Sans titulaire ») et la liste des classes.
 */
export function titulaireActuel<T extends { is_main_teacher: boolean | null; effective_until?: string | null }>(
  affectations: T[] | null | undefined,
): T | undefined {
  return affectations?.find(a => a.is_main_teacher && !a.effective_until)
}
